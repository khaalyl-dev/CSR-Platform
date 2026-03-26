"""
CSR activities within plans endpoints.
"""
from datetime import date, datetime
from flask import Blueprint, request, jsonify

from core import db, token_required
from models import CsrActivity, CsrPlan, UserSite, RealizedCsr, Category, ExternalPartner, Validation
from features.notification_management.notification_helper import notify_corporate, notify_site_users
from features.audit_history_management.audit_helper import (
    audit_create,
    audit_update,
    audit_delete,
    snapshot_activity,
    write_audit,
)
from features.csr_plan_management.csr_plans_routes import _user_can_access_site, _user_has_grade


def _is_corporate(role: str) -> bool:
    return (role or "").upper() in ("CORPORATE_USER", "CORPORATE")


def _plan_is_editable(plan: CsrPlan, role: str = "") -> bool:
    """True if plan can be edited: corporate always; otherwise DRAFT/REJECTED, or VALIDATED with unlock_until in the future."""
    if _is_corporate(role):
        return True
    unlock_until = getattr(plan, "unlock_until", None)
    now = datetime.utcnow()
    if plan.status in ("DRAFT", "REJECTED"):
        return True
    if plan.status == "VALIDATED" and unlock_until and now <= unlock_until:
        return True
    return False


def _activity_is_editable(activity: CsrActivity, role: str = "") -> bool:
    """True if this activity can be edited: corporate always, otherwise plan editable OR activity individually unlocked."""
    if _is_corporate(role):
        return True
    if not activity or not activity.plan:
        return False
    if getattr(activity, "is_off_plan", False) and activity.status == "SUBMITTED":
        return False
    if not getattr(activity, "is_off_plan", False) and activity.status == "SUBMITTED":
        return False
    if getattr(activity, "is_off_plan", False) and activity.status == "REJECTED":
        return True
    if not getattr(activity, "is_off_plan", False) and activity.status == "REJECTED":
        return True
    if _plan_is_editable(activity.plan, role):
        return True
    # Activity-level unlock (change request approved for this activity only)
    unlock_until = getattr(activity, "unlock_until", None)
    if unlock_until and datetime.utcnow() <= unlock_until:
        return True
    return False

bp = Blueprint("csr_activities", __name__, url_prefix="/api/csr-activities")


def _get_or_create_activity_validation(activity_id: str, site_id: str, grade: str) -> Validation:
    v = Validation.query.filter_by(
        entity_type="ACTIVITY", entity_id=activity_id, grade=grade
    ).first()
    if v:
        return v
    v = Validation(
        entity_type="ACTIVITY",
        entity_id=activity_id,
        site_id=site_id,
        grade=grade,
        status="PENDING",
    )
    db.session.add(v)
    return v


def _activity_validation_grade(a: CsrActivity) -> str:
    """Grade (level_1 / level_2) for the current off-plan validation step."""
    mode = getattr(a, "off_plan_validation_mode", None) or "101"
    step = getattr(a, "off_plan_validation_step", None)
    if mode == "111" and step == 1:
        return "level_1"
    return "level_2"


def _activity_to_json(a: CsrActivity):
    return {
        "id": a.id,
        "plan_id": a.plan_id,
        "activity_number": a.activity_number or "",
        "title": a.title or "",
        "description": a.description or None,
        "category_id": a.category_id,
        "status": a.status,
        "is_off_plan": bool(getattr(a, "is_off_plan", False)),
        "planned_budget": float(a.planned_budget) if a.planned_budget is not None else None,
        "organization": a.organization or None,
        "collaboration_nature": a.collaboration_nature or None,
        "organizer": a.organizer or None,
        "planned_volunteers": a.planned_volunteers,
        "action_impact_target": float(a.action_impact_target) if a.action_impact_target is not None else None,
        "action_impact_unit": a.action_impact_unit or None,
        "edition": a.edition,
        "start_year": a.start_year,
        "external_partner_name": a.external_partner.name if getattr(a, "external_partner", None) else None,
        "off_plan_validation_mode": getattr(a, "off_plan_validation_mode", None),
        "off_plan_validation_step": getattr(a, "off_plan_validation_step", None),
    }


