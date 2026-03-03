#!/usr/bin/env python3
"""
Insert diagrammeClasse.pdf into the documents table.
Run from backend directory: python scripts/insert_diagramme_document.py
Uses the first site in the database for site_id.
"""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from core.db import db
from models import Document, Site

FILE_NAME = "diagrammeClasse.pdf"
FILE_PATH = "diagrammeClasse.pdf"
FILE_TYPE = "PDF"


def main():
    media_folder = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "..", "frontend", "src", "media"
    )
    full_path = os.path.join(media_folder, FILE_PATH)
    if not os.path.isfile(full_path):
        print(f"Erreur: le fichier n'existe pas: {full_path}")
        sys.exit(1)

    with app.app_context():
        site = Site.query.order_by(Site.code).first()
        if not site:
            print("Erreur: aucun site dans la base. Créez d'abord un site.")
            sys.exit(1)

        existing = Document.query.filter_by(file_path=FILE_PATH).first()
        if existing:
            print(f"Le document {FILE_NAME} est déjà enregistré (id={existing.id}, site_id={existing.site_id}).")
            sys.exit(0)

        doc = Document(
            site_id=site.id,
            file_name=FILE_NAME,
            file_path=FILE_PATH,
            file_type=FILE_TYPE,
            is_pinned=False,
            uploaded_by=None,
        )
        db.session.add(doc)
        db.session.commit()
        print(f"Document inséré: id={doc.id}, site_id={doc.site_id}, file_name={doc.file_name}")


if __name__ == "__main__":
    main()
