from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from typing import List

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import bcrypt
from dotenv import load_dotenv
from jwt_utils import generate_access_token, token_required, role_required

load_dotenv()

db = SQLAlchemy()


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class User(db.Model):
  __tablename__ = 'users'
  
  id = db.Column(db.Integer, primary_key=True)
  email = db.Column(db.String(255), unique=True, nullable=False, index=True)
  password_hash = db.Column(db.String(255), nullable=False)
  role = db.Column(db.String(50), nullable=False, default='site')  # 'site' or 'corporate'
  created_at = db.Column(db.DateTime, default=db.func.now())
  
  def verify_password(self, password: str) -> bool:
    """Verify a plain text password against the stored hash."""
    return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
  
  @staticmethod
  def hash_password(password: str) -> str:
    """Hash a plain text password."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_app() -> Flask:
  """
  Flask application factory.

  Exposes a small API that matches the Angular frontend expectations:
  - POST /api/auth/login
  - GET  /api/dashboard/site/summary
  - GET  /api/dashboard/site/activities-chart
  """
  app = Flask(__name__)

  # Database config
  db_host = os.environ.get("DB_HOST", "localhost")
  db_user = os.environ.get("DB_USER", "root")
  db_password = os.environ.get("DB_PASSWORD", "")
  db_name = os.environ.get("DB_NAME", "csr_db")
  db_port = os.environ.get("DB_PORT", "3306")
  
  db_url = f"mysql+mysqlconnector://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
  app.config["SQLALCHEMY_DATABASE_URI"] = db_url
  app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
  
  # Basic config
  app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me")

  # Initialize SQLAlchemy
  db.init_app(app)
  
  # Create database tables
  with app.app_context():
    db.create_all()

  # Allow CORS for local Angular dev server
  CORS(app, resources={r"/api/*": {"origins": "*"}})

  # ---------------------------------------------------------------------------
  # Auth endpoints
  # ---------------------------------------------------------------------------

  @app.post("/api/auth/login")  # ← This should be indented inside create_app
  def login():
    """
    Login endpoint that validates credentials against the database.
      POST /api/auth/login
      body: { email, password }
    Returns:
      - 200 with token, email, and role if credentials are valid
      - 401 if credentials are invalid
      - 400 if email or password is missing
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()

    if not email or not password:
      return (
        jsonify({"message": "Email et mot de passe sont obligatoires."}),
        400,
      )

    # Check user in database
    user = User.query.filter_by(email=email).first()

    if not user or not user.verify_password(password):
      return (
        jsonify({"message": "Email ou mot de passe incorrect."}),
        401,
      )

    # Generate JWT token with user role
    token = generate_access_token(user.id, user.email, user.role)
    
    # Return token, email, AND role
    return jsonify({
      "token": token,
      "email": user.email,
      "role": user.role
    })

  @app.post("/api/auth/logout")
  @token_required
  def logout():
    """Revoke current JWT token so it can no longer be used.

    Requires Authorization header with the token to revoke.
    """
    # request.jti is added by token_required decorator
    jti = getattr(request, "jti", None)
    if not jti:
      return jsonify({"message": "Token identifier not found"}), 400

    # Revoke the JTI
    try:
      from jwt_utils import revoke_jti
      revoke_jti(jti)
      return jsonify({"message": "Token revoked"})
    except Exception:
      return jsonify({"message": "Failed to revoke token"}), 500

  # ---------------------------------------------------------------------------
  # Dashboard endpoints
  # ---------------------------------------------------------------------------

  @dataclass
  class DashboardSummary:
    siteId: str | None
    plansCount: int
    validatedPlansCount: int
    activitiesThisMonth: int
    totalCost: float

  @dataclass
  class ActivitiesChart:
    labels: List[str]
    data: List[int]

  @app.get("/api/dashboard/site/summary")
  @token_required
  @role_required("site", "corporate")
  def site_summary():
    """
    Returns mock metrics for the site dashboard.
    Matches DashboardApi.getSiteSummary() types.
    Requires JWT token in Authorization header.
    Accessible by both 'site' and 'corporate' roles.
    """
    summary = DashboardSummary(
      siteId="SITE-01",
      plansCount=10,
      validatedPlansCount=7,
      activitiesThisMonth=3,
      totalCost=12345.67,
    )
    return jsonify(asdict(summary))

  @app.get("/api/dashboard/site/activities-chart")
  @token_required
  @role_required("site", "corporate")
  def site_activities_chart():
    """
    Returns mock chart data for the last 6 months.
    Matches DashboardApi.getActivitiesChart() types.
    Requires JWT token in Authorization header.
    Accessible by both 'site' and 'corporate' roles.
    """
    chart = ActivitiesChart(
      labels=["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      data=[2, 4, 1, 3, 5, 0],
    )
    return jsonify(asdict(chart))

  # ---------------------------------------------------------------------------
  # Health check
  # ---------------------------------------------------------------------------

  @app.get("/api/health")
  def health():
    return jsonify({"status": "ok"})

  return app  # ← Don't forget to return the app!


app = create_app()

if __name__ == "__main__":
  # For local development only
  app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)