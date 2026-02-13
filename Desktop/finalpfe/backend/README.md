# Backend (Flask) for CSR Platform

This folder contains a Flask backend that matches the Angular frontend API expectations.

It exposes:

- `POST /api/auth/login` – authentication with MySQL user database
- `GET /api/dashboard/site/summary` – site dashboard summary
- `GET /api/dashboard/site/activities-chart` – site activities chart data

All endpoints are CORS-enabled so you can run Angular (`ng serve`) and Flask on different ports during development.

## 1. Setup

### Prerequisites
- Python 3.8+
- MySQL Server running locally

### Installation

From the `backend/` directory:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Configure MySQL

1. **Create the database** (in MySQL):
```sql
CREATE DATABASE csr_platform;
```

2. **Update `.env` file** with your MySQL credentials:
```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=csr_platform
```

3. **Initialize the database** with tables and sample users:
```bash
python init_db.py
```

You'll see output like:
```
✓ Database tables created
✓ Added 3 sample users

Test credentials:
  - user@test.com / password123 (site role)
  - admin@test.com / admin123 (corporate role)
  - john@example.com / john123 (site role)
```

## 2. Run the API

From `backend/`:

```bash
python app.py
```

Or with Flask CLI:
```bash
flask --app app run --port 5000
```

Or for development on port 8000 (recommended on macOS):
```bash
flask --app app run --port 8000
```

The API will be available at `http://localhost:5000` (or `http://localhost:8000`).

**Note:** On macOS, if you use port 5000, you may encounter a conflict with AirTunes/ControlCenter. Use port 8000 instead for development.

## 3. Endpoints

### `POST /api/auth/login`

Authenticates users against the MySQL database and returns a JWT token.

- **Request JSON**:
```json
{
  "email": "user@test.com",
  "password": "password123"
}
```

- **Success (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

The returned token is a JWT that expires in 24 hours (configurable via `ACCESS_TOKEN_EXPIRATION_HOURS` environment variable).

- **Error (401)**:
```json
{
  "message": "Email ou mot de passe incorrect."
}
```

- **Error (400)**:
```json
{
  "message": "Email et mot de passe sont obligatoires."
}
```

### `GET /api/dashboard/site/summary`

Used by `DashboardApi.getSiteSummary()` in the frontend dashboard.

**Requires JWT authentication.** Include the token from login in the `Authorization` header:

```
Authorization: Bearer <token>
```

Returns mock metrics for the current site:

```json
{
  "siteId": "SITE-01",
  "plansCount": 10,
  "validatedPlansCount": 7,
  "activitiesThisMonth": 3,
  "totalCost": 12345.67
}
```

- **Error (401)**:
```json
{
  "message": "Authorization token is required"
}
```

### `GET /api/dashboard/site/activities-chart`

Used by `DashboardApi.getActivitiesChart()` in the frontend dashboard.

**Requires JWT authentication.** Include the token from login in the `Authorization` header:

```
Authorization: Bearer <token>
```

Returns labels + data arrays:

```json
{
  "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  "data": [2, 4, 1, 3, 5, 0]
}
```

- **Error (401)**:
```json
{
  "message": "Authorization token is required"
}
```

## 4. JWT Token Management

The backend now uses JWT (JSON Web Tokens) for authentication. Here's how it works:

### Token Generation
When a user logs in with valid credentials, a JWT token is generated with the following payload:
- `user_id`: User ID from database
- `email`: User email
- `role`: User role ('site' or 'corporate')
- `iat`: Token issued at timestamp
- `exp`: Token expiration time (24 hours from issue by default)

### Token Validation
Dashboard endpoints require a valid JWT token. The token must be sent in the `Authorization` header:

```
Authorization: Bearer <token>
```

The server validates the token signature and expiration time. Returns 401 Unauthorized if:
- Token is missing
- Token is invalid or tampered with
- Token has expired

### Configuration
Token expiration can be configured via the `.env` file:

```bash
ACCESS_TOKEN_EXPIRATION_HOURS=24
```

### Security Notes
- The `SECRET_KEY` in `.env` is used to sign tokens. Keep it secure in production!
- Consider using a stronger secret in production
- Tokens are stored in the frontend's `AuthStore` (in-memory)
- For better security in production, use:
  - HTTPS only
  - HttpOnly cookies for token storage
  - Refresh token rotation
  - Token revocation lists

## 5. Role-Based Access Control (RBAC)

The backend implements role-based access control to restrict endpoint access based on user roles.

### Available Roles
- **`site`**: Regular site user
- **`corporate`**: Corporate/admin user with elevated privileges

### How It Works

Roles are checked using the `@role_required` decorator:

```python
@app.get("/api/corporate-only")
@token_required
@role_required("corporate")
def corporate_endpoint():
  # Only users with 'corporate' role can access
  return jsonify({"data": "corporate"})

@app.get("/api/public-dashboard")
@token_required
@role_required("site", "corporate")
def public_endpoint():
  # Both 'site' and 'corporate' users can access
  return jsonify({"data": "dashboard"})
```

### Current Implementation
- **Dashboard endpoints** (`/api/dashboard/site/summary`, `/api/dashboard/site/activities-chart`): Accessible by both `site` and `corporate` roles
- Can be easily extended to create role-specific endpoints

### Example: Adding a Corporate-Only Endpoint

```python
@app.get("/api/corporate/reports")
@token_required
@role_required("corporate")
def corporate_reports():
  """Only accessible to corporate users."""
  return jsonify({"reports": [...]})
```

### Testing Role-Based Access

For a `site` user (should work):
```bash
curl http://localhost:8000/api/dashboard/site/summary \
  -H "Authorization: Bearer <site-user-token>"
```

For a `corporate` user (should also work):
```bash
curl http://localhost:8000/api/dashboard/site/summary \
  -H "Authorization: Bearer <corporate-user-token>"
```

For a corporate-only endpoint with a `site` user token (should return 403):
```bash
curl http://localhost:8000/api/corporate/reports \
  -H "Authorization: Bearer <site-user-token>"
```

Response:
```json
{
  "message": "Access denied. Required role(s): corporate"
}
```

## 6. Add New Users

To add a new user to the database, you can:

```python
from app import create_app, db, User

app = create_app()
with app.app_context():
    user = User(
        email="newuser@example.com",
        password_hash=User.hash_password("password123"),
        role="site"  # or "corporate"
    )
    db.session.add(user)
    db.session.commit()
    print(f"User {user.email} created with {user.role} role")
```

Or modify `init_db.py` to add more sample users.

## 7. Next Steps

- ✅ Implement proper JWT token generation and validation (DONE)
- ✅ Add user roles (site, corporate) and role-based access control (DONE)
- Add database migrations (Flask-Migrate)
- Implement refresh tokens for better security
- Add email verification for new users
- Implement token revocation/logout endpoint
- Add more security features (rate limiting, CSRF protection, etc.)


