# features/

Business modules (Flask blueprints). Each feature is a subpackage with:
- `__init__.py` – exports the blueprint (`bp`, `auth_bp`, etc.)
- `*_routes.py` – route definitions
- `*_helper.py` – shared business logic (optional)

---

## Structure by feature

| Feature | Files | Routes (prefix) | Purpose |
|---------|-------|-----------------|---------|
| **user_management** | auth_routes, users_routes | /api/auth, /api/users | Login, profile, user CRUD |
| **site_management** | sites_routes, categories_routes, external_partners_routes | /api/sites, /api/categories | Sites, CSR categories |
| **csr_plan_management** | csr_plans_routes, excel_import_routes | /api/csr-plans | Annual plans, Excel import |
| **planned_activity_management** | planned_csr_routes | /api/csr-activities | Planned activities (plan lines) |
| **realized_activity_management** | realized_csr_routes | /api/realized-csr | Realized activities |
| **validation_workflow_management** | validations_routes | /api/validations | Plan/activity validation |
| **change_request_management** | change_requests_routes | /api/change-requests | Change requests |
| **dashboard_analytics** | dashboard_routes | /api/dashboard | KPIs, charts |
| **file_management** | documents_routes | /api/documents | Upload, download, profile photos |
| **audit_history_management** | audit_routes, audit_helper | /api/audit | Audit log, history |
| **notification_management** | notifications_routes, notification_helper | /api/notifications | Notifications, email |
| **powerbi_integration** | powerbi_routes | /api/powerbi | Power BI integration |
| **chatbot_assistant** | chatbot_routes | /api/chatbot | Chatbot assistant |
| **health** | health_routes | /api/health | Health check |
