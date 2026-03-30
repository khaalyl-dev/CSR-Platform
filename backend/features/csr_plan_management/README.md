# csr_plan_management

Annual CSR plans and Excel import. Planned activity CRUD lives in **planned_activity_management**.

---

## Files

| File | Purpose |
|------|---------|
| **csr_plans_routes.py** | Blueprint `/api/csr-plans`. CRUD plans. Create, list, get, update, submit, validate, reject. |
| **excel_import_routes.py** | Blueprint `/api/csr-plans/import-excel`. Import plans and activities from Excel. |
| **excel_import.py** | Logic for parsing and importing Excel files. |
| **__init__.py** | Exports `csr_plans_bp`, `csr_import_bp`. |
