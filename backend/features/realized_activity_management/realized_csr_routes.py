"""
Realized CSR activities endpoints.
List and create realized CSR records (saisie réalisations).
Create/update/delete only when the activity's plan is editable (user must submit a change request for locked plans).
"""
from datetime import datetime
from typing import Optional

from flask import Blueprint, request, jsonify

from core import db, token_required
from models import RealizedCsr, CsrActivity, CsrPlan, UserSite
from features.notification_management.notification_helper import notify_corporate

bp = Blueprint("realized_csr", __name__, url_prefix="/api/realized-csr")


def _plan_is_editable(plan: CsrPlan) -> bool:
    """True if plan can be edited: DRAFT/REJECTED always, or VALIDATED with unlock_until in the future."""
    unlock_until = getattr(plan, "unlock_until", None)
    now = datetime.utcnow()
    if plan.status in ("DRAFT", "REJECTED"):
        return True
    if plan.status == "VALIDATED" and unlock_until and now <= unlock_until:
        return True
    return False


def _activity_is_editable(activity: CsrActivity) -> bool:
    """True if this activity can be edited: plan editable OR activity individually unlocked."""
    if not activity or not activity.plan:
        return False
    if getattr(activity, "is_off_plan", False) and activity.status == "SUBMITTED":
        return False
    if getattr(activity, "is_off_plan", False) and activity.status == "REJECTED":
        return True
    if _plan_is_editable(activity.plan):
        return True
    unlock_until = getattr(activity, "unlock_until", None)
    if unlock_until and datetime.utcnow() <= unlock_until:
        return True
    return False


