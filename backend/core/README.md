# core/

Shared central module: database, JWT, utilities.

---

## Files

| File | Purpose |
|------|---------|
| **db.py** | SQLAlchemy instance (`db = SQLAlchemy()`). Initialized in `app.py` with `db.init_app(app)`. Used by all models and features for DB queries. |
| **jwt_utils.py** | JWT: `create_token()`, `verify_token()`. Decorators `@token_required` (validates token, injects `request.user_id` and `request.role`) and `@role_required(['corporate'])` (restricts by role). Used on protected routes. |
| **__init__.py** | Exposes `db` and JWT utilities for imports. |

---

## How it works

- **db**: Each model (User, Site, etc.) inherits from `db.Model`. `db.session` handles transactions. `db.create_all()` creates tables on startup.
- **JWT**: Login returns a token. Protected routes verify the `Authorization: Bearer <token>` header via `@token_required`.
