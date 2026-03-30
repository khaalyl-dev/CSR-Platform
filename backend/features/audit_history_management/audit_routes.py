"""
Audit logs endpoints. Corporate only.
List audit logs with optional filters.
"""
from datetime import datetime

from flask import Blueprint, request, jsonify

from core import db, token_required, role_required
from models.audit_log import AuditLog
from models.user import User
from models.site import Site

bp = Blueprint("audit", __name__, url_prefix="/api/audit")


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
