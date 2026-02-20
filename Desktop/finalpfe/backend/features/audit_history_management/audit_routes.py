"""
Audit logs and entity history endpoints.
"""
from flask import Blueprint

bp = Blueprint("audit", __name__, url_prefix="/api/audit")


# À développer: audit_logs, entity_history (consultation historique)
