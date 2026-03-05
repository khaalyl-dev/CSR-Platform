#!/usr/bin/env python3
"""
Add to csr_activities, if missing: organization, collaboration_nature, organizer,
planned_volunteers, action_impact_target, action_impact_unit.

Run from backend folder: python run_migration_csr_activities_columns.py

See also: bd/migrations/006_csr_activities_planned_impact_organizer.sql
"""
import sys

from sqlalchemy import text

from app import create_app
from core.db import db

COLUMNS = [
    ("organization", "ADD COLUMN organization VARCHAR(20) NOT NULL DEFAULT 'INTERNAL' "
     "COMMENT 'Organisation: INTERNAL ou PARTNERSHIP' AFTER planned_budget"),
    ("collaboration_nature", "ADD COLUMN collaboration_nature VARCHAR(30) NULL "
     "COMMENT 'Nature: CHARITY_DONATION, PARTNERSHIP, SPONSORSHIP, OTHERS' AFTER organization"),
    ("organizer", "ADD COLUMN organizer VARCHAR(255) NULL COMMENT 'Organisateur (ex. HR)' AFTER collaboration_nature"),
    ("planned_volunteers", "ADD COLUMN planned_volunteers INT NULL COMMENT 'Nombre prévu de volontaires' AFTER organizer"),
    ("action_impact_target", "ADD COLUMN action_impact_target DECIMAL(15,2) NULL COMMENT 'Objectif impact' AFTER planned_volunteers"),
    ("action_impact_unit", "ADD COLUMN action_impact_unit VARCHAR(100) NULL COMMENT 'Unité impact' AFTER action_impact_target"),
]


def column_exists(table: str, column: str) -> bool:
    """Check if column exists (MySQL information_schema)."""
    r = db.session.execute(text("""
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :tbl
          AND COLUMN_NAME = :col
    """), {"tbl": table, "col": column})
    return r.scalar() > 0


def run():
    app = create_app()
    with app.app_context():
        for col_name, add_sql in COLUMNS:
            if column_exists("csr_activities", col_name):
                print(f"  Column csr_activities.{col_name} already exists. Skip.")
                continue
            print(f"  Adding csr_activities.{col_name} ...")
            try:
                db.session.execute(text(f"ALTER TABLE csr_activities {add_sql}"))
                db.session.commit()
                print(f"  Done: {col_name}")
            except Exception as e:
                db.session.rollback()
                print(f"  Error adding {col_name}:", e)
                sys.exit(1)
        print("✓ csr_activities columns migration finished.")


if __name__ == "__main__":
    run()
