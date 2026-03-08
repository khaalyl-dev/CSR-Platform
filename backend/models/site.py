"""
Site model - aligned with schema.dbml sites table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class Site(db.Model):
    __tablename__ = "sites"
    __table_args__ = {
        "comment": "Sites / entités COFICAB (usine, plant)",
        "mysql_charset": "utf8mb4",
        "mysql_collate": "utf8mb4_unicode_ci",
    }

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant unique du site")
    name = db.Column(db.String(255), nullable=False, comment="Nom du site")
    code = db.Column(db.String(50), unique=True, nullable=False, index=True, comment="Code du site (ex. COFXX)")
    region = db.Column(db.String(255), nullable=True, comment="Région (ex. EE, America)")
    country = db.Column(db.String(255), nullable=True, comment="Pays")
    location = db.Column(db.String(255), nullable=True, comment="Adresse ou localisation")
    description = db.Column(db.Text, nullable=True, comment="Description du site")
    is_active = db.Column(db.Boolean, nullable=False, default=True, comment="Site actif ou non")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de création")
    updated_at = db.Column(
        db.DateTime, default=db.func.now(), onupdate=db.func.now(),
        comment="Dernière mise à jour"
    )
