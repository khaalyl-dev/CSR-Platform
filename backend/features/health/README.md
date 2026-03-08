# health

Health check endpoint for monitoring.

---

## Files

| File | Purpose |
|------|---------|
| **health_routes.py** | Blueprint `/api/health`. GET returns status OK. Used for load balancer or uptime checks. |
| **__init__.py** | Exports `health_bp`. |
