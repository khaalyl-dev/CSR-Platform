#!/usr/bin/env python3
"""
Add rejected_activity_id column to csr_plans if missing.
Run from backend folder: python run_migration_rejected_activity_id.py
"""
import sys

from sqlalchemy import text

from app import create_app
from core.db import db


def run():
    app = create_app()
    with app.app_context():
        # Check if column already exists (MySQL)
        try:
            r = db.session.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'csr_plans'
                  AND COLUMN_NAME = 'rejected_activity_id'
            """))
            exists = r.scalar() > 0
        except Exception as e:
            print("Could not check column:", e)
            sys.exit(1)

        if exists:
            print("Column csr_plans.rejected_activity_id already exists. Nothing to do.")
            return

        print("Adding column csr_plans.rejected_activity_id ...")
        try:
            db.session.execute(text("""
                ALTER TABLE csr_plans
                ADD COLUMN rejected_activity_id CHAR(36) NULL
                COMMENT 'Activité à modifier (si rejet ciblé)'
            """))
            db.session.execute(text("""
                ALTER TABLE csr_plans
                ADD CONSTRAINT fk_csr_plans_rejected_activity
                FOREIGN KEY (rejected_activity_id) REFERENCES csr_activities(id) ON DELETE SET NULL
            """))
            db.session.commit()
            print("Done. Column and foreign key added.")
        except Exception as e:
            db.session.rollback()
            print("Migration failed:", e)
            sys.exit(1)


if __name__ == "__main__":
    run()
