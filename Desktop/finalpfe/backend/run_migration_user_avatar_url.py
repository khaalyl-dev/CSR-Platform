"""
Add users.avatar_url column if missing. Run from backend: python run_migration_user_avatar_url.py
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
        result = db.session.execute(text("SHOW COLUMNS FROM users LIKE 'avatar_url'"))
        if result.fetchone() is None:
            db.session.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL COMMENT 'Photo de profil (chemin relatif)'"))
            db.session.commit()
            print("✓ users.avatar_url column added.")
        else:
            print("✓ users.avatar_url already exists.")
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        sys.exit(1)
