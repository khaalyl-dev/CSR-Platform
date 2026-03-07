"""
Add users profile settings columns if missing.
Run from backend: python3 run_migration_user_profile_settings.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from sqlalchemy import text

from config import Config
from core.db import db

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)


def ensure_column(column_name: str, ddl: str):
    result = db.session.execute(text(f"SHOW COLUMNS FROM users LIKE '{column_name}'"))
    if result.fetchone() is None:
        db.session.execute(text(ddl))
        print(f"✓ users.{column_name} added.")
    else:
        print(f"✓ users.{column_name} already exists.")


with app.app_context():
    try:
        ensure_column(
            "phone",
            "ALTER TABLE users ADD COLUMN phone VARCHAR(64) NULL COMMENT 'Telephone utilisateur (avec prefixe pays)'",
        )
        ensure_column(
            "language",
            "ALTER TABLE users ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en' COMMENT 'Preference langue (fr/en)'",
        )
        ensure_column(
            "theme",
            "ALTER TABLE users ADD COLUMN theme VARCHAR(20) NOT NULL DEFAULT 'light' COMMENT 'Theme UI (light/dark)'",
        )
        ensure_column(
            "notify_csr_plan_validation",
            "ALTER TABLE users ADD COLUMN notify_csr_plan_validation TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Notification validation plan CSR'",
        )
        ensure_column(
            "notify_activity_validation",
            "ALTER TABLE users ADD COLUMN notify_activity_validation TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Notification validation activite'",
        )
        ensure_column(
            "notify_activity_reminders",
            "ALTER TABLE users ADD COLUMN notify_activity_reminders TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Rappels d activites'",
        )
        ensure_column(
            "notify_weekly_summary_email",
            "ALTER TABLE users ADD COLUMN notify_weekly_summary_email TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Email resume CSR hebdomadaire'",
        )
        db.session.execute(text("ALTER TABLE users ALTER COLUMN language SET DEFAULT 'en'"))
        db.session.execute(text("UPDATE users SET language='en' WHERE language IS NULL OR language=''"))
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        sys.exit(1)

