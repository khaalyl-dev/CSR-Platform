# planned_activity_management

Planned CSR activities: list, detail, create (sidebar), edit, off-plan declaration. Aligns with backend `planned_activity_management` and `/api/csr-activities`.

## Structure

| Path | Purpose |
|------|---------|
| `api/csr-activities-api.ts` | `CsrActivitiesApi` — list, get, create, update, delete, off-plan / modification review |
| `models/csr-activity.model.ts` | `CsrActivity` type used by the API |
| `planned-activities-list/` | Global planned activities list |
| `planned-activity-detail/` | Single activity view |
| `planned-activity-edit/` | Edit form (full page or embedded) |
| `planned-activity-create-sidebar/` | Add activity to a plan (sidebar) |
| `off-plan-activity-sidebar/` | Off-plan / past-year draft realization flow |

`csr-plan-management/plan-detail` imports these sidebars and edit components when viewing a plan.
