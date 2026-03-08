# models/

SQLAlchemy models matching MySQL tables. Each file defines one table via `db.Model`.

---

## Files and tables

| File | Table | Purpose |
|------|-------|---------|
| **user.py** | users | Users (auth, profile, notification preferences) |
| **user_session.py** | user_sessions | Sessions, refresh tokens |
| **user_site.py** | user_sites | User–site association (access, grade) |
| **site.py** | sites | COFICAB sites/entities |
| **category.py** | categories | CSR categories (Environment, Social, etc.) |
| **external_partner.py** | external_partners | External partners |
| **csr_plan.py** | csr_plans | Annual CSR plans |
| **csr_activity.py** | csr_activities | Planned activities |
| **realized_csr.py** | realized_csr | Realized activities |
| **validation.py** | validations | Plan/activity validations |
| **change_request.py** | change_requests | Change requests |
| **document.py** | documents | Attachments (photos, Excel, PDF) |
| **notification.py** | notifications | User notifications |
| **audit_log.py** | audit_logs | Action log |
| **entity_history.py** | entity_history | Modification history |
| **csr_snapshot.py** | csr_snapshots | Power BI snapshots |
| **chatbot_log.py** | chatbot_logs | Chatbot history |

---

## Usage

```python
from models import User, Site, CsrPlan
user = User.query.filter_by(email="admin@test.com").first()
```

`__init__.py` exports all models for `db.create_all()` and imports in features.
