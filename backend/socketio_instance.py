"""
Flask-SocketIO instance (shared app extension).

Real-time notifications: clients join room `user_{user_id}` after JWT auth on connect.
"""
from flask_socketio import SocketIO

socketio = SocketIO(
    async_mode="threading",
    cors_allowed_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://[::1]:4200",
    ],
    logger=False,
    engineio_logger=False,
)
