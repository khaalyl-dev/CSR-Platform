"""
Documents (uploads, attachments) endpoints.
"""
from flask import Blueprint

bp = Blueprint("documents", __name__, url_prefix="/api/documents")


# À développer: upload, download, liaison avec plans/activités
