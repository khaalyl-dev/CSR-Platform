# user_management

Authentication, user profile, and user management (corporate).

---

## Files

| File | Purpose |
|------|---------|
| **auth_routes.py** | Blueprint `/api/auth`. Login, logout, profile (GET/PUT), change password, profile photo. Creates `UserSession`, returns JWT. |
| **users_routes.py** | Blueprint `/api/users`. User CRUD (corporate). List, detail, create SITE_USER, update, assign sites, reset password. |
| **__init__.py** | Exports `auth_bp`, `users_bp`. |

---

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/login | Login, returns JWT |
| POST | /api/auth/logout | Revoke token |
| GET | /api/auth/me | Validate token |
| GET | /api/auth/profile | Full profile |
| PUT | /api/auth/profile | Update profile |
| PUT | /api/auth/change-password | Change password |
| POST | /api/auth/profile-photo | Upload profile photo |
| GET | /api/users | List users (corporate) |
| GET | /api/users/:id | Detail + sites |
| POST | /api/users | Create SITE_USER |
| PATCH | /api/users/:id | Update user |
| POST | /api/users/:id/sites | Assign sites |
