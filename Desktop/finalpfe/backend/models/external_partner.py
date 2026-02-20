"""
ExternalPartner model - aligned with schema.dbml external_partners table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class ExternalPartner(db.Model):
    __tablename__ = "external_partners"
    __table_args__ = {
        "comment": "Partenaires externes (ONG, écoles, associations, etc.)",
        "mysql_charset": "utf8mb4",
        "mysql_collate": "utf8mb4_unicode_ci",
    }

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant du partenaire")
    name = db.Column(db.String(255), nullable=False, comment="Nom du partenaire")
    type = db.Column(
        db.String(50), nullable=False,
        comment="Type: NGO, SCHOOL, ASSOCIATION, SUPPLIER, GOVERNMENT, OTHER"
    )
    contact_person = db.Column(db.String(255), nullable=True, comment="Personne contact")
    email = db.Column(db.String(255), nullable=True, comment="Email")
    phone = db.Column(db.String(50), nullable=True, comment="Téléphone")
    address = db.Column(db.Text, nullable=True, comment="Adresse")
    website = db.Column(db.String(255), nullable=True, comment="Site web")
    description = db.Column(db.Text, nullable=True, comment="Description")
    is_active = db.Column(db.Boolean, nullable=False, default=True, comment="Partenaire actif ou non")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de création")
    updated_at = db.Column(
        db.DateTime, default=db.func.now(), onupdate=db.func.now(),
        comment="Dernière mise à jour"
    )
