"""
Realized CSR activities endpoints.
List and create realized CSR records (saisie réalisations).
"""
from typing import Optional

from flask import Blueprint, request, jsonify

from core import db, token_required
from models import RealizedCsr, CsrActivity, CsrPlan, UserSite

bp = Blueprint("realized_csr", __name__, url_prefix="/api/realized-csr")


def _realized_to_json(r: RealizedCsr):
    act = r.activity
    plan = act.plan if act else None
    return {
        "id": r.id,
        "activity_id": r.activity_id,
        "activity_title": act.title if act else None,
        "activity_number": act.activity_number if act else None,
        "plan_id": act.plan_id if act else None,
        "site_name": plan.site.name if plan and plan.site else None,
        "year": r.year,
        "month": r.month,
        "realized_budget": float(r.realized_budget) if r.realized_budget is not None else None,
        "participants": r.participants,
        "total_hc": r.total_hc,
        "percentage_employees": float(r.percentage_employees) if r.percentage_employees is not None else None,
        "volunteer_hours": float(r.volunteer_hours) if r.volunteer_hours is not None else None,
        "action_impact_actual": float(r.action_impact_actual) if r.action_impact_actual is not None else None,
        "action_impact_unit": r.action_impact_unit or None,
        "impact_description": r.impact_description or None,
        "organizer": r.organizer or None,
        "number_external_partners": r.number_external_partners,
        "realization_date": r.realization_date.isoformat() if r.realization_date else None,
        "comment": r.comment or None,
        "contact_department": r.contact_department or None,
        "contact_name": r.contact_name or None,
        "contact_email": r.contact_email or None,
        "created_by": r.created_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _allowed_activity_ids(user_id: str, role: str) -> Optional[list]:
    """Return list of activity IDs the user can access, or None if corporate (all)."""
    role = (role or "").upper()
    if role not in ("SITE_USER", "SITE"):
        return None
    user_sites = UserSite.query.filter_by(user_id=user_id, is_active=True).all()
    allowed_site_ids = [us.site_id for us in user_sites]
    if not allowed_site_ids:
        return []
    plan_ids = [p.id for p in CsrPlan.query.filter(CsrPlan.site_id.in_(allowed_site_ids)).all()]
    return [a.id for a in CsrActivity.query.filter(CsrActivity.plan_id.in_(plan_ids)).all()]


@bp.get("")
@token_required
def list_realized():
    """List realized CSR. Optional: activity_id, year, month. SITE_USER only sees their sites' activities."""
    activity_id = request.args.get("activity_id")
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)

    q = RealizedCsr.query
    role = getattr(request, "role", "") or ""
    allowed = _allowed_activity_ids(request.user_id, role)
    if allowed is not None:
        if not allowed:
            return jsonify([]), 200
        q = q.filter(RealizedCsr.activity_id.in_(allowed))

    if activity_id:
        q = q.filter_by(activity_id=activity_id)
    if year is not None:
        q = q.filter_by(year=year)
    if month is not None:
        q = q.filter_by(month=month)

    records = q.order_by(RealizedCsr.year.desc(), RealizedCsr.month.desc(), RealizedCsr.created_at.desc()).all()
    return jsonify([_realized_to_json(r) for r in records]), 200


@bp.post("")
@token_required
def create_realized():
    """Create a realized CSR record."""
    data = request.get_json()
    if not data:
        return jsonify({"message": "Données manquantes"}), 400

    activity_id = data.get("activity_id")
    year = data.get("year")
    month = data.get("month")
    if not activity_id or year is None or month is None:
        return jsonify({"message": "activity_id, year et month sont obligatoires"}), 400

    try:
        year = int(year)
        month = int(month)
    except (TypeError, ValueError):
        return jsonify({"message": "year et month doivent être des entiers"}), 400

    if month < 1 or month > 12:
        return jsonify({"message": "month doit être entre 1 et 12"}), 400

    activity = CsrActivity.query.get(activity_id)
    if not activity:
        return jsonify({"message": "Activité introuvable"}), 404

    allowed = _allowed_activity_ids(request.user_id, getattr(request, "role", ""))
    if allowed is not None and activity_id not in allowed:
        return jsonify({"message": "Vous n'avez pas accès à cette activité"}), 403

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

    realization_date = None
    rd = data.get("realization_date")
    if rd:
        try:
            from datetime import datetime
            realization_date = datetime.strptime(rd[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass

    r = RealizedCsr(
        activity_id=activity_id,
        year=year,
        month=month,
        realized_budget=_num("realized_budget"),
        participants=_int_val("participants"),
        total_hc=_int_val("total_hc"),
        percentage_employees=_num("percentage_employees"),
        volunteer_hours=_num("volunteer_hours"),
        action_impact_actual=_num("action_impact_actual"),
        action_impact_unit=_str_val("action_impact_unit"),
        impact_description=_str_val("impact_description"),
        organizer=_str_val("organizer"),
        number_external_partners=_int_val("number_external_partners"),
        realization_date=realization_date,
        comment=_str_val("comment"),
        contact_department=_str_val("contact_department"),
        contact_name=_str_val("contact_name"),
        contact_email=_str_val("contact_email"),
        created_by=request.user_id,
    )
    db.session.add(r)
    db.session.commit()
    return jsonify(_realized_to_json(r)), 201
