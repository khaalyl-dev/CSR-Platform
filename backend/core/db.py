"""
Database - SQLAlchemy instance used by all models.

This file creates the shared 'db' object that we use to define tables (db.Model),
add/commit records (db.session), and create tables (db.create_all()). Import it
as: from core.db import db
"""
from flask_sqlalchemy import SQLAlchemy

# Single database instance - used by app.py and all model files
db = SQLAlchemy()
