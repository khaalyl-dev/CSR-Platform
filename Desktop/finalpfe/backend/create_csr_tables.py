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
            db.session.execute(text("ALTER TABLE csr_plans ADD COLUMN validation_step INT NULL"))
            db.session.commit()
            print("✓ Colonne validation_step ajoutée")
        except Exception as e:
            db.session.rollback()
            if "Duplicate" in str(e) or "1060" in str(e):
                pass
            else:
                print(f"  Note: validation_step - {e}")

        # csr_activities: colonnes pour édition (volontaires prévus, impact, nature collab., organisateur)
        from sqlalchemy import text as sql_text
        csr_activity_columns = [
            ("organization", "ADD COLUMN organization VARCHAR(20) NOT NULL DEFAULT 'INTERNAL' COMMENT 'Organisation' AFTER planned_budget"),
            ("collaboration_nature", "ADD COLUMN collaboration_nature VARCHAR(30) NULL COMMENT 'Nature collaboration' AFTER organization"),
            ("organizer", "ADD COLUMN organizer VARCHAR(255) NULL COMMENT 'Organisateur' AFTER collaboration_nature"),
            ("planned_volunteers", "ADD COLUMN planned_volunteers INT NULL COMMENT 'Volontaires prévus' AFTER organizer"),
            ("action_impact_target", "ADD COLUMN action_impact_target DECIMAL(15,2) NULL COMMENT 'Impact cible' AFTER planned_volunteers"),
            ("action_impact_unit", "ADD COLUMN action_impact_unit VARCHAR(100) NULL COMMENT 'Unité impact' AFTER action_impact_target"),
        ]
        for col_name, add_sql in csr_activity_columns:
            try:
                db.session.execute(sql_text(f"ALTER TABLE csr_activities {add_sql}"))
                db.session.commit()
                print(f"✓ csr_activities.{col_name} ajoutée")
            except Exception as e:
                db.session.rollback()
                if "Duplicate" in str(e) or "1060" in str(e):
                    pass
                else:
                    print(f"  Note: csr_activities.{col_name} - {e}")

        print("✓ csr_activities et realized_csr prêts à l'usage")


if __name__ == "__main__":
    create_csr_tables()
