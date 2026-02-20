#!/usr/bin/env python
"""
Create all database tables based on schema.dbml.

Drops existing tables and recreates them. Run BEFORE starting the app.
Run: python create_tables.py

WARNING: This will DELETE all existing data. Use only for fresh setup.
"""
from flask import Flask

from config import Config
from core.db import db

# Import all models to register them with SQLAlchemy (do NOT import app - it calls create_all)
import models  # noqa: F401


def create_tables():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    with app.app_context():
        print("Dropping all tables...")
        db.drop_all()
        print("Creating all tables...")
        db.create_all()
        print("✓ All tables created successfully (schema.dbml)")


if __name__ == "__main__":
    create_tables()
