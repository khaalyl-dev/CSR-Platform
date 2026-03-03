"""
CSR activities within plans endpoints.
"""
from flask import Blueprint, request, jsonify

from core import db, token_required
from models import CsrActivity, CsrPlan, UserSite

bp = Blueprint("csr_activities", __name__, url_prefix="/api/csr-activities")


def _activity_to_json(a: CsrActivity):
    return {
        "id": a.id,
        "plan_id": a.plan_id,
        "activity_number": a.activity_number or "",
        "title": a.title or "",
        "category_id": a.category_id,
        "status": a.status,
        "planned_budget": float(a.planned_budget) if a.planned_budget is not None else None,
    }


@bp.get("")
@token_required
def list_activities():
    """List CSR activities. Optional: plan_id. SITE_USER only sees activities of their sites' plans."""
    plan_id = request.args.get("plan_id")

    q = CsrActivity.query
    role = (getattr(request, "role", "") or "").upper()

    if role in ("SITE_USER", "SITE"):
        from models import CsrPlan
        user_sites = UserSite.query.filter_by(user_id=request.user_id, is_active=True).all()
        allowed_site_ids = [us.site_id for us in user_sites]
        if not allowed_site_ids:
            return jsonify([]), 200
        plan_ids = [p.id for p in CsrPlan.query.filter(CsrPlan.site_id.in_(allowed_site_ids)).all()]
        q = q.filter(CsrActivity.plan_id.in_(plan_ids))

    if plan_id:
        q = q.filter_by(plan_id=plan_id)

    activities = q.order_by(CsrActivity.plan_id, CsrActivity.activity_number).all()
    return jsonify([_activity_to_json(a) for a in activities]), 200


def _user_can_access_plan(user_id: str, plan_id: str, role: str) -> bool:
    role = (role or "").upper()
    if role not in ("SITE_USER", "SITE"):
        return True
    user_sites = UserSite.query.filter_by(user_id=user_id, is_active=True).all()
    allowed_site_ids = [us.site_id for us in user_sites]
    plan = CsrPlan.query.get(plan_id)
    return plan and plan.site_id in allowed_site_ids


@bp.post("")
@token_required
def create_activity():
    """Create a new CSR activity within a plan."""
    data = request.get_json()
    if not data:
        return jsonify({"message": "Données manquantes"}), 400

    plan_id = data.get("plan_id")
    category_id = data.get("category_id")
    activity_number = (data.get("activity_number") or "").strip()
    title = (data.get("title") or "").strip()

    if not plan_id or not category_id or not activity_number or not title:
        return jsonify({"message": "plan_id, category_id, activity_number et title sont obligatoires"}), 400

    if not _user_can_access_plan(request.user_id, plan_id, getattr(request, "role", "")):
        return jsonify({"message": "Vous n'avez pas accès à ce plan"}), 403

    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404

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
    db.session.commit()
    return jsonify(_activity_to_json(a)), 201
