# Backend (Flask) – CSR Insight

Flask REST API for the CSR Insight platform. Manages CSR plans, activities, validations, documents, and notifications.

---

## Structure

```
backend/
├── app.py              # Entry point – factory, CORS, blueprint registration
├── config.py           # Configuration (DB, SECRET_KEY, MEDIA_FOLDER)
├── init_db.py          # Fresh DB setup – tables, categories, users, sites
├── requirements.txt    # Python dependencies
│
├── core/               # Shared layer
│   ├── db.py           # SQLAlchemy instance
│   ├── jwt_utils.py    # JWT generation/verification, @token_required, @role_required
│   └── __init__.py
│
├── models/             # SQLAlchemy models (users, sites, csr_plans, etc.)
│   └── README.md
│
└── features/           # Business modules (blueprints)
    ├── user_management/
    ├── site_management/
    ├── csr_plan_management/
    ├── realized_activity_management/
    ├── validation_workflow_management/
    ├── change_request_management/
    ├── dashboard_analytics/
    ├── file_management/
    ├── audit_history_management/
    ├── notification_management/
    ├── powerbi_integration/
    ├── chatbot_assistant/
    └── health/
```

---

## Main files

| File | Purpose |
|------|---------|
| **app.py** | Creates Flask app, loads config, initializes DB, registers blueprints. Runs server on port 5001. |
| **config.py** | Reads env vars (.env): `DB_*`, `SECRET_KEY`, `MEDIA_FOLDER`. `get_media_folder()` returns upload path (default `frontend/src/media`). |
| **init_db.py** | `db.create_all()` creates tables. Adds CSR categories, users, and test sites. Run once for a fresh DB. |

---

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` at `backend/` root:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=csr_db
SECRET_KEY=change-me-in-production
```

Initialize DB:

```bash
python3 init_db.py
```

Start server:

```bash
python3 app.py
```

→ `http://localhost:5001`

---

## Test accounts

| Email | Password | Role |
|-------|--------------|------|
| user@test.com | password123 | Site |
| admin@test.com | admin123 | Corporate |
| john@example.com | john123 | Site |

---

## Main endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/login | Login, returns JWT |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/profile | User profile |
| GET | /api/dashboard/* | Dashboards, KPIs |
| GET | /api/sites | Sites (corporate) |
| GET | /api/csr-plans | Annual CSR plans |
| GET | /api/documents | Documents |
| GET | /api/health | Health check |

All `/api/*` routes (except login) require: `Authorization: Bearer <token>`.
