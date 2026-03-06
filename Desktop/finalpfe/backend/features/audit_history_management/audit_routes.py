"""
Audit logs and entity history endpoints. Corporate only.
List audit logs (with filters), rollback to a previous version via entity_history.
"""
from datetime import datetime
from decimal import Decimal

from flask import Blueprint, request, jsonify

from core import db, token_required, role_required
from models.audit_log import AuditLog
from models.entity_history import EntityHistory
from models.user import User
from models.site import Site
from models.csr_plan import CsrPlan
from models.csr_activity import CsrActivity
from features.notification_management.notification_helper import notify_corporate

bp = Blueprint("audit", __name__, url_prefix="/api/audit")


def _notify_rollback(detail: str, entity_type: str, entity_id: str, site_id: str = None):
    """Notify all corporate users that a rollback was performed."""
    type_label = "Plan" if entity_type == "PLAN" else "Activité"
    message = f"Rollback effectué : {detail}. Type : {type_label}. ID : {entity_id or '–'}."
    notify_corporate(
        title="Rollback (journal d'audit)",
        message=message,
        type="info",
        site_id=site_id,
        entity_type=entity_type,
        entity_id=entity_id or None,
    )


def _parse_datetime(s):
    if s is None:
        return None
    if isinstance(s, datetime):
        return s
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _apply_snapshot_to_plan(plan: CsrPlan, data: dict) -> None:
    """Set plan attributes from snapshot dict (for rollback)."""
    for key, value in data.items():
        if not hasattr(plan, key):
            continue
        if key in ("submitted_at", "validated_at", "created_at", "updated_at"):
            value = _parse_datetime(value)
        if key in ("total_budget",) and value is not None:
            value = Decimal(str(value))
        setattr(plan, key, value)


def _apply_snapshot_to_activity(activity: CsrActivity, data: dict) -> None:
    """Set activity attributes from snapshot dict (for rollback)."""
    for key, value in data.items():
        if not hasattr(activity, key):
            continue
        if key in ("start_date", "end_date") and value:
            if isinstance(value, str):
                value = datetime.strptime(value[:10], "%Y-%m-%d").date() if len(value) >= 10 else value
        if key in ("created_at", "updated_at"):
            value = _parse_datetime(value)
        if key in ("planned_budget", "action_impact_target", "kpi_value") and value is not None:
            value = Decimal(str(value))
        setattr(activity, key, value)


def _dict_to_plan_row(data: dict) -> dict:
    """Convert snapshot dict to column values for plan insert (restore after delete)."""
    out = {}
    for key, value in data.items():
        if key not in CsrPlan.__table__.columns.keys():
            continue
        if key in ("submitted_at", "validated_at", "created_at", "updated_at"):
            value = _parse_datetime(value)
        if key in ("total_budget",) and value is not None:
            value = Decimal(str(value))
        out[key] = value
    return out


def _dict_to_activity_row(data: dict) -> dict:
    """Convert snapshot dict to column values for activity insert."""
    from datetime import date
    out = {}
    for key, value in data.items():
        if key not in CsrActivity.__table__.columns.keys():
            continue
        if key in ("start_date", "end_date") and value:
            if isinstance(value, str) and len(value) >= 10:
                out[key] = date(int(value[:4]), int(value[5:7]), int(value[8:10]))
                continue
        if key in ("created_at", "updated_at"):
            value = _parse_datetime(value)
        if key in ("planned_budget", "action_impact_target", "kpi_value") and value is not None:
            value = Decimal(str(value))
        out[key] = value
    return out


