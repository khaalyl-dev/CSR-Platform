#!/usr/bin/env python3
"""
Add rejected_activity_ids column to validations table if missing.
Run from backend folder: python run_migration_validations_rejected_activity_ids.py
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
                  AND TABLE_NAME = 'validations'
                  AND COLUMN_NAME = 'rejected_activity_ids'
            """))
            exists = r.scalar() > 0
        except Exception as e:
            print("Could not check column:", e)
            sys.exit(1)

        if exists:
            print("Column validations.rejected_activity_ids already exists. Nothing to do.")
            return

        print("Adding column validations.rejected_activity_ids ...")
        try:
            db.session.execute(text("""
                ALTER TABLE validations
                ADD COLUMN rejected_activity_ids TEXT NULL
                COMMENT 'IDs des activités à modifier (JSON array) en cas de rejet'
            """))
            db.session.commit()
            print("Done.")
        except Exception as e:
            db.session.rollback()
            print("Migration failed:", e)
            sys.exit(1)


if __name__ == "__main__":
    run()
