# notification_management

Notifications and user preferences.

---

## Files

| File | Purpose |
|------|---------|
| **notifications_routes.py** | Blueprint `/api/notifications`. List, mark as read, get unread count. |
| **notification_format.py** | Shared `notification_to_json()` for REST and WebSocket payloads. |
| **notification_helper.py** | `notify_corporate()`, `notify_site_users()`, `notify_user()`. Persists rows then pushes real-time events via Socket.IO. |
| **socketio_events.py** | Socket.IO: JWT in `auth.token` on connect; join room `user_{user_id}`. |
| **socketio_emit.py** | `emit_notification_to_user()` — server event `notification`. |
| **__init__.py** | Exports `notifications_bp`. |

**Real-time:** Run the API with `python app.py` (uses `socketio.run`). Socket path `/socket.io`; Angular dev proxies it (see `frontend/proxy.conf.json`). No polling for new alerts in the header bell.
