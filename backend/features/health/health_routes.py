"""
Health check endpoint - used by load balancers and monitoring tools.

GET /api/health returns {"status": "ok"} if the backend is running.
Quick way to verify the API is alive without logging in.
"""
from flask import Blueprint, jsonify

bp = Blueprint("health", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    """Return 200 OK with status when backend is running. No auth required."""
    return jsonify({"status": "ok"})
