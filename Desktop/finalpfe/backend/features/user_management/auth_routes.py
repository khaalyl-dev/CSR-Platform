"""
Auth endpoints: login, logout, session validation, profile, change password.

Endpoints:
  POST /api/auth/login          - Authenticate user, create session, return JWT
  POST /api/auth/logout         - Revoke token and delete session
  GET  /api/auth/me             - Validate token, return minimal user info
  GET  /api/auth/profile        - Return full user profile (read-only)
  PUT  /api/auth/change-password - Change current user's password
"""
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify

import jwt

from core import db, generate_access_token, token_required, revoke_jti
from core.jwt_utils import ACCESS_TOKEN_EXPIRATION_HOURS, SECRET_KEY
from models import User, UserSession, UserSite, Site

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _get_client_info():
    """Extract client IP and User-Agent from request headers for session tracking."""
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if ip and "," in ip:
        ip = ip.split(",")[0].strip()
    user_agent = request.headers.get("User-Agent", "")[:512]
    return ip or None, user_agent or None


@bp.post("/login")
def login():
    """
    Login: validate credentials, create session, return JWT token.
    Blocks inactive users with 403. Stores session with access token jti.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"message": "Email et mot de passe sont obligatoires."}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.verify_password(password):
        return jsonify({"message": "Email ou mot de passe incorrect."}), 401
    if not user.is_active:
        return jsonify({"message": "Compte désactivé. Contactez l'administrateur."}), 403

    token = generate_access_token(user.id, user.email, user.role)
    payload = _decode_token_for_session(token)
    if not payload:
        return jsonify({"message": "Erreur interne lors de la génération du token."}), 500

    ip_address, user_agent = _get_client_info()
    expires_at = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRATION_HOURS)

    session = UserSession(
        user_id=user.id,
        refresh_token=payload["jti"],
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at,
    )
    db.session.add(session)
    db.session.commit()

    return jsonify({
        "token": token,
        "email": user.email,
        "role": user.role,
        "user_id": user.id,
        "expires_at": expires_at.isoformat(),
    })


def _decode_token_for_session(token: str):
    """Decode JWT without revocation check to extract jti (token not yet stored)."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        return None


@bp.post("/logout")
@token_required
def logout():
    """Revoke JWT and delete session."""
    jti = getattr(request, "jti", None)
    if not jti:
        return jsonify({"message": "Token identifier not found"}), 400

    try:
        revoke_jti(jti)
        UserSession.query.filter_by(refresh_token=jti).delete()
        db.session.commit()
        return jsonify({"message": "Déconnexion réussie"})
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Failed to revoke token"}), 500


@bp.get("/me")
@token_required
def me():
    """Validate token and session, return minimal user info (user_id, email, role) for session check."""
    user_id = getattr(request, "user_id", None)
    jti = getattr(request, "jti", None)
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401

    session = UserSession.query.filter_by(refresh_token=jti, user_id=user_id).first()
    if not session or session.expires_at < datetime.utcnow():
        if session:
            db.session.delete(session)
            db.session.commit()
        return jsonify({"message": "Session expirée"}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "Utilisateur introuvable"}), 401

    return jsonify({
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
    })


@bp.get("/profile")
@token_required
def profile():
    """
    Return full profile of the current user (read-only).
    Requires valid JWT. Returns: id, first_name, last_name, email, role, is_active,
    created_at, and sites (for SITE_USER) with site_name, site_code, granted_at.
    """
    user_id = getattr(request, "user_id", None)
    jti = getattr(request, "jti", None)
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401

    session = UserSession.query.filter_by(refresh_token=jti, user_id=user_id).first()
    if not session or session.expires_at < datetime.utcnow():
        if session:
            db.session.delete(session)
            db.session.commit()
        return jsonify({"message": "Session expirée"}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "Utilisateur introuvable"}), 401

    data = {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }

    if user.role == "SITE_USER":
        sites = UserSite.query.filter_by(user_id=user.id, is_active=True).all()
        data["sites"] = [
            {
                "id": us.id,
                "site_id": us.site_id,
                "site_name": Site.query.get(us.site_id).name if Site.query.get(us.site_id) else None,
                "site_code": Site.query.get(us.site_id).code if Site.query.get(us.site_id) else None,
                "granted_at": us.granted_at.isoformat() if us.granted_at else None,
            }
            for us in sites
        ]
    else:
        data["sites"] = []

    return jsonify(data)


@bp.put("/change-password")
@token_required
def change_password():
    """
    Change the current user's password.
    Requires: current_password, new_password (min 8 chars) in JSON body.
    Validates current password before updating.
    """
    user_id = getattr(request, "user_id", None)
    jti = getattr(request, "jti", None)
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401

    session = UserSession.query.filter_by(refresh_token=jti, user_id=user_id).first()
    if not session or session.expires_at < datetime.utcnow():
        if session:
            db.session.delete(session)
            db.session.commit()
        return jsonify({"message": "Session expirée"}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "Utilisateur introuvable"}), 401

    data = request.get_json(silent=True) or {}
    current_password = (data.get("current_password") or "").strip()
    new_password = (data.get("new_password") or "").strip()

    if not current_password:
        return jsonify({"message": "Le mot de passe actuel est obligatoire."}), 400
    if not new_password:
        return jsonify({"message": "Le nouveau mot de passe est obligatoire."}), 400
    if len(new_password) < 8:
        return jsonify({"message": "Le nouveau mot de passe doit contenir au moins 8 caractères."}), 400

    if not user.verify_password(current_password):
        return jsonify({"message": "Mot de passe actuel incorrect."}), 401

    user.password_hash = User.hash_password(new_password)
    db.session.commit()
    return jsonify({"message": "Mot de passe modifié avec succès."})
