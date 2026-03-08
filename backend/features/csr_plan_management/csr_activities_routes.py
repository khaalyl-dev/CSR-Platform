"""
CSR activities within plans endpoints.
"""
from datetime import date, datetime
from flask import Blueprint, request, jsonify

from core import db, token_required
from models import CsrActivity, CsrPlan, UserSite, RealizedCsr, Category
from features.audit_history_management.audit_helper import (
    audit_create,
    audit_update,
    audit_delete,
    snapshot_activity,
)


def _plan_is_editable(plan: CsrPlan) -> bool:
    """True if plan can be edited: DRAFT/REJECTED (and not past unlock_until), or VALIDATED with unlock_until in the future."""
    unlock_until = getattr(plan, "unlock_until", None)
    now = datetime.utcnow()
    if plan.status in ("DRAFT", "REJECTED"):
        if unlock_until and now > unlock_until:
            return False
        return True
    if plan.status == "VALIDATED" and unlock_until and now <= unlock_until:
        return True
    return False

bp = Blueprint("csr_activities", __name__, url_prefix="/api/csr-activities")


def _activity_to_json(a: CsrActivity):
    return {
        "id": a.id,
        "plan_id": a.plan_id,
        "activity_number": a.activity_number or "",
        "title": a.title or "",
        "description": a.description or None,
        "category_id": a.category_id,
        "status": a.status,
        "planned_budget": float(a.planned_budget) if a.planned_budget is not None else None,
        "organization": a.organization or None,
        "collaboration_nature": a.collaboration_nature or None,
        "organizer": a.organizer or None,
        "planned_volunteers": a.planned_volunteers,
        "action_impact_target": float(a.action_impact_target) if a.action_impact_target is not None else None,
        "action_impact_unit": a.action_impact_unit or None,
    }


def _activity_to_json_with_plan(a: CsrActivity):
    """Include plan and category info for list views."""
    out = _activity_to_json(a)
    if a.plan:
        out["site_id"] = a.plan.site_id
        out["site_name"] = a.plan.site.name if a.plan.site else None
        out["site_code"] = a.plan.site.code if a.plan.site else None
        out["year"] = a.plan.year
        out["plan_status"] = a.plan.status
        out["plan_editable"] = _plan_is_editable(a.plan)
    else:
        out["site_id"] = None
        out["site_name"] = out["site_code"] = None
        out["year"] = None
        out["plan_status"] = None
        out["plan_editable"] = False
    out["category_name"] = a.category.name if a.category else None
    return out


@bp.get("")
@token_required
def list_activities():
    """List CSR activities. Optional: plan_id, year, exclude_realized.
    If exclude_realized=1 (default for list view), activities that have at least one realized_csr are excluded.
    SITE_USER only sees activities of their sites' plans."""
    plan_id = request.args.get("plan_id")
    year = request.args.get("year", type=int)
    # By default exclude realized when listing all; when plan_id is set (e.g. plan detail) include all.
    exclude_realized_val = request.args.get("exclude_realized")
    if exclude_realized_val is not None:
        exclude_realized = exclude_realized_val == "1"
    else:
        exclude_realized = not plan_id

    q = CsrActivity.query.options(
        db.joinedload(CsrActivity.plan).joinedload(CsrPlan.site),
        db.joinedload(CsrActivity.category),
    )
    role = (getattr(request, "role", "") or "").upper()

    if role in ("SITE_USER", "SITE"):
        user_sites = UserSite.query.filter_by(user_id=request.user_id, is_active=True).all()
        allowed_site_ids = [us.site_id for us in user_sites]
        if not allowed_site_ids:
            return jsonify([]), 200
        plan_ids = [p.id for p in CsrPlan.query.filter(CsrPlan.site_id.in_(allowed_site_ids)).all()]
        q = q.filter(CsrActivity.plan_id.in_(plan_ids))

    if plan_id:
        q = q.filter_by(plan_id=plan_id)
    if year is not None:
        q = q.join(CsrPlan).filter(CsrPlan.year == year)
    else:
        q = q.join(CsrPlan)

    if exclude_realized:
        q = q.filter(~CsrActivity.id.in_(db.session.query(RealizedCsr.activity_id).distinct()))
        # Planned-activities list: current and future years, and plans that can have activities (DRAFT, REJECTED, VALIDATED)
        current_year = date.today().year
        q = q.filter(CsrPlan.year >= current_year)
        q = q.filter(CsrPlan.status.in_(["VALIDATED", "DRAFT", "REJECTED"]))

    activities = q.order_by(CsrPlan.year.desc(), CsrActivity.plan_id, CsrActivity.activity_number).all()
    return jsonify([_activity_to_json_with_plan(a) for a in activities]), 200


