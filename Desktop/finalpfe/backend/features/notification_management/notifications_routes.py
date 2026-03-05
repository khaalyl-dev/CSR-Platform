import uuid
from flask import Blueprint, jsonify, request
from core import db, token_required
from models import Notification, User

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")

def _target_route(n: Notification):
    if n.entity_type == "PLAN" and n.entity_id:
        return f"/csr-plans/{n.entity_id}"
    if n.entity_type == "CHANGE_REQUEST" and n.entity_id:
        return f"/changes/{n.entity_id}"
    return None


def _notif_to_json(n: Notification):
    return {
        "id": n.id,
        "user_id": n.user_id,
        "site_id": n.site_id,
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "is_read": n.is_read,
        "entity_type": n.entity_type,
        "entity_id": n.entity_id,
        "target_route": _target_route(n),
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }

# ── GET /api/notifications ────────────────────────────────────────────────────
@bp.get("")
@token_required
def list_notifications():
    notifs = Notification.query.filter_by(
        user_id=request.user_id
    ).order_by(Notification.created_at.desc()).all()
    return jsonify([_notif_to_json(n) for n in notifs]), 200

# ── GET /api/notifications/unread-count ───────────────────────────────────────
@bp.get("/unread-count")
@token_required
def unread_count():
    count = Notification.query.filter_by(
        user_id=request.user_id,
        is_read=False
    ).count()
    return jsonify({"count": count}), 200

# ── PATCH /api/notifications/<id>/read ───────────────────────────────────────
@bp.patch("/<string:notif_id>/read")
@token_required
def mark_read(notif_id):
    notif = Notification.query.filter_by(
        id=notif_id,
        user_id=request.user_id
    ).first()
    if not notif:
        return jsonify({"message": "Notification introuvable"}), 404
    notif.is_read = True
    db.session.commit()
    return jsonify(_notif_to_json(notif)), 200

# ── PATCH /api/notifications/read-all ────────────────────────────────────────
@bp.patch("/read-all")
@token_required
def mark_all_read():
    Notification.query.filter_by(
        user_id=request.user_id,
        is_read=False
    ).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "Toutes les notifications marquées comme lues"}), 200

# ── DELETE /api/notifications/<id> ───────────────────────────────────────────
@bp.delete("/<string:notif_id>")
@token_required
def delete_notification(notif_id):
    notif = Notification.query.filter_by(
        id=notif_id,
        user_id=request.user_id
    ).first()
    if not notif:
        return jsonify({"message": "Notification introuvable"}), 404
    db.session.delete(notif)
    db.session.commit()
    return jsonify({"message": "Notification supprimée"}), 200