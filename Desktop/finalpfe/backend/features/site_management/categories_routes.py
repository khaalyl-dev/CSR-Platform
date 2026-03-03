"""
Categories endpoints.
"""
from flask import Blueprint, jsonify

from core import token_required
from models import Category

bp = Blueprint("categories", __name__, url_prefix="/api/categories")


@bp.get("")
@token_required
def list_categories():
    """List all CSR categories (for activity dropdown)."""
    categories = Category.query.order_by(Category.name).all()
    return jsonify([{"id": c.id, "name": c.name} for c in categories]), 200
