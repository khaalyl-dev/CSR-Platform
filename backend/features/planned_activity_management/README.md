# planned_activity_management

Planned CSR activities (lines on annual plans): create, edit, validation, off-plan declarations.

---

## Files

| File | Purpose |
|------|---------|
| **planned_csr_routes.py** | Blueprint `/api/csr-activities`. CRUD planned activities, off-plan approve/reject, modification review. |
| **planned_activity_routes.py** | Re-exports `bp` from `planned_csr_routes` (same pattern as `realized_activity_routes`). |
| **__init__.py** | Exports `planned_csr_bp`. |
