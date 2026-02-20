"""
CSR plans (annual plans) endpoints.
"""
from flask import Blueprint

bp = Blueprint("csr_plans", __name__, url_prefix="/api/csr-plans")


# À développer: CRUD plans CSR, statuts (DRAFT, SUBMITTED, VALIDATED, etc.)
