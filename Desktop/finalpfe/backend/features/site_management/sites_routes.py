"""
Sites (plants/entities) endpoints.
"""
from flask import Blueprint, request, jsonify

from core import db, token_required
from models import Site

bp = Blueprint("sites", __name__, url_prefix="/api/sites")


def _site_to_json(site: Site):
    return {
        "id": site.id,
        "name": site.name,
        "code": site.code,
        "region": site.region or "",
        "country": site.country or "",
        "location": site.location or "",
        "description": site.description or "",
        "is_active": site.is_active,
        "created_at": site.created_at.isoformat() if site.created_at else None,
        "updated_at": site.updated_at.isoformat() if site.updated_at else None,
    }


@bp.get("")
@token_required
def list_sites():
    """List all sites."""
    active_only = request.args.get("active") == "true"
    q = Site.query
    if active_only:
        q = q.filter_by(is_active=True)
    sites = q.order_by(Site.name).all()
    return jsonify([_site_to_json(s) for s in sites])


@bp.get("/<site_id>")
@token_required
def get_site(site_id: str):
    """Get site by ID."""
    site = Site.query.get(site_id)
    if not site:
        return jsonify({"message": "Site introuvable"}), 404
    return jsonify(_site_to_json(site))