def _user_can_access_plan(user_id: str, plan_id: str, role: str) -> bool:
    role = (role or "").upper()
    if role not in ("SITE_USER", "SITE"):
        return True
    user_sites = UserSite.query.filter_by(user_id=user_id, is_active=True).all()
    allowed_site_ids = [us.site_id for us in user_sites]
    plan = CsrPlan.query.get(plan_id)
    return plan and plan.site_id in allowed_site_ids


def _get_or_create_uncategorized():
    """Get or create the default 'Uncategorized' category for draft activities."""
    cat = Category.query.filter(db.func.lower(Category.name) == "uncategorized").first()
    if cat:
        return cat
    cat = Category(name="Uncategorized")
    db.session.add(cat)
    db.session.flush()
    return cat


@bp.post("")
@token_required
def create_activity():
    """Create a new CSR activity within a plan. When draft=true, only plan_id and title are required."""
    data = request.get_json()
    if not data:
        return jsonify({"message": "Données manquantes"}), 400

    plan_id = data.get("plan_id")
    title = (data.get("title") or "").strip()
    draft = data.get("draft") is True

    if not plan_id or not title:
        return jsonify({"message": "plan_id et title sont obligatoires"}), 400

    if not _user_can_access_plan(request.user_id, plan_id, getattr(request, "role", "")):
        return jsonify({"message": "Vous n'avez pas accès à ce plan"}), 403

    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    if not _plan_is_editable(plan):
        return jsonify({"message": "Plan validé (verrouillé) ou période d'ouverture expirée. Utilisez une demande de modification."}), 403

    if draft:
        category_id = (data.get("category_id") or "").strip()
        if not category_id:
            uncat = _get_or_create_uncategorized()
            category_id = uncat.id
        activity_number = (data.get("activity_number") or "").strip()
        if not activity_number:
            import uuid
            activity_number = "Brouillon-" + str(uuid.uuid4())[:8]
        existing = CsrActivity.query.filter_by(plan_id=plan_id, activity_number=activity_number).first()
        if existing:
            import uuid
            activity_number = "Brouillon-" + str(uuid.uuid4())[:8]
    else:
        category_id = data.get("category_id")
        activity_number = (data.get("activity_number") or "").strip()
        if not category_id or not activity_number:
            return jsonify({"message": "category_id et activity_number sont obligatoires pour une création complète"}), 400
        existing = CsrActivity.query.filter_by(plan_id=plan_id, activity_number=activity_number).first()
        if existing:
            return jsonify({"message": "Une activité avec ce numéro existe déjà dans ce plan"}), 400

    def _num(key):
        v = data.get(key)
        if v is None or v == "":
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    a = CsrActivity(
        plan_id=plan_id,
        category_id=category_id,
        activity_number=activity_number,
        title=title,
        description=(data.get("description") or "").strip() or None,
        planned_budget=_num("planned_budget"),
        status="DRAFT",
    )
    db.session.add(a)
    db.session.flush()
    audit_create(
        user_id=request.user_id,
        site_id=plan.site_id,
        entity_type="ACTIVITY",
        entity_id=a.id,
        description=f"Création activité {a.title or a.activity_number}",
        new_snapshot=snapshot_activity(a),
    )
    db.session.commit()
    return jsonify(_activity_to_json(a)), 201


@bp.get("/<activity_id>")
@token_required
def get_activity(activity_id: str):
    """Get a single CSR activity by id (for edit). SITE_USER only if plan's site is allowed."""
    from sqlalchemy.orm import joinedload
    a = (
        CsrActivity.query.options(
            db.joinedload(CsrActivity.plan).joinedload(CsrPlan.site),
            db.joinedload(CsrActivity.category),
        )
        .filter_by(id=activity_id)
        .first()
    )
    if not a:
        return jsonify({"message": "Activité introuvable"}), 404
    if not _user_can_access_plan(request.user_id, a.plan_id, getattr(request, "role", "")):
        return jsonify({"message": "Vous n'avez pas accès à cette activité"}), 403
    return jsonify(_activity_to_json_with_plan(a)), 200