def _realized_to_json(r: RealizedCsr):
    act = r.activity
    plan = act.plan if act else None
    plan_editable = _activity_is_editable(act) if act else (plan and _plan_is_editable(plan))
    return {
        "id": r.id,
        "activity_id": r.activity_id,
        "activity_title": act.title if act else None,
        "activity_number": act.activity_number if act else None,
        "planned_budget": float(act.planned_budget) if act and act.planned_budget is not None else None,
        "plan_id": act.plan_id if act else None,
        "site_name": plan.site.name if plan and plan.site else None,
        "plan_status": plan.status if plan else None,
        "plan_editable": plan_editable,
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

    # Keep dashboard/list behavior (validated plans only), but when querying
    # a specific activity (edit screen), return its realizations regardless of plan status.
    q = q.join(RealizedCsr.activity).join(CsrActivity.plan)
    if not activity_id:
        q = q.filter(CsrPlan.status == "VALIDATED")

    records = q.order_by(RealizedCsr.year.desc(), RealizedCsr.month.desc(), RealizedCsr.created_at.desc()).all()
    return jsonify([_realized_to_json(r) for r in records]), 200


@bp.get("/<realized_id>")
@token_required
def get_realized(realized_id: str):
    """Get a single realized CSR record by id. SITE_USER only if activity belongs to their sites."""
    from sqlalchemy.orm import joinedload
    r = (
        RealizedCsr.query.options(
            joinedload(RealizedCsr.activity).joinedload(CsrActivity.plan).joinedload(CsrPlan.site),
        )
        .filter_by(id=realized_id)
        .first()
    )
    if not r:
        return jsonify({"message": "Réalisation introuvable"}), 404
    allowed = _allowed_activity_ids(request.user_id, getattr(request, "role", ""))
    if allowed is not None and r.activity_id not in allowed:
        return jsonify({"message": "Vous n'avez pas accès à cette réalisation"}), 403
    return jsonify(_realized_to_json(r)), 200


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

    activity = CsrActivity.query.options(db.joinedload(CsrActivity.plan)).get(activity_id)
    if not activity:
        return jsonify({"message": "Activité introuvable"}), 404

    plan_obj = activity.plan
    if not plan_obj:
        return jsonify({"message": "Plan introuvable pour cette activité"}), 404
    plan_year = plan_obj.year
    if year != plan_year:
        return jsonify({"message": f"L'année de réalisation doit être l'année du plan ({plan_year})."}), 400

    allowed = _allowed_activity_ids(request.user_id, getattr(request, "role", ""))
    if allowed is not None and activity_id not in allowed:
        return jsonify({"message": "Vous n'avez pas accès à cette activité"}), 403

    # Allow creating realizations even when plan is locked: submitting realized data records what was done,
    # it does not modify the planned activity. Activities with realizations are excluded from planned list.

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
    # Notify corporate only when the plan is not in DRAFT (e.g. VALIDATED plan)
    plan = r.activity.plan if r.activity else None
    if plan and getattr(plan, "status", None) != "DRAFT":
        site_name = plan.site.name if plan.site else "Site inconnu"
        activity_title = r.activity.title if r.activity else "Activité inconnue"
        notify_corporate(
            title="Activité réalisée soumise",
            message=f"Le site {site_name} a soumis une réalisation pour l'activité '{activity_title}' ({month}/{year}).",
            type="success",
            site_id=plan.site_id,
            notification_category="activity_validation",
        )
    return jsonify(_realized_to_json(r)), 201


@bp.put("/<realized_id>")
@token_required
def update_realized(realized_id: str):
    """Update a realized CSR record. Plan must be editable (submit a change request if locked)."""
    r = RealizedCsr.query.options(
        db.joinedload(RealizedCsr.activity).joinedload(CsrActivity.plan),
    ).get(realized_id)
    if not r:
        return jsonify({"message": "Réalisation introuvable"}), 404
    allowed = _allowed_activity_ids(request.user_id, getattr(request, "role", ""))
    if allowed is not None and r.activity_id not in allowed:
        return jsonify({"message": "Vous n'avez pas accès à cette réalisation"}), 403
    if not _activity_is_editable(r.activity):
        return jsonify({
            "message": "Le plan est verrouillé. Soumettez une demande de modification pour modifier cette réalisation."
        }), 403

    data = request.get_json()
    if not data:
        return jsonify({"message": "Données manquantes"}), 400

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

    year = data.get("year")
    month = data.get("month")
    if year is not None:
        try:
            r.year = int(year)
        except (TypeError, ValueError):
            pass
    if month is not None:
        try:
            m = int(month)
            if 1 <= m <= 12:
                r.month = m
        except (TypeError, ValueError):
            pass

    realization_date = None
    rd = data.get("realization_date")
    if rd:
        try:
            from datetime import datetime
            realization_date = datetime.strptime(rd[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass
    if realization_date is not None:
        r.realization_date = realization_date

    plan_year = r.activity.plan.year if r.activity and r.activity.plan else None
    if plan_year is not None:
        if r.year != plan_year:
            return jsonify({"message": f"L'année de réalisation doit être l'année du plan ({plan_year})."}), 400
        if r.realization_date is not None and r.realization_date.year != plan_year:
            return jsonify(
                {"message": f"La date de réalisation doit être comprise dans l'année du plan ({plan_year})."},
            ), 400

    r.realized_budget = _num("realized_budget", r.realized_budget)
    r.participants = _int_val("participants", r.participants)
    r.total_hc = _int_val("total_hc", r.total_hc)
    r.percentage_employees = _num("percentage_employees", r.percentage_employees)
    r.volunteer_hours = _num("volunteer_hours", r.volunteer_hours)
    r.action_impact_actual = _num("action_impact_actual", r.action_impact_actual)
    r.action_impact_unit = _str_val("action_impact_unit", r.action_impact_unit)
    r.impact_description = _str_val("impact_description", r.impact_description)
    r.organizer = _str_val("organizer", r.organizer)
    r.number_external_partners = _int_val("number_external_partners", r.number_external_partners)
    r.comment = _str_val("comment", r.comment)
    r.contact_department = _str_val("contact_department", r.contact_department)
    r.contact_name = _str_val("contact_name", r.contact_name)
    r.contact_email = _str_val("contact_email", r.contact_email)

    db.session.commit()
    return jsonify(_realized_to_json(r)), 200


@bp.delete("/<realized_id>")
@token_required
def delete_realized(realized_id: str):
    """Delete a realized CSR record. Plan must be editable (submit a change request if locked)."""
    r = RealizedCsr.query.options(
        db.joinedload(RealizedCsr.activity).joinedload(CsrActivity.plan),
    ).get(realized_id)
    if not r:
        return jsonify({"message": "Réalisation introuvable"}), 404
    allowed = _allowed_activity_ids(request.user_id, getattr(request, "role", ""))
    if allowed is not None and r.activity_id not in allowed:
        return jsonify({"message": "Vous n'avez pas accès à cette réalisation"}), 403
    if not _activity_is_editable(r.activity):
        return jsonify({
            "message": "Le plan est verrouillé. Soumettez une demande de modification pour supprimer cette réalisation."
        }), 403
    db.session.delete(r)
    db.session.commit()
    return jsonify({"message": "Réalisation supprimée"}), 200

