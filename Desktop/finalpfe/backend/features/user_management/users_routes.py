"""
User management endpoints: CRUD users, assign site access (corporate only).

Endpoints (all require CORPORATE_USER role):
  GET    /api/users              - List all users
  GET    /api/users/<id>         - Get user with site assignments
  POST   /api/users              - Create SITE_USER
  PATCH  /api/users/<id>         - Update user
  POST   /api/users/<id>/sites   - Replace site access (assign_sites)
  DELETE /api/users/<id>/sites/<site_id> - Revoke site access
  POST   /api/users/<id>/reset-password  - Generate new password
"""
import secrets
import string
from datetime import datetime

from flask import Blueprint, request, jsonify

from core import db, token_required, role_required
from models import User, UserSite, Site

bp = Blueprint("users", __name__, url_prefix="/api/users")


def _user_to_json(user: User, with_sites: bool = False):
    """
    Convert User model to JSON dict.
    If with_sites=True, includes active site assignments (id, site_id, site_name, granted_at).
    """
    data = {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
    if with_sites:
        sites = UserSite.query.filter_by(user_id=user.id, is_active=True).all()
        data["sites"] = [
            {
                "id": us.id,
                "site_id": us.site_id,
                "site_name": Site.query.get(us.site_id).name if Site.query.get(us.site_id) else None,
                "granted_at": us.granted_at.isoformat() if us.granted_at else None,
            }
            for us in sites
        ]
    return data


@bp.get("")
@token_required
@role_required("CORPORATE_USER", "corporate")
def list_users():
    """List all users, ordered by email. Returns id, first_name, last_name, email, role, is_active, created_at."""
    users = User.query.order_by(User.email).all()
    return jsonify([_user_to_json(u) for u in users])


@bp.get("/<user_id>")
@token_required
@role_required("CORPORATE_USER", "corporate")
def get_user(user_id: str):
    """Get user by ID with site assignments (id, site_id, site_name, granted_at)."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "Utilisateur introuvable"}), 404
    return jsonify(_user_to_json(user, with_sites=True))


@bp.post("")
@token_required
@role_required("CORPORATE_USER", "corporate")
def create_user():
    """
    Create a new SITE_USER. Only SITE_USER can be created (single corporate account).
    Requires: email, password, first_name, last_name.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()

    if not email or not password:
        return jsonify({"message": "Email et mot de passe obligatoires"}), 400
    if not first_name or not last_name:
        return jsonify({"message": "Prénom et nom obligatoires"}), 400
    if len(password) < 6:
        return jsonify({"message": "Le mot de passe doit contenir au moins 6 caractères"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Un utilisateur avec cet email existe déjà"}), 409

    user = User(
        email=email,
        password_hash=User.hash_password(password),
        first_name=first_name,
        last_name=last_name,
        role="SITE_USER",
        is_active=True,
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(_user_to_json(user)), 201


@bp.patch("/<user_id>")
@token_required
@role_required("CORPORATE_USER", "corporate")
def update_user(user_id: str):
    """Update user. Supports: first_name, last_name, is_active, role, password."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "Utilisateur introuvable"}), 404

    data = request.get_json(silent=True) or {}
    if "first_name" in data:
        user.first_name = (data["first_name"] or "").strip() or user.first_name
    if "last_name" in data:
        user.last_name = (data["last_name"] or "").strip() or user.last_name
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    if "role" in data:
        r = (data["role"] or "").strip().upper()
        if r == "CORPORATE_USER":
            return jsonify({"message": "Impossible de créer ou promouvoir un utilisateur corporate. Un seul compte corporate existe."}), 403
        if r == "SITE_USER":
            user.role = r
    if "password" in data and data["password"]:
        if len(data["password"]) >= 6:
            user.password_hash = User.hash_password(data["password"])
        else:
            return jsonify({"message": "Le mot de passe doit contenir au moins 6 caractères"}), 400

    db.session.commit()
    return jsonify(_user_to_json(user))


@bp.post("/<user_id>/sites")
@token_required
@role_required("CORPORATE_USER", "corporate")
def assign_sites(user_id: str):
    """
    Replace user's site access. Body: { site_ids: string[] }.
    - Deactivates UserSite records not in site_ids
    - Adds or reactivates UserSite for each site_id in the list
    - Uses replace semantics: full selection overwrites previous
    """
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "Utilisateur introuvable"}), 404

    data = request.get_json(silent=True) or {}
    site_ids = data.get("site_ids") or []

    if not isinstance(site_ids, list):
        return jsonify({"message": "site_ids doit être une liste"}), 400

    # Normalize to list of non-empty strings
    wanted_ids = [str(s).strip() for s in site_ids if s is not None and str(s).strip()]

    granted_by = getattr(request, "user_id", None)

    # Deactivate sites no longer in the selection
    to_deactivate = UserSite.query.filter(
        UserSite.user_id == user_id,
        UserSite.is_active == True,
    )
    if wanted_ids:
        to_deactivate = to_deactivate.filter(~UserSite.site_id.in_(wanted_ids))
    to_deactivate.update({"is_active": False}, synchronize_session=False)

    # Add or reactivate wanted sites
    for sid in wanted_ids:
        site = Site.query.get(sid)
        if not site:
            continue
        existing = UserSite.query.filter_by(user_id=user_id, site_id=sid).first()
        if existing:
            existing.is_active = True
            existing.granted_by = granted_by
            existing.granted_at = datetime.utcnow()
        else:
            us = UserSite(
                user_id=user_id,
                site_id=sid,
                is_active=True,
                granted_by=granted_by,
                granted_at=datetime.utcnow(),
            )
            db.session.add(us)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Erreur lors de la mise à jour: {str(e)}"}), 500
    return jsonify({"message": "Accès aux sites mis à jour", "sites": _user_to_json(user, with_sites=True)["sites"]})


@bp.post("/<user_id>/reset-password")
@token_required
@role_required("CORPORATE_USER", "corporate")
def reset_password(user_id: str):
    """Generate a new random 12-char password. Returns it for one-time display to the user."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "Utilisateur introuvable"}), 404

    alphabet = string.ascii_letters + string.digits + "!@#$%"
    new_password = "".join(secrets.choice(alphabet) for _ in range(12))
    user.password_hash = User.hash_password(new_password)
    db.session.commit()
    return jsonify({"password": new_password, "message": "Mot de passe généré. Transmettez-le de manière sécurisée."})


@bp.delete("/<user_id>/sites/<site_id>")
@token_required
@role_required("CORPORATE_USER", "corporate")
def revoke_site_access(user_id: str, site_id: str):
    """Revoke site access by setting UserSite.is_active = False."""
    us = UserSite.query.filter_by(user_id=user_id, site_id=site_id).first()
    if not us:
        return jsonify({"message": "Accès non trouvé"}), 404
    us.is_active = False
    db.session.commit()
    return jsonify({"message": "Accès révoqué"})
