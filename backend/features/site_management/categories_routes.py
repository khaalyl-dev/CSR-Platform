"""
Categories API routes - list and create CSR activity categories.

Categories (Environment, Social, Education, etc.) are used to classify activities.
Used in dropdowns when creating activities. Create is idempotent (returns existing if name exists).
"""
from flask import Blueprint, jsonify, request

from core import db, token_required
from models import Category

bp = Blueprint("categories", __name__, url_prefix="/api/categories")


@bp.get("")
@token_required
def list_categories():
    """List all CSR categories (for activity dropdown)."""
    categories = Category.query.order_by(Category.name).all()
    return jsonify([{"id": c.id, "name": c.name} for c in categories]), 200


@bp.post("")
@token_required
def create_category():
    """Create a new category. Body: { name: string }."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "Données manquantes"}), 400
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"message": "Le nom de la catégorie est obligatoire"}), 400
    existing = Category.query.filter_by(name=name).first()
    if existing:
        return jsonify({"id": existing.id, "name": existing.name}), 201
    cat = Category(name=name)
    db.session.add(cat)
    db.session.commit()
    return jsonify({"id": cat.id, "name": cat.name}), 201
