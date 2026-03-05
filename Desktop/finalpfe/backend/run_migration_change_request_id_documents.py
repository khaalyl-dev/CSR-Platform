#!/usr/bin/env python3
"""
Add change_request_id column to documents if missing.
Run from backend folder: python run_migration_change_request_id_documents.py
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
                  AND TABLE_NAME = 'documents'
                  AND COLUMN_NAME = 'change_request_id'
            """))
            exists = r.scalar() > 0
        except Exception as e:
            print("Could not check column:", e)
            sys.exit(1)

        if exists:
            print("Column documents.change_request_id already exists. Nothing to do.")
            return

        print("Adding column documents.change_request_id ...")
        try:
            db.session.execute(text("""
                ALTER TABLE documents
                ADD COLUMN change_request_id CHAR(36) NULL
                COMMENT 'Demande de modification à laquelle ce document est joint'
            """))
            db.session.execute(text("""
                ALTER TABLE documents
                ADD CONSTRAINT fk_documents_change_request
                FOREIGN KEY (change_request_id) REFERENCES change_requests(id) ON DELETE CASCADE
            """))
            db.session.commit()
            print("Done.")
        except Exception as e:
            db.session.rollback()
            print("Error:", e)
            sys.exit(1)


if __name__ == "__main__":
    run()