def _activity_to_json_with_plan(a: CsrActivity, role: str = ""):
    """Include plan and category info for list views."""
    out = _activity_to_json(a)
    if a.plan:
        out["site_id"] = a.plan.site_id
        out["site_name"] = a.plan.site.name if a.plan.site else None
        out["site_code"] = a.plan.site.code if a.plan.site else None
        out["year"] = a.plan.year
        out["plan_status"] = a.plan.status
        out["plan_editable"] = _activity_is_editable(a, role)
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
    return jsonify([_activity_to_json_with_plan(a, role) for a in activities]), 200


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
    if not _plan_is_editable(plan, getattr(request, "role", "")):
        return jsonify(
            {
                "message": "Création d’activité autorisée uniquement pour un plan modifiable (brouillon, rejeté, ou validé pendant la période d’ouverture).",
            }
        ), 403

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


@bp.post("/plan-realized-draft")
@token_required
def create_plan_realized_draft_with_realization():
    """
    Plan d'une année civile passée, modifiable : activité en DRAFT (pas hors plan) + ligne realized_csr.
    Pas de validation par activité ni notification (l'utilisateur soumet le plan entier ensuite).
    """
    data = request.get_json()
    if not data:
        return jsonify({"message": "Données manquantes"}), 400

    plan_id = data.get("plan_id")
    if not plan_id:
        return jsonify({"message": "plan_id est obligatoire"}), 400

    if not _user_can_access_plan(request.user_id, plan_id, getattr(request, "role", "")):
        return jsonify({"message": "Vous n'avez pas accès à ce plan"}), 403

    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    if not _plan_is_editable(plan, getattr(request, "role", "")):
        return jsonify({"message": "Plan non modifiable"}), 403

    plan_year = plan.year
    current_year = datetime.utcnow().year
    if plan_year >= current_year:
        return jsonify(
            {"message": "Cette création enrichie est réservée aux plans d'une année civile passée."},
        ), 400

    def _num(key, default=None):
        v = data.get(key)
        if v is None or v == "":
            return default
        try:
            return float(v) if isinstance(v, (int, float)) else float(v)
        except (TypeError, ValueError):
            return default

    def _int_val(key, default=None):
        v = data.get(key)
        if v is None or v == "":
            return default
        try:
            return int(v)
        except (TypeError, ValueError):
            return default

    def _str_val(key, default=None):
        v = data.get(key)
        return str(v).strip() if v is not None and str(v).strip() else default

    activity_number = (data.get("activity_number") or "").strip()
    title = (data.get("title") or "").strip()
    if not activity_number or not title:
        return jsonify({"message": "activity_number et title sont obligatoires"}), 400
    if len(title) > 255:
        title = title[:255]
    if len(activity_number) > 50:
        return jsonify({"message": "activity_number ne doit pas dépasser 50 caractères"}), 400

    existing = CsrActivity.query.filter_by(plan_id=plan_id, activity_number=activity_number).first()
    if existing:
        return jsonify({"message": "Une activité avec ce numéro existe déjà dans ce plan"}), 400

    description = (data.get("description") or "").strip() or None
    if description and len(description) > 65535:
        description = description[:65535]

    category_id = (data.get("category_id") or "").strip()
    if not category_id:
        return jsonify({"message": "category_id est obligatoire"}), 400
    if not Category.query.get(category_id):
        return jsonify({"message": "Catégorie introuvable"}), 400

    collaboration_nature = _str_val("collaboration_nature")
    if collaboration_nature and len(collaboration_nature) > 30:
        collaboration_nature = collaboration_nature[:30]

    edition = _int_val("edition")
    start_year = _int_val("start_year")
    organizer = _str_val("organizer")

    external_partner_name = _str_val("external_partner")
    external_partner_id = None
    if external_partner_name:
        key = external_partner_name.strip().lower()
        ep = ExternalPartner.query.filter(db.func.lower(ExternalPartner.name) == key).first()
        if not ep:
            ep = ExternalPartner(name=external_partner_name, type="OTHER")
            db.session.add(ep)
            db.session.flush()
        external_partner_id = ep.id

    comment = _str_val("comment")
    contact_name = _str_val("contact_name")

    realization_date = None
    rd = data.get("realization_date")
    if rd:
        try:
            realization_date = datetime.strptime(str(rd)[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            realization_date = None

    year = plan_year
    if realization_date:
        if realization_date.year != plan_year:
            return jsonify(
                {"message": f"La date de réalisation doit être comprise dans l'année du plan ({plan_year})."},
            ), 400
        month = realization_date.month
    else:
        month = data.get("month")
        if month is not None:
            try:
                month = int(month)
            except (TypeError, ValueError):
                return jsonify({"message": "month doit être un entier"}), 400
        else:
            month = 12
        if month < 1 or month > 12:
            return jsonify({"message": "month doit être entre 1 et 12"}), 400

    rb = _num("realized_budget")

    a = CsrActivity(
        plan_id=plan_id,
        category_id=category_id,
        activity_number=activity_number,
        title=title,
        description=description,
        organization="INTERNAL",
        collaboration_nature=collaboration_nature,
        organizer=organizer,
        edition=edition,
        start_year=start_year,
        planned_budget=rb,
        planned_volunteers=None,
        action_impact_target=None,
        action_impact_unit=None,
        external_partner_id=external_partner_id,
        status="DRAFT",
        is_off_plan=False,
        off_plan_validation_mode=None,
        off_plan_validation_step=None,
    )
    db.session.add(a)
    db.session.flush()

    r = RealizedCsr(
        activity_id=a.id,
        year=year,
        month=month,
        realized_budget=rb,
        participants=_int_val("participants"),
        total_hc=_int_val("total_hc"),
        percentage_employees=_num("percentage_employees"),
        volunteer_hours=None,
        action_impact_actual=_num("action_impact_actual"),
        action_impact_unit=_str_val("action_impact_unit_realized"),
        impact_description=None,
        organizer=organizer,
        number_external_partners=_int_val("number_external_partners"),
        realization_date=realization_date,
        comment=comment,
        contact_department=_str_val("contact_department"),
        contact_name=contact_name,
        contact_email=_str_val("contact_email"),
        created_by=request.user_id,
    )
    db.session.add(r)

    audit_create(
        user_id=request.user_id,
        site_id=plan.site_id,
        entity_type="ACTIVITY",
        entity_id=a.id,
        description=f"Création activité (plan année réalisée, brouillon) {a.title or a.activity_number}",
        new_snapshot=snapshot_activity(a),
    )
    db.session.commit()

    out = _activity_to_json(a)
    out["site_id"] = plan.site_id
    return jsonify({"activity": out, "realization": {"id": r.id, "activity_id": a.id}}), 201


@bp.post("/off-plan-realization")
@token_required
def create_off_plan_realization():
    """Create an off-plan activity and one RealizedCsr row; notify corporate with chosen validation mode."""
    data = request.get_json()
    if not data:
        return jsonify({"message": "Données manquantes"}), 400

    plan_id = data.get("plan_id")
    if not plan_id:
        return jsonify({"message": "plan_id est obligatoire"}), 400

    role = (getattr(request, "role", "") or "").upper()
    corporate_submit = _is_corporate(role)

    if not _user_can_access_plan(request.user_id, plan_id, getattr(request, "role", "")):
        return jsonify({"message": "Vous n'avez pas accès à ce plan"}), 403

    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    # Off-plan activities: allow only when the plan is VALIDATED (even if the unlock period expired/locked).
    if getattr(plan, "status", None) != "VALIDATED" and not corporate_submit:
        return jsonify({"message": f"Les activités hors plan ne peuvent être soumises que pour un plan validé. Statut actuel: {getattr(plan, 'status', None)}"}), 403

    plan_year = plan.year

    vm = (data.get("validation_mode") or "101").strip()
    if vm not in ("101", "111"):
        vm = "101"
    mode_label = (
        "Corporate uniquement (101)"
        if vm == "101"
        else "Tous niveaux — manager puis corporate (111)"
    )

    def _num(key, default=None):
        v = data.get(key)
        if v is None or v == "":
            return default
        try:
            return float(v) if isinstance(v, (int, float)) else float(v)
        except (TypeError, ValueError):
            return default

    def _int_val(key, default=None):
        v = data.get(key)
        if v is None or v == "":
            return default
        try:
            return int(v)
        except (TypeError, ValueError):
            return default

    def _str_val(key, default=None):
        v = data.get(key)
        return str(v).strip() if v is not None and str(v).strip() else default

    activity_number = (data.get("activity_number") or "").strip()
    title = (data.get("title") or "").strip()
    if not activity_number or not title:
        return jsonify({"message": "activity_number et title sont obligatoires"}), 400
    if len(title) > 255:
        title = title[:255]
    if len(activity_number) > 50:
        return jsonify({"message": "activity_number ne doit pas dépasser 50 caractères"}), 400

    existing = CsrActivity.query.filter_by(plan_id=plan_id, activity_number=activity_number).first()
    if existing:
        return jsonify({"message": "Une activité avec ce numéro existe déjà dans ce plan"}), 400

    description = (data.get("description") or "").strip() or None
    if description and len(description) > 65535:
        description = description[:65535]

    category_id = (data.get("category_id") or "").strip()
    if not category_id:
        return jsonify({"message": "category_id est obligatoire"}), 400
    if not Category.query.get(category_id):
        return jsonify({"message": "Catégorie introuvable"}), 400

    collaboration_nature = _str_val("collaboration_nature")
    if collaboration_nature and len(collaboration_nature) > 30:
        collaboration_nature = collaboration_nature[:30]

    edition = _int_val("edition")
    start_year = _int_val("start_year")
    organizer = _str_val("organizer")

    external_partner_name = _str_val("external_partner")
    external_partner_id = None
    if external_partner_name:
        key = external_partner_name.strip().lower()
        ep = ExternalPartner.query.filter(db.func.lower(ExternalPartner.name) == key).first()
        if not ep:
            ep = ExternalPartner(name=external_partner_name, type="OTHER")
            db.session.add(ep)
            db.session.flush()
        external_partner_id = ep.id

    comment = _str_val("comment")
    contact_name = _str_val("contact_name")

    realization_date = None
    rd = data.get("realization_date")
    if rd:
        try:
            realization_date = datetime.strptime(str(rd)[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            realization_date = None

    # Année de réalisation = année du plan ; la date (si fournie) doit être dans cette année civile.
    year = plan_year
    if realization_date:
        if realization_date.year != plan_year:
            return jsonify(
                {"message": f"La date de réalisation doit être comprise dans l'année du plan ({plan_year})."},
            ), 400
        month = realization_date.month
    else:
        month = data.get("month")
        if month is not None:
            try:
                month = int(month)
            except (TypeError, ValueError):
                return jsonify({"message": "month doit être un entier"}), 400
        else:
            month = datetime.utcnow().month
        if month < 1 or month > 12:
            return jsonify({"message": "month doit être entre 1 et 12"}), 400

    a = CsrActivity(
        plan_id=plan_id,
        category_id=category_id,
        activity_number=activity_number,
        title=title,
        description=description,
        organization="INTERNAL",
        collaboration_nature=collaboration_nature,
        organizer=organizer,
        edition=edition,
        start_year=start_year,
        planned_budget=None,
        planned_volunteers=None,
        action_impact_target=None,
        action_impact_unit=None,
        external_partner_id=external_partner_id,
        status="VALIDATED" if corporate_submit else "SUBMITTED",
        is_off_plan=True,
        off_plan_validation_mode=None if corporate_submit else vm,
        off_plan_validation_step=None if corporate_submit else (1 if vm == "111" else 2),
    )
    db.session.add(a)
    db.session.flush()

    r = RealizedCsr(
        activity_id=a.id,
        year=year,
        month=month,
        realized_budget=_num("realized_budget"),
        participants=_int_val("participants"),
        total_hc=_int_val("total_hc"),
        percentage_employees=_num("percentage_employees"),
        volunteer_hours=None,
        action_impact_actual=_num("action_impact_actual"),
        action_impact_unit=_str_val("action_impact_unit_realized"),
        impact_description=None,
        organizer=organizer,
        number_external_partners=_int_val("number_external_partners"),
        realization_date=realization_date,
        comment=comment,
        contact_department=_str_val("contact_department"),
        contact_name=contact_name,
        contact_email=_str_val("contact_email"),
        created_by=request.user_id,
    )
    db.session.add(r)

    if not corporate_submit:
        if vm == "111":
            _get_or_create_activity_validation(a.id, plan.site_id, "level_1")
        else:
            _get_or_create_activity_validation(a.id, plan.site_id, "level_2")

    audit_create(
        user_id=request.user_id,
        site_id=plan.site_id,
        entity_type="ACTIVITY",
        entity_id=a.id,
        description=f"Création activité hors plan {a.title or a.activity_number}",
        new_snapshot=snapshot_activity(a),
    )
    db.session.commit()

    site_name = plan.site.name if plan.site else "Site inconnu"
    if corporate_submit:
        notify_site_users(
            plan.site_id,
            title="Activité hors plan validée",
            message=(
                f"L'activité hors plan {a.activity_number}: {a.title} (plan {plan.year}, {site_name}) a été validée."
            ),
            type="success",
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    elif vm == "111":
        notify_site_users(
            site_id=plan.site_id,
            title="Activité hors plan — validation niveau 1",
            message=(
                f"Une activité hors plan ({a.activity_number}: {a.title}) pour le plan {plan.year} "
                f"({site_name}) attend la validation niveau 1."
            ),
            type="info",
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    else:
        notify_corporate(
            title="Activité hors plan — validation corporate",
            message=(
                f"Le site {site_name} a déclaré une activité hors plan pour le plan {plan.year} "
                f"({a.activity_number}: {a.title}). Mode 101 (corporate uniquement). "
                f"Réalisation : {month}/{year}."
            ),
            type="info",
            site_id=plan.site_id,
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )

    out = _activity_to_json(a)
    out["site_id"] = plan.site_id
    return jsonify({"activity": out, "realization": {"id": r.id, "activity_id": a.id}}), 201


@bp.patch("/<string:activity_id>/submit-modification-review")
@token_required
def submit_activity_modification_review(activity_id: str):
    """Après déverrouillage d'une activité seule (plan validé, pas unlock plan) : envoyer les changements pour validation (101/111)."""
    a = CsrActivity.query.get(activity_id)
    if not a:
        return jsonify({"message": "Activité introuvable"}), 404
    plan = a.plan
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    if plan.status != "VALIDATED":
        return jsonify({"message": "Le plan doit être validé"}), 400
    if _plan_is_editable(plan, getattr(request, "role", "")):
        return jsonify({"message": "Utilisez la soumission du plan pour les modifications globales"}), 400
    if getattr(a, "is_off_plan", False):
        return jsonify({"message": "Réservé aux activités du plan annuel"}), 400
    if a.status == "SUBMITTED":
        return jsonify({"message": "Cette activité est déjà en attente de validation"}), 400
    if not _user_can_access_plan(request.user_id, a.plan_id, getattr(request, "role", "")):
        return jsonify({"message": "Vous n'avez pas accès à cette activité"}), 403
    now = datetime.utcnow()
    unlock_until = getattr(a, "unlock_until", None)
    if unlock_until is None or now > unlock_until:
        return jsonify({"message": "La fenêtre de modification de cette activité a expiré"}), 400

    role = (getattr(request, "role", "") or "").upper()
    vm = (getattr(plan, "validation_mode", None) or "101").strip()
    if vm not in ("101", "111"):
        vm = "101"
    if _is_corporate(role):
        a.off_plan_validation_mode = None
        a.off_plan_validation_step = None
        a.status = "VALIDATED"
    else:
        a.off_plan_validation_mode = vm
        a.off_plan_validation_step = 1 if vm == "111" else 2
        a.status = "SUBMITTED"
    a.unlock_until = None
    a.unlock_since = None

    if not _is_corporate(role):
        Validation.query.filter_by(entity_type="ACTIVITY", entity_id=activity_id).delete(synchronize_session=False)
        if vm == "111":
            _get_or_create_activity_validation(a.id, plan.site_id, "level_1")
        else:
            _get_or_create_activity_validation(a.id, plan.site_id, "level_2")

    write_audit(
        request.user_id,
        plan.site_id,
        "UPDATE",
        "ACTIVITY",
        activity_id,
        "Soumission modification activité (plan validé) pour validation",
    )
    db.session.commit()

    site_name = plan.site.name if plan.site else "Site inconnu"
    if _is_corporate(role):
        notify_site_users(
            plan.site_id,
            title="Modification d'activité validée",
            message=(
                f"La modification de l'activité {a.activity_number}: {a.title} (plan {plan.year}, {site_name}) "
                f"a été validée."
            ),
            type="success",
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    elif vm == "111":
        notify_site_users(
            site_id=plan.site_id,
            title="Modification d'activité — validation niveau 1",
            message=(
                f"Une modification d'activité ({a.activity_number}: {a.title}) pour le plan {plan.year} "
                f"({site_name}) attend la validation niveau 1."
            ),
            type="info",
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    else:
        notify_corporate(
            title="Modification d'activité — validation corporate",
            message=(
                f"Le site {site_name} a soumis une modification d'activité pour le plan {plan.year} "
                f"({a.activity_number}: {a.title}). Mode 101."
            ),
            type="info",
            site_id=plan.site_id,
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    return jsonify(_activity_to_json(a)), 200


@bp.patch("/<string:activity_id>/approve")
@token_required
def approve_off_plan_activity(activity_id: str):
    """
    Approuver une activité hors plan soumise, ou une modification d'activité sur plan validé (SUBMITTED).
    Mode 101: corporate valide (étape 2).
    Mode 111: niveau 1 site puis corporate (étape 2).
    """
    a = CsrActivity.query.get(activity_id)
    if not a:
        return jsonify({"message": "Activité introuvable"}), 404
    if a.status != "SUBMITTED":
        return jsonify({"message": "Seules les activités en attente de validation peuvent être approuvées"}), 400

    plan = a.plan
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404

    is_off = getattr(a, "is_off_plan", False)
    in_plan_mod_review = not is_off and plan.status == "VALIDATED"
    if not is_off and not in_plan_mod_review:
        return jsonify({"message": "Réservé aux activités hors plan ou aux modifications soumises sur plan validé"}), 400

    role = (getattr(request, "role", "") or "").upper()
    mode = getattr(a, "off_plan_validation_mode", None) or "101"
    step = getattr(a, "off_plan_validation_step", None)
    step = int(step) if step is not None else None

    grade = _activity_validation_grade(a)
    v = _get_or_create_activity_validation(a.id, plan.site_id, grade)

    if mode == "111" and step == 1:
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Accès refusé"}), 403
        if not _user_has_grade(request.user_id, plan.site_id, "level_1"):
            return jsonify({"message": "Seul un validateur niveau 1 de ce site peut approuver à cette étape"}), 403
        v.status = "APPROVED"
        v.validated_by = request.user_id
        v.validated_at = datetime.utcnow()
        a.off_plan_validation_step = 2
        _get_or_create_activity_validation(a.id, plan.site_id, "level_2")
        audit_msg = (
            "Validation niveau 1 modification activité (plan validé)"
            if in_plan_mod_review
            else "Validation niveau 1 activité hors plan"
        )
        write_audit(request.user_id, plan.site_id, "APPROVE", "ACTIVITY", activity_id, audit_msg)
        db.session.commit()
        site_name = plan.site.name if plan.site else "Site inconnu"
        title = (
            "Modification d'activité — validation corporate"
            if in_plan_mod_review
            else "Activité hors plan — validation corporate"
        )
        msg = (
            f"La modification ({a.activity_number}: {a.title}), plan {plan.year}, site {site_name}, "
            f"attend la validation corporate."
            if in_plan_mod_review
            else (
                f"L'activité hors plan ({a.activity_number}: {a.title}), plan {plan.year}, site {site_name}, "
                f"attend la validation corporate."
            )
        )
        notify_corporate(
            title=title,
            message=msg,
            type="info",
            site_id=plan.site_id,
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
        return jsonify(_activity_to_json(a)), 200

    if role not in ("CORPORATE_USER", "CORPORATE"):
        return jsonify({"message": "Seul un utilisateur corporate peut valider à cette étape"}), 403

    v.status = "APPROVED"
    v.validated_by = request.user_id
    v.validated_at = datetime.utcnow()
    a.status = "VALIDATED"
    a.off_plan_validation_step = None
    a.off_plan_validation_mode = None
    audit_desc = (
        f"Modification activité validée: {a.title or a.activity_number}"
        if in_plan_mod_review
        else f"Activité hors plan validée: {a.title or a.activity_number}"
    )
    write_audit(request.user_id, plan.site_id, "APPROVE", "ACTIVITY", activity_id, audit_desc)
    db.session.commit()

    site_name = plan.site.name if plan.site else "Site inconnu"
    if in_plan_mod_review:
        notify_site_users(
            plan.site_id,
            title="Modification d'activité validée",
            message=(
                f"La modification de l'activité {a.activity_number}: {a.title} (plan {plan.year}, {site_name}) "
                f"a été validée."
            ),
            type="success",
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    else:
        notify_site_users(
            plan.site_id,
            title="Activité hors plan validée",
            message=(
                f"L'activité hors plan {a.activity_number}: {a.title} (plan {plan.year}, {site_name}) a été validée."
            ),
            type="success",
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    return jsonify(_activity_to_json(a)), 200


@bp.patch("/<string:activity_id>/reject")
@token_required
def reject_off_plan_activity(activity_id: str):
    """Rejeter une activité hors plan soumise (motif obligatoire)."""
    data = request.get_json() or {}
    motif = (data.get("comment") or data.get("motif") or "").strip()
    if not motif:
        return jsonify({"message": "Un motif de rejet est obligatoire"}), 400

    a = CsrActivity.query.get(activity_id)
    if not a:
        return jsonify({"message": "Activité introuvable"}), 404
    if a.status != "SUBMITTED":
        return jsonify({"message": "Seules les activités en attente de validation peuvent être rejetées"}), 400

    plan = a.plan
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404

    is_off = getattr(a, "is_off_plan", False)
    in_plan_mod_review = not is_off and plan.status == "VALIDATED"
    if not is_off and not in_plan_mod_review:
        return jsonify({"message": "Réservé aux activités hors plan ou aux modifications soumises sur plan validé"}), 400

    role = (getattr(request, "role", "") or "").upper()
    mode = getattr(a, "off_plan_validation_mode", None) or "101"
    step = getattr(a, "off_plan_validation_step", None)
    step = int(step) if step is not None else None

    if mode == "111" and step == 1:
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Accès refusé"}), 403
        if not _user_has_grade(request.user_id, plan.site_id, "level_1"):
            return jsonify({"message": "Seul un validateur niveau 1 de ce site peut rejeter à cette étape"}), 403
    else:
        if role not in ("CORPORATE_USER", "CORPORATE"):
            return jsonify({"message": "Seul un utilisateur corporate peut rejeter à cette étape"}), 403

    grade = _activity_validation_grade(a)
    v = _get_or_create_activity_validation(a.id, plan.site_id, grade)
    v.status = "REJECTED"
    v.comment = motif
    v.rejected_activity_ids = None
    v.validated_by = request.user_id
    v.validated_at = datetime.utcnow()

    a.status = "REJECTED"
    a.off_plan_validation_step = None
    a.off_plan_validation_mode = None
    if in_plan_mod_review:
        a.unlock_until = None
        a.unlock_since = None
    write_audit(
        request.user_id,
        plan.site_id,
        "REJECT",
        "ACTIVITY",
        activity_id,
        (
            f"Modification activité rejetée: {motif[:200]}"
            if in_plan_mod_review
            else f"Activité hors plan rejetée: {motif[:200]}"
        ),
    )
    db.session.commit()

    site_name = plan.site.name if plan.site else "Site inconnu"
    if in_plan_mod_review:
        notify_site_users(
            plan.site_id,
            title="Modification d'activité rejetée",
            message=(
                f"La modification de l'activité {a.activity_number}: {a.title} (plan {plan.year}, {site_name}) "
                f"a été rejetée. Motif: {motif}"
            ),
            type="error",
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    else:
        notify_site_users(
            plan.site_id,
            title="Activité hors plan rejetée",
            message=(
                f"L'activité hors plan {a.activity_number}: {a.title} (plan {plan.year}, {site_name}) a été rejetée. "
                f"Motif: {motif}"
            ),
            type="error",
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    return jsonify(_activity_to_json(a)), 200


@bp.patch("/<string:activity_id>/resubmit-off-plan")
@token_required
def resubmit_off_plan_activity(activity_id: str):
    """Après rejet : renvoyer en validation (activité hors plan ou modification sur plan validé)."""
    data = request.get_json() or {}
    a = CsrActivity.query.get(activity_id)
    if not a:
        return jsonify({"message": "Activité introuvable"}), 404
    if a.status != "REJECTED":
        return jsonify({"message": "Seules les activités rejetées peuvent être renvoyées"}), 400

    plan = a.plan
    if not plan or getattr(plan, "status", None) != "VALIDATED":
        return jsonify({"message": "Le plan doit être validé"}), 400

    if not _user_can_access_plan(request.user_id, a.plan_id, getattr(request, "role", "")):
        return jsonify({"message": "Vous n'avez pas accès à cette activité"}), 403

    is_off = getattr(a, "is_off_plan", False)
    in_plan_mod = not is_off
    if in_plan_mod and _plan_is_editable(plan, getattr(request, "role", "")):
        return jsonify({"message": "Utilisez la soumission du plan pour les modifications globales"}), 400

    default_vm = (getattr(plan, "validation_mode", None) or "101") if in_plan_mod else "101"
    raw_vm = data.get("validation_mode") or getattr(a, "off_plan_validation_mode", None) or default_vm
    vm = str(raw_vm or "101").strip()
    if vm not in ("101", "111"):
        vm = "101"
    role = (getattr(request, "role", "") or "").upper()
    if _is_corporate(role):
        a.off_plan_validation_mode = None
        a.off_plan_validation_step = None
        a.status = "VALIDATED"
    else:
        a.off_plan_validation_mode = vm
        a.off_plan_validation_step = 1 if vm == "111" else 2
        a.status = "SUBMITTED"

        Validation.query.filter_by(entity_type="ACTIVITY", entity_id=activity_id).delete(
            synchronize_session=False
        )
        if vm == "111":
            _get_or_create_activity_validation(a.id, plan.site_id, "level_1")
        else:
            _get_or_create_activity_validation(a.id, plan.site_id, "level_2")

    audit_desc = (
        "Renvoi modification activité (plan validé) pour validation"
        if in_plan_mod
        else "Renvoi activité hors plan pour validation"
    )
    write_audit(
        request.user_id,
        plan.site_id,
        "UPDATE",
        "ACTIVITY",
        activity_id,
        audit_desc,
    )
    db.session.commit()

    site_name = plan.site.name if plan.site else "Site inconnu"
    if _is_corporate(role):
        notify_site_users(
            plan.site_id,
            title=(
                "Modification d'activité validée"
                if in_plan_mod
                else "Activité hors plan validée"
            ),
            message=(
                f"La modification de l'activité {a.activity_number}: {a.title} (plan {plan.year}, {site_name}) a été validée."
                if in_plan_mod
                else f"L'activité hors plan {a.activity_number}: {a.title} (plan {plan.year}, {site_name}) a été validée."
            ),
            type="success",
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    elif vm == "111":
        notify_site_users(
            site_id=plan.site_id,
            title=(
                "Modification d'activité — validation niveau 1"
                if in_plan_mod
                else "Activité hors plan — validation niveau 1"
            ),
            message=(
                f"Une modification d'activité ({a.activity_number}: {a.title}) pour le plan {plan.year} "
                f"({site_name}) attend la validation niveau 1."
                if in_plan_mod
                else (
                    f"Une activité hors plan ({a.activity_number}: {a.title}) pour le plan {plan.year} "
                    f"({site_name}) attend la validation niveau 1."
                )
            ),
            type="info",
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    else:
        notify_corporate(
            title=(
                "Modification d'activité — validation corporate"
                if in_plan_mod
                else "Activité hors plan — validation corporate"
            ),
            message=(
                f"Le site {site_name} a renvoyé une modification d'activité pour le plan {plan.year} "
                f"({a.activity_number}: {a.title}). Mode 101."
                if in_plan_mod
                else (
                    f"Le site {site_name} a renvoyé une activité hors plan pour le plan {plan.year} "
                    f"({a.activity_number}: {a.title}). Mode 101."
                )
            ),
            type="info",
            site_id=plan.site_id,
            entity_type="ACTIVITY",
            entity_id=a.id,
            notification_category="activity_validation",
        )
    return jsonify(_activity_to_json(a)), 200


@bp.get("/<activity_id>")
@token_required
def get_activity(activity_id: str):
    """Get a single CSR activity by id (for edit). SITE_USER only if plan's site is allowed."""
    from sqlalchemy.orm import joinedload
    a = (
        CsrActivity.query.options(
            db.joinedload(CsrActivity.plan).joinedload(CsrPlan.site),
            db.joinedload(CsrActivity.category),
            db.joinedload(CsrActivity.external_partner),
        )
        .filter_by(id=activity_id)
        .first()
    )
    if not a:
        return jsonify({"message": "Activité introuvable"}), 404
    if not _user_can_access_plan(request.user_id, a.plan_id, getattr(request, "role", "")):
        return jsonify({"message": "Vous n'avez pas accès à cette activité"}), 403
    return jsonify(_activity_to_json_with_plan(a, getattr(request, "role", ""))), 200


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
    if not _activity_is_editable(a, getattr(request, "role", "")):
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
    if "edition" in data:
        a.edition = _int_val("edition")
    if "start_year" in data:
        a.start_year = _int_val("start_year")
    if "external_partner" in data:
        ext_name = _str_val("external_partner")
        if ext_name:
            key = ext_name.strip().lower()
            ep = ExternalPartner.query.filter(db.func.lower(ExternalPartner.name) == key).first()
            if not ep:
                ep = ExternalPartner(name=ext_name, type="OTHER")
                db.session.add(ep)
                db.session.flush()
            a.external_partner_id = ep.id
        else:
            a.external_partner_id = None
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
    if not _activity_is_editable(a, getattr(request, "role", "")):
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
    # Ensure realizations are removed (ORM/DB FK may otherwise try to null activity_id).
    RealizedCsr.query.filter_by(activity_id=activity_id).delete(synchronize_session=False)
    db.session.delete(a)
    db.session.commit()
    return jsonify({"message": "Activité supprimée"}), 200
