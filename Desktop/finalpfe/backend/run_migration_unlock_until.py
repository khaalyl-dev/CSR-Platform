#!/usr/bin/env python3
"""
Add unlock_until column to csr_plans if missing.
Run from backend folder: python run_migration_unlock_until.py
"""
import sys

from sqlalchemy import text

from app import create_app
from core.db import db


def run():
    app = create_app()
    with app.app_context():
        try:
            r = db.session.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'csr_plans'
                  AND COLUMN_NAME = 'unlock_until'
            """))
            exists = r.scalar() > 0
        except Exception as e:
            print("Could not check column:", e)
            sys.exit(1)

        if exists:
            print("Column csr_plans.unlock_until already exists. Nothing to do.")
            return

        print("Adding column csr_plans.unlock_until ...")
        try:
            db.session.execute(text("""
                ALTER TABLE csr_plans
                ADD COLUMN unlock_until DATETIME NULL
                COMMENT 'Date limite de modification (après approbation demande de modification)'
            """))
            db.session.commit()
            print("Done.")
        except Exception as e:
            db.session.rollback()
            print("Error:", e)
            sys.exit(1)


if __name__ == "__main__":
    run()
