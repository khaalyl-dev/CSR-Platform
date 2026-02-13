"""
JWT Token utilities for authentication.
"""

import jwt
import os
import uuid
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
ACCESS_TOKEN_EXPIRATION_HOURS = int(os.environ.get("ACCESS_TOKEN_EXPIRATION_HOURS", "24"))

# File used to persist revoked token JTIs (one per line). Suitable for development.
REVOKED_TOKENS_FILE = os.environ.get("REVOKED_TOKENS_FILE", "revoked_tokens.txt")


def generate_access_token(user_id: int, email: str, role: str = "site") -> str:
  """
  Generate a JWT access token for a user.
  
  Args:
    user_id: User ID from database
    email: User email
    role: User role ('site' or 'corporate')
    
  Returns:
    JWT token string
  """
  jti = uuid.uuid4().hex
  payload = {
    "jti": jti,
    "user_id": user_id,
    "email": email,
    "role": role,
    "iat": datetime.utcnow(),
    "exp": datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRATION_HOURS)
  }
  
  token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
  return token


def verify_access_token(token: str) -> dict:
  """
  Verify and decode a JWT access token.
  
  Args:
    token: JWT token string
    
  Returns:
    Decoded payload dict
    
  Raises:
    jwt.InvalidTokenError: If token is invalid or expired
  """
  try:
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])

    # Check if token was revoked
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


def token_required(f):
  """
  Decorator to protect endpoints that require authentication.
  
  Usage:
    @app.get("/api/protected-endpoint")
    @token_required
    def protected_endpoint():
      # request.user_id, request.email, and request.role are available
      return jsonify({"message": "success"})
  """
  @wraps(f)
  def decorated_function(*args, **kwargs):
    token = None
    
    # Check for token in Authorization header
    if "Authorization" in request.headers:
      auth_header = request.headers["Authorization"]
      # Expected format: "Bearer <token>"
      try:
        token = auth_header.split(" ")[1]
      except IndexError:
        return jsonify({"message": "Invalid authorization header format"}), 400
    
    if not token:
      return jsonify({"message": "Authorization token is required"}), 401
    
    try:
      payload = verify_access_token(token)
      # Store user info in request context for use in the endpoint
      request.user_id = payload["user_id"]
      request.email = payload["email"]
      request.role = payload.get("role", "site")
      request.jti = payload.get("jti")
    except jwt.InvalidTokenError as e:
      return jsonify({"message": str(e)}), 401
    
    return f(*args, **kwargs)
  
  return decorated_function


def _load_revoked_jtis() -> set:
  """Return a set of revoked JTIs from the revocation file."""
  try:
    with open(REVOKED_TOKENS_FILE, "r") as f:
      return {line.strip() for line in f if line.strip()}
  except FileNotFoundError:
    return set()


def revoke_jti(jti: str) -> None:
  """Persistently revoke a token by its JTI (append to revocation file)."""
  if not jti:
    return
  try:
    # avoid duplicates
    revoked = _load_revoked_jtis()
    if jti in revoked:
      return
    with open(REVOKED_TOKENS_FILE, "a") as f:
      f.write(f"{jti}\n")
  except Exception:
    # best-effort; ignore IO errors in development
    pass


def revoke_token(token: str) -> None:
  """Convenience: decode token without verification to extract JTI and revoke it.

  Note: decoding without verification is acceptable here because we only extract
  the JTI for revocation; the token previously passed verification in `token_required`.
  """
  try:
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    jti = payload.get("jti")
    if jti:
      revoke_jti(jti)
  except Exception:
    pass


def role_required(*allowed_roles):
  """
  Decorator to protect endpoints that require specific roles.
  Must be used AFTER @token_required.
  
  Usage:
    @app.get("/api/corporate-endpoint")
    @token_required
    @role_required("corporate")
    def corporate_endpoint():
      # Only users with 'corporate' role can access
      return jsonify({"message": "success"})
      
    @app.get("/api/any-user-endpoint")
    @token_required
    @role_required("site", "corporate")
    def any_user_endpoint():
      # Both 'site' and 'corporate' users can access
      return jsonify({"message": "success"})
  """
  def decorator(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
      user_role = getattr(request, "role", None)
      
      if not user_role:
        return jsonify({"message": "User role not found in token"}), 401
      
      if user_role not in allowed_roles:
        return jsonify({"message": f"Access denied. Required role(s): {', '.join(allowed_roles)}"}), 403
      
      return f(*args, **kwargs)
    
    return decorated_function
  
  return decorator

