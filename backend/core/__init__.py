"""
Core - shared utilities (database, JWT, auth decorators).

Import from here: from core import db, token_required, role_required, generate_access_token
"""
from .db import db
from .jwt_utils import (
    generate_access_token,
    verify_access_token,
    token_required,
    role_required,
    revoke_jti,
)

__all__ = [
    "db",
    "generate_access_token",
    "verify_access_token",
    "token_required",
    "role_required",
    "revoke_jti",
]
