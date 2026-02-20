"""
Validation model - aligned with schema.dbml validations table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class Validation(db.Model):
    __tablename__ = "validations"
    __table_args__ = (
        db.UniqueConstraint("entity_type", "entity_id", "grade", name="uq_validations_entity_grade"),
        {
            "comment": "Enregistrement des validations (plans ou activités)",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant de la validation")
    entity_type = db.Column(db.String(20), nullable=False, comment="Type: PLAN ou ACTIVITY")
    entity_id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), nullable=False, comment="ID du plan ou de l'activité")
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("sites.id", ondelete="CASCADE"), nullable=False,
        comment="Site concerné"
    )
    grade = db.Column(
        db.String(20), nullable=True,
        comment="Niveau de validation: level_0, level_1, level_2"
    )
    status = db.Column(
        db.String(20), nullable=False, default="PENDING",
        comment="Statut: PENDING, APPROVED, REJECTED"
    )
    validated_by = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Validateur"
    )
    comment = db.Column(db.Text, nullable=True, comment="Commentaire (rejet / remarque)")
    validated_at = db.Column(db.DateTime, nullable=True, comment="Date de décision")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de création de la demande")
