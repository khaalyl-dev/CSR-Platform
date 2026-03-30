"""CSR plan management — annual plans and Excel import (planned activities live in planned_activity_management)."""
from .csr_plans_routes import bp as csr_plans_bp
from .excel_import_routes import bp as csr_import_bp

__all__ = ["csr_plans_bp", "csr_import_bp"]