def _activity_site_id(a: CsrActivity):
    return a.plan.site_id if a.plan else None


@bp.put("/<activity_id>")
@token_required
def update_activity(activity_id: str):
    """Update a CSR activity. SITE_USER only if plan's site is allowed. Plan must not be VALIDATED (locked)."""
    a = CsrActivity.query.get(activity_id)
    if not a:
        return jsonify({"message": "Activité introuvable"}), 404
    if not _user_can_access_plan(request.user_id, a.plan_id, getattr(request, "role", "")):
        return jsonify({"message": "Vous n'avez pas accès à cette activité"}), 403
    plan = CsrPlan.query.get(a.plan_id)
    if plan and not _plan_is_editable(plan):
        return jsonify({"message": "Plan validé (verrouillé) ou période d'ouverture expirée. Utilisez une demande de modification."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"message": "Données manquantes"}), 400

    category_id = data.get("category_id")
    activity_number = (data.get("activity_number") or "").strip()
    title = (data.get("title") or "").strip()
    if not category_id or not activity_number or not title:
        return jsonify({"message": "category_id, activity_number et title sont obligatoires"}), 400

    existing = CsrActivity.query.filter_by(plan_id=a.plan_id, activity_number=activity_number).first()
    if existing and existing.id != activity_id:
        return jsonify({"message": "Une activité avec ce numéro existe déjà dans ce plan"}), 400

    old_snapshot = snapshot_activity(a)
    def _num(key):
        v = data.get(key)
        if v is None or v == "":
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    def _int_val(key):
        v = data.get(key)
        if v is None or v == "":
            return None
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    def _str_val(key):
        v = data.get(key)
        return (v.strip() if isinstance(v, str) and v.strip() else None) or None

    a.category_id = category_id
    a.activity_number = activity_number
    a.title = title
    a.description = (data.get("description") or "").strip() or None
    a.planned_budget = _num("planned_budget")
    if "organization" in data:
        a.organization = _str_val("organization") or "INTERNAL"
    if "collaboration_nature" in data:
        a.collaboration_nature = _str_val("collaboration_nature")
    if "organizer" in data:
        a.organizer = _str_val("organizer")
    if "planned_volunteers" in data:
        a.planned_volunteers = _int_val("planned_volunteers")
    if "action_impact_target" in data:
        a.action_impact_target = _num("action_impact_target")
    if "action_impact_unit" in data:
        a.action_impact_unit = _str_val("action_impact_unit")
    audit_update(
        user_id=request.user_id,
        site_id=_activity_site_id(a),
        entity_type="ACTIVITY",
        entity_id=activity_id,
        description=f"Modification activité {a.title or a.activity_number}",
        old_snapshot=old_snapshot,
        new_snapshot=snapshot_activity(a),
    )
    db.session.commit()
    return jsonify(_activity_to_json(a)), 200


@bp.delete("/<activity_id>")
@token_required
def delete_activity(activity_id: str):
    """Delete a CSR activity. SITE_USER only if plan's site is allowed. Plan must not be VALIDATED (locked)."""
    a = CsrActivity.query.get(activity_id)
    if not a:
        return jsonify({"message": "Activité introuvable"}), 404
    if not _user_can_access_plan(request.user_id, a.plan_id, getattr(request, "role", "")):
        return jsonify({"message": "Vous n'avez pas accès à cette activité"}), 403
    plan = CsrPlan.query.get(a.plan_id)
    if plan and not _plan_is_editable(plan):
        return jsonify({"message": "Plan validé (verrouillé) ou période d'ouverture expirée. Utilisez une demande de modification."}), 403
    old_snapshot = snapshot_activity(a)
    audit_delete(
        user_id=request.user_id,
        site_id=_activity_site_id(a),
        entity_type="ACTIVITY",
        entity_id=activity_id,
        description=f"Suppression activité {a.title or a.activity_number}",
        old_snapshot=old_snapshot,
    )
    db.session.delete(a)
    db.session.commit()
    return jsonify({"message": "Activité supprimée"}), 200