@bp.route("/logs", methods=["GET"])
@token_required
@role_required("CORPORATE_USER", "corporate")
def list_logs():
    """
    List audit logs with optional filters. Corporate only.
    Query params: action, entity_type, site_id, user_id, date_from, date_to, limit.
    """
    q = AuditLog.query
    action = request.args.get("action")
    if action:
        q = q.filter(AuditLog.action == action.upper())
    entity_type = request.args.get("entity_type")
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type.upper())
    site_id = request.args.get("site_id")
    if site_id:
        q = q.filter(AuditLog.site_id == site_id)
    user_id = request.args.get("user_id")
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    date_from = request.args.get("date_from")
    if date_from:
        try:
            q = q.filter(AuditLog.created_at >= datetime.fromisoformat(date_from.replace("Z", "")))
        except ValueError:
            pass
    date_to = request.args.get("date_to")
    if date_to:
        try:
            q = q.filter(AuditLog.created_at <= datetime.fromisoformat(date_to.replace("Z", "")))
        except ValueError:
            pass
    q = q.order_by(AuditLog.created_at.desc())
    limit = request.args.get("limit", type=int)
    if limit and limit > 0:
        q = q.limit(min(limit, 500))
    logs = q.all()

    # Enrich with user name and site name
    user_ids = {log.user_id for log in logs if log.user_id}
    site_ids = {log.site_id for log in logs if log.site_id}
    users = {u.id: f"{u.first_name} {u.last_name}".strip() or u.email for u in User.query.filter(User.id.in_(user_ids)).all()} if user_ids else {}
    sites = {s.id: s.name for s in Site.query.filter(Site.id.in_(site_ids)).all()} if site_ids else {}

    out = []
    for log in logs:
        out.append({
            "id": log.id,
            "site_id": log.site_id,
            "site_name": sites.get(log.site_id),
            "user_id": log.user_id,
            "user_name": users.get(log.user_id),
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "description": log.description,
            "entity_history_id": log.entity_history_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return jsonify(out), 200


@bp.route("/rollback", methods=["POST"])
@token_required
@role_required("CORPORATE_USER", "corporate")
def rollback():
    """
    Rollback to the state before the change recorded in entity_history.
    Body: { "entity_history_id": "uuid" }.
    - DELETE: restore row from old_data.
    - CREATE: delete the created entity.
    - UPDATE: apply old_data to existing entity.
    """
    data = request.get_json(silent=True) or {}
    hist_id = data.get("entity_history_id")
    if not hist_id:
        return jsonify({"message": "entity_history_id obligatoire"}), 400

    hist = EntityHistory.query.get(hist_id)
    if not hist:
        return jsonify({"message": "Entrée d'historique introuvable"}), 404

    entity_type = (hist.entity_type or "").upper()
    if entity_type not in ("PLAN", "ACTIVITY"):
        return jsonify({"message": "Type d'entité non supporté pour le rollback"}), 400

    old_data = hist.old_data
    new_data = hist.new_data

    # DELETE: old_data set, new_data null -> re-insert
    if old_data is not None and new_data is None:
        if entity_type == "PLAN":
            existing = CsrPlan.query.get(hist.entity_id)
            if existing:
                return jsonify({"message": "Le plan existe déjà; impossible de restaurer un supprimé"}), 400
            row = _dict_to_plan_row(old_data)
            plan = CsrPlan(**row)
            db.session.add(plan)
        else:
            existing = CsrActivity.query.get(hist.entity_id)
            if existing:
                return jsonify({"message": "L'activité existe déjà; impossible de restaurer un supprimé"}), 400
            row = _dict_to_activity_row(old_data)
            # Use Core INSERT so no ORM instance is in the session (avoids flushing
            # RealizedCsr with activity_id=None when restoring a deleted activity).
            from sqlalchemy import insert
            stmt = insert(CsrActivity.__table__).values(**row)
            db.session.execute(stmt)
        db.session.commit()
        _notify_rollback("état restauré (suppression annulée)", entity_type, hist.entity_id, hist.site_id)
        return jsonify({"message": "État restauré (rollback suppression)", "entity_type": entity_type, "entity_id": hist.entity_id}), 200

    # CREATE: new_data set, old_data null -> delete the entity
    if new_data is not None and old_data is None:
        eid = hist.entity_id
        if entity_type == "PLAN":
            plan = CsrPlan.query.get(eid)
            if not plan:
                return jsonify({"message": "Plan déjà supprimé ou introuvable"}), 404
            db.session.delete(plan)
        else:
            activity = CsrActivity.query.get(eid)
            if not activity:
                return jsonify({"message": "Activité déjà supprimée ou introuvable"}), 404
            db.session.delete(activity)
        db.session.commit()
        _notify_rollback("création annulée", entity_type, eid, hist.site_id)
        return jsonify({"message": "Création annulée (rollback)", "entity_type": entity_type, "entity_id": eid}), 200

    # UPDATE: both set -> apply old_data to current row
    if old_data is not None and new_data is not None:
        eid = hist.entity_id
        if entity_type == "PLAN":
            plan = CsrPlan.query.get(eid)
            if not plan:
                return jsonify({"message": "Plan introuvable"}), 404
            _apply_snapshot_to_plan(plan, old_data)
        else:
            activity = CsrActivity.query.get(eid)
            if not activity:
                return jsonify({"message": "Activité introuvable"}), 404
            _apply_snapshot_to_activity(activity, old_data)
        db.session.commit()
        _notify_rollback("modification annulée", entity_type, eid, hist.site_id)
        return jsonify({"message": "Modification annulée (rollback)", "entity_type": entity_type, "entity_id": eid}), 200

    return jsonify({"message": "Données d'historique invalides"}), 400
