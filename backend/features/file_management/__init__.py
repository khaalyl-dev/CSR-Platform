"""File management - upload, serve, list documents (profile photos, attachments)."""
from .documents_routes import bp as documents_bp

__all__ = ["documents_bp"]
