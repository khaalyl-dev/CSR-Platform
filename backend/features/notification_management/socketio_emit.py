"""Push notification payloads to connected clients (best-effort; never raises)."""
import logging

from socketio_instance import socketio

from .notification_format import notification_to_json

logger = logging.getLogger(__name__)


def emit_tasks_updated_to_user(user_id: str) -> None:
    """Tell one user's clients to refetch `GET /api/tasks` (task bell)."""
    uid = str(user_id).strip()
    if not uid:
        return
    try:
        socketio.emit("tasks_updated", {}, room=f"user_{uid}", namespace="/")
    except Exception:
        logger.warning("socketio tasks_updated emit failed", exc_info=True)


def emit_tasks_refresh_for_request_actor() -> None:
    """After a mutation in a Flask request, refresh the acting user's task list."""
    try:
        from flask import has_request_context, request

        if not has_request_context():
            return
        uid = getattr(request, "user_id", None)
        if uid:
            emit_tasks_updated_to_user(str(uid).strip())
    except Exception:
        logger.warning("tasks_updated actor emit failed", exc_info=True)


def emit_tasks_updated_for_site_contributors(site_id: str) -> None:
    """Notify site users (level_0, level_1, unset grade) to refetch tasks (e.g. after change-request approval)."""
    sid = str(site_id).strip()
    if not sid:
        return
    try:
        from models import UserSite

        for us in UserSite.query.filter_by(site_id=sid, is_active=True).all():
            g = (us.grade or "").strip().lower()
            if g not in ("level_0", "level_1", ""):
                continue
            emit_tasks_updated_to_user(us.user_id)
    except Exception:
        logger.warning("tasks_updated site contributors emit failed", exc_info=True)


def emit_notification_to_user(user_id: str, notification) -> None:
    """Emit `notification` event to all sockets in room `user_{user_id}`."""
    if not user_id or notification is None:
        return
    uid = str(user_id).strip()
    if not uid:
        return
    try:
        payload = notification_to_json(notification)
        socketio.emit(
            "notification",
            payload,
            room=f"user_{uid}",
            namespace="/",
        )
        emit_tasks_updated_to_user(uid)
    except Exception:
        logger.warning("socketio emit failed", exc_info=True)
