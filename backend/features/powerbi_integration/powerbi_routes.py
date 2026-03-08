"""
Power BI / reporting integration endpoints.
"""
from flask import Blueprint

bp = Blueprint("powerbi", __name__, url_prefix="/api/powerbi")


# À développer: embedding Power BI, csr_snapshots, exports
