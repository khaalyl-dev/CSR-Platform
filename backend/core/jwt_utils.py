"""
JWT Token utilities for authentication.
"""
import jwt
import os
import uuid
from datetime import timedelta
from functools import wraps

from flask import request, jsonify

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
ACCESS_TOKEN_EXPIRATION_HOURS = int(os.environ.get("ACCESS_TOKEN_EXPIRATION_HOURS", "24"))
REVOKED_TOKENS_FILE = os.environ.get("REVOKED_TOKENS_FILE", "revoked_tokens.txt")


def generate_access_token(user_id, email: str, role: str = "SITE_USER") -> str:
    """Generate a JWT access token for a user."""
    from datetime import datetime

    jti = uuid.uuid4().hex
    payload = {
        "jti": jti,
        "user_id": user_id,
        "email": email,
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def verify_access_token(token: str) -> dict:
    """Verify and decode a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        jti = payload.get("jti")
        if jti:
            revoked = _load_revoked_jtis()
            if jti in revoked:
                raise jwt.InvalidTokenError("Token has been revoked")
        return payload
    except jwt.ExpiredSignatureError:
        raise jwt.InvalidTokenError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise jwt.InvalidTokenError(f"Invalid token: {str(e)}")


def _load_revoked_jtis() -> set:
    """Return a set of revoked JTIs from the revocation file."""
    try:
        with open(REVOKED_TOKENS_FILE, "r") as f:
            return {line.strip() for line in f if line.strip()}
    except FileNotFoundError:
        return set()


def revoke_jti(jti: str) -> None:
    """Persistently revoke a token by its JTI."""
    if not jti:
        return
    try:
        revoked = _load_revoked_jtis()
        if jti in revoked:
            return
        with open(REVOKED_TOKENS_FILE, "a") as f:
            f.write(f"{jti}\n")
    except Exception:
        pass


def token_required(f):
    """Decorator to protect endpoints that require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            try:
                token = request.headers["Authorization"].split(" ")[1]
            except IndexError:
                return jsonify({"message": "Invalid authorization header format"}), 400
        if not token:
            return jsonify({"message": "Authorization token is required"}), 401
        try:
            payload = verify_access_token(token)
            request.user_id = payload["user_id"]
            request.email = payload["email"]
            request.role = payload.get("role", "site")
            request.jti = payload.get("jti")
        except jwt.InvalidTokenError as e:
            return jsonify({"message": str(e)}), 401
        return f(*args, **kwargs)

    return decorated_function


def _role_matches(user_role: str, allowed: str) -> bool:
    """Check if user_role matches allowed (supports SITE_USER/site and CORPORATE_USER/corporate)."""
    if user_role == allowed:
        return True
    norm = {"SITE_USER": "site", "site": "site", "CORPORATE_USER": "corporate", "corporate": "corporate"}
    return norm.get(user_role) == norm.get(allowed)


def role_required(*allowed_roles):
    """Decorator to protect endpoints that require specific roles. Use after @token_required."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_role = getattr(request, "role", None)
            if not user_role:
                return jsonify({"message": "User role not found in token"}), 401
            if not any(_role_matches(user_role, a) for a in allowed_roles):
                return jsonify({"message": f"Access denied. Required role(s): {', '.join(allowed_roles)}"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator
