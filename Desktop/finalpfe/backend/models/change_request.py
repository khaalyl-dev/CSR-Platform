"""
ChangeRequest model - aligned with schema.dbml change_requests table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class ChangeRequest(db.Model):
    __tablename__ = "change_requests"
    __table_args__ = {
        "comment": "Demandes de modification pour périodes clôturées",
        "mysql_charset": "utf8mb4",
        "mysql_collate": "utf8mb4_unicode_ci",
    }

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant de la demande")
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("sites.id", ondelete="CASCADE"), nullable=False,
        comment="Site concerné"
    )
    entity_type = db.Column(db.String(20), nullable=False, comment="Type: PLAN ou ACTIVITY")
    entity_id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), nullable=False, comment="Plan ou activité à modifier")
    year = db.Column(db.Integer, nullable=False, comment="Année / période concernée")
    reason = db.Column(db.Text, nullable=True, comment="Justification de la demande")
    status = db.Column(
        db.String(20), nullable=False, default="PENDING",
        comment="Statut: PENDING, APPROVED, REJECTED"
    )
    requested_by = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        comment="Demandeur"
    )
    requested_duration = db.Column(
        db.String(100), nullable=True,
        comment="Durée demandée (ex: 30 days) - interval au format texte"
    )
    validation_mode = db.Column(
        db.String(10), nullable=True,
        comment="Mode de validation: 101 ou 111"
    )
    reviewed_by = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Relecteur corporate"
    )
    reviewed_at = db.Column(db.DateTime, nullable=True, comment="Date de décision")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de soumission")
