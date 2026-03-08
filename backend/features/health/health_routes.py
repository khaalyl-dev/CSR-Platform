"""
Health check endpoint.
"""
from flask import Blueprint, jsonify

bp = Blueprint("health", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    """Health check for load balancers / monitoring."""
    return jsonify({"status": "ok"})
