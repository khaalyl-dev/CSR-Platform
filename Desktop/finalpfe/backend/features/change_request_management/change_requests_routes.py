"""
Change requests endpoints.
"""
from flask import Blueprint

bp = Blueprint("change_requests", __name__, url_prefix="/api/change-requests")


# À développer: CRUD demandes de modification (plans/activités validés)
