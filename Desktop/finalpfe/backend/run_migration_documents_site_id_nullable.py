"""
Make documents.site_id nullable for profile photo documents. Run from backend: python3 run_migration_documents_site_id_nullable.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from config import Config
from core.db import db
from sqlalchemy import text

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

with app.app_context():
    try:
        # MySQL: allow NULL on site_id for USER_PROFILE documents
        db.session.execute(text("ALTER TABLE documents MODIFY site_id CHAR(36) NULL"))
        db.session.commit()
        print("✓ documents.site_id is now nullable.")
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        sys.exit(1)
