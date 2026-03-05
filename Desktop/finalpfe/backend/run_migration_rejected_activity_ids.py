#!/usr/bin/env python3
"""
Migrate csr_plans from single rejected_activity_id to rejected_activity_ids (JSON array).
- Adds rejected_activity_ids TEXT if missing
- Copies existing rejected_activity_id into rejected_activity_ids as one-element array
- Drops FK and column rejected_activity_id

Run from backend folder: python run_migration_rejected_activity_ids.py
"""
import json
import sys

from sqlalchemy import text

from app import create_app
from core.db import db


def run():
    app = create_app()
    with app.app_context():
        # Check if new column already exists
        try:
            r = db.session.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'csr_plans'
                  AND COLUMN_NAME = 'rejected_activity_ids'
            """))
            has_new = r.scalar() > 0
        except Exception as e:
            print("Could not check columns:", e)
            sys.exit(1)

        if has_new:
            # Check if old column still exists (need to drop it)
            r = db.session.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'csr_plans'
                  AND COLUMN_NAME = 'rejected_activity_id'
            """))
            has_old = r.scalar() > 0
            if not has_old:
                print("Already migrated (rejected_activity_ids present, rejected_activity_id removed). Nothing to do.")
                return
        else:
            # Add new column
            print("Adding column csr_plans.rejected_activity_ids ...")
            db.session.execute(text("""
                ALTER TABLE csr_plans
                ADD COLUMN rejected_activity_ids TEXT NULL
                COMMENT 'IDs des activités à modifier (JSON array)'
            """))
            db.session.commit()

        # Migrate data: copy rejected_activity_id -> rejected_activity_ids (if old column exists)
        try:
            r = db.session.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'csr_plans'
                  AND COLUMN_NAME = 'rejected_activity_id'
            """))
            has_old = r.scalar() > 0
        except Exception:
            has_old = False

        if has_old:
            print("Migrating existing rejected_activity_id values...")
            # Get plans that have rejected_activity_id set
            r = db.session.execute(text("""
                SELECT id, rejected_activity_id FROM csr_plans
                WHERE rejected_activity_id IS NOT NULL
            """))
            rows = r.fetchall()
            for row in rows:
                plan_id, act_id = row[0], row[1]
                if act_id:
                    db.session.execute(
                        text("UPDATE csr_plans SET rejected_activity_ids = :ids WHERE id = :pid"),
                        {"ids": json.dumps([act_id]), "pid": plan_id}
                    )
            db.session.commit()
            print("Dropping FK and column rejected_activity_id...")
            # Drop FK first (MySQL)
            try:
                db.session.execute(text("""
                    ALTER TABLE csr_plans DROP FOREIGN KEY fk_csr_plans_rejected_activity
                """))
            except Exception:
                pass  # FK name might differ
            db.session.execute(text("ALTER TABLE csr_plans DROP COLUMN rejected_activity_id"))
            db.session.commit()
            print("Done.")
        else:
            print("No rejected_activity_id column to migrate. Done.")


if __name__ == "__main__":
    run()
