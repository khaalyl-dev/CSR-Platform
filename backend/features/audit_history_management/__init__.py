"""Audit history - view who did what (create, update, approve, reject) for compliance."""
from .audit_routes import bp as audit_bp

__all__ = ["audit_bp"]
