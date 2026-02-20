"""
Flask application factory.
"""
import os

from flask import Flask
from flask_cors import CORS

from config import Config
from core.db import db
from models import User  # noqa: F401 - needed for db.create_all

# Feature blueprints
from features.user_management import auth_bp, users_bp
from features.dashboard_analytics import dashboard_bp
from features.site_management import sites_bp, categories_bp, external_partners_bp
from features.csr_plan_management import csr_plans_bp, csr_activities_bp
from features.realized_activity_management import realized_csr_bp
from features.validation_workflow_management import validations_bp
from features.change_request_management import change_requests_bp
from features.file_management import documents_bp
from features.audit_history_management import audit_bp
from features.notification_management import notifications_bp
from features.powerbi_integration import powerbi_bp
from features.chatbot_assistant import chatbot_bp
from features.health import health_bp


def create_app(config_class=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)

    with app.app_context():
        db.create_all()

    CORS(app, resources={
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "Accept"],
            "expose_headers": ["Content-Type", "Authorization"],
        }
    })

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(sites_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(external_partners_bp)
    app.register_blueprint(csr_plans_bp)
    app.register_blueprint(csr_activities_bp)
    app.register_blueprint(realized_csr_bp)
    app.register_blueprint(validations_bp)
    app.register_blueprint(change_requests_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(powerbi_bp)
    app.register_blueprint(chatbot_bp)
    app.register_blueprint(health_bp)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)), debug=True)
