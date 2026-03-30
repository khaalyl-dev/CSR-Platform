"""Socket.IO: authenticate with JWT, join per-user room for notification pushes."""
from __future__ import annotations

import json
from typing import Optional

import jwt
from flask import request
from flask_socketio import disconnect, join_room

from core.jwt_utils import verify_access_token
from socketio_instance import socketio


def _user_room(user_id: str) -> str:
    return f"user_{user_id}"


def _extract_token(auth) -> Optional[str]:
    """Normalize auth from python-socketio (dict, JSON string, or None)."""
    if auth is None:
        return None
    if isinstance(auth, dict):
        t = auth.get("token") or auth.get("access_token")
        if isinstance(t, str) and t.strip():
            return t.strip()
        return None
    if isinstance(auth, str):
        s = auth.strip()
        if not s:
            return None
        if s.startswith("{"):
            try:
                data = json.loads(s)
                if isinstance(data, dict):
                    t = data.get("token") or data.get("access_token")
                    if isinstance(t, str) and t.strip():
                        return t.strip()
            except json.JSONDecodeError:
                pass
        return s
    return None


@socketio.on("connect")
def _handle_connect(auth=None):
    """Client sends JWT in Socket.IO `auth` (preferred) or query param `token`."""
    raw = _extract_token(auth)
    if not raw:
        raw = request.args.get("token")
    if raw:
        raw = raw.strip()
    if not raw:
        disconnect()
        return False
    try:
        payload = verify_access_token(raw)
    except jwt.InvalidTokenError:
        disconnect()
        return False
    uid = payload.get("user_id")
    if not uid:
        disconnect()
        return False
    uid = str(uid).strip()
    if not uid:
        disconnect()
        return False
    join_room(_user_room(uid), namespace="/")
    return True


@socketio.on("disconnect")
def _handle_disconnect():
    pass
