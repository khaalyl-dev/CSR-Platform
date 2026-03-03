#!/usr/bin/env python
"""
Créer les tables csr_activities et realized_csr (et leurs dépendances si manquantes).

Usage :
    cd backend && python create_csr_tables.py

Si categories ou csr_plans n'existent pas, elles seront créées via db.create_all().
Des catégories de base sont ajoutées si la table categories est vide.
"""
from app import create_app
from core.db import db

# Importer tous les modèles pour enregistrer les tables
import models  # noqa: F401

from models.category import Category
from models.csr_activity import CsrActivity
from models.realized_csr import RealizedCsr


def create_csr_tables():
    app = create_app()
    with app.app_context():
        # Créer toutes les tables manquantes (categories, csr_plans, etc.)
        db.create_all()
        print("✓ Tables créées ou à jour")

        # Ajouter des catégories de base si vides
        if Category.query.count() == 0:
            for name in ["Environment", "Social", "Gouvernance", "Education", "Santé"]:
                db.session.add(Category(name=name))
            db.session.commit()
            print("✓ Catégories CSR ajoutées (Environment, Social, Gouvernance, Education, Santé)")
        else:
            print("✓ Catégories déjà présentes")

        try:
            from sqlalchemy import text
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE csr_plans ADD COLUMN rejected_comment TEXT NULL"))
                conn.commit()
            print("✓ Colonne rejected_comment ajoutée")
        except Exception as e:
            if "Duplicate" in str(e) or "1060" in str(e):
                pass
            else:
                print(f"  Note: rejected_comment - {e}")
        try:
            from sqlalchemy import text
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE csr_plans ADD COLUMN validation_step INT NULL"))
                conn.commit()
            print("✓ Colonne validation_step ajoutée")
        except Exception as e:
            if "Duplicate" in str(e) or "1060" in str(e):
                pass
            else:
                print(f"  Note: validation_step - {e}")

        print("✓ csr_activities et realized_csr prêts à l'usage")


if __name__ == "__main__":
    create_csr_tables()
