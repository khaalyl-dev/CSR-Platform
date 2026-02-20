"""
Category model - aligned with schema.dbml categories table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class Category(db.Model):
    __tablename__ = "categories"
    __table_args__ = {
        "comment": "Catégories d'activités CSR (Environnement, Social, Gouvernance, etc.)",
        "mysql_charset": "utf8mb4",
        "mysql_collate": "utf8mb4_unicode_ci",
    }

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant de la catégorie")
    name = db.Column(db.String(255), nullable=False, comment="Nom (ex. Environment, Education, Social)")
    description = db.Column(db.Text, nullable=True, comment="Description de la catégorie")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de création")
    updated_at = db.Column(
        db.DateTime, default=db.func.now(), onupdate=db.func.now(),
        comment="Dernière mise à jour"
    )
