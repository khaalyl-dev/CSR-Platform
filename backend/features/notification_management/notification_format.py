"""Shared JSON shape for notifications (HTTP + WebSocket)."""
from models import Notification


def _notification_type_json(n: Notification) -> str:
    """JSON-safe type string (SQLAlchemy/MySQL Enum may not jsonify cleanly)."""
    t = n.type
    if t is None:
        return "info"
    if isinstance(t, str):
        return t.strip() or "info"
    v = getattr(t, "value", None)
    if isinstance(v, str) and v.strip():
        return v.strip()
    return str(t).strip() or "info"


def target_route_for_notification(n: Notification):
    if n.entity_type == "PLAN" and n.entity_id:
        return f"/csr-plans/{n.entity_id}"
    if n.entity_type == "CHANGE_REQUEST" and n.entity_id:
        return f"/changes/{n.entity_id}"
    return None


def notification_to_json(n: Notification) -> dict:
    return {
        "id": n.id,
        "user_id": n.user_id,
        "site_id": n.site_id,
        "title": n.title,
        "message": n.message,
        "type": _notification_type_json(n),
        "is_read": n.is_read,
        "entity_type": n.entity_type,
        "entity_id": n.entity_id,
        "target_route": target_route_for_notification(n),
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }
