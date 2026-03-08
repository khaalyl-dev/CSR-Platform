from .auth_routes import bp as auth_bp
from .users_routes import bp as users_bp

__all__ = ["auth_bp", "users_bp"]
