# notification_management

Notifications and user preferences.

---

## Files

| File | Purpose |
|------|---------|
| **notifications_routes.py** | Blueprint `/api/notifications`. List, mark as read, get unread count. |
| **notification_helper.py** | `notify_corporate()`, `notify_site_users()`, `notify_user()`. Sends notifications when plans/activities are validated, rejected, or when change requests are created. Respects user preferences (notify_csr_plan_validation, etc.). |
| **__init__.py** | Exports `notifications_bp`. |
