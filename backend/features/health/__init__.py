"""Health check - simple endpoint for load balancers and monitoring."""
from .health_routes import bp as health_bp

__all__ = ["health_bp"]
