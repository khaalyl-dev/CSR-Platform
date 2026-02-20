"""
CsrPlan model - aligned with schema.dbml csr_plans table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class CsrPlan(db.Model):
    __tablename__ = "csr_plans"
    __table_args__ = (
        db.UniqueConstraint("site_id", "year", name="uq_csr_plans_site_year"),
        {
            "comment": "Plans annuels CSR par site",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant du plan")
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("sites.id", ondelete="CASCADE"), nullable=False,
        comment="Site concerné"
    )
    year = db.Column(db.Integer, nullable=False, comment="Année du plan")
    validation_mode = db.Column(
        db.String(10), nullable=False, default="101",
        comment="Mode de validation: 101 ou 111"
    )
    status = db.Column(
        db.String(20), nullable=False, default="DRAFT",
        comment="Statut: DRAFT, SUBMITTED, VALIDATED, REJECTED, LOCKED"
    )
    total_budget = db.Column(db.Numeric(15, 2), nullable=True, comment="Budget total du plan (€)")
    submitted_at = db.Column(db.DateTime, nullable=True, comment="Date de soumission")
    validated_at = db.Column(db.DateTime, nullable=True, comment="Date de validation finale")
    created_by = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Créateur du plan"
    )
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de création")
    updated_at = db.Column(
        db.DateTime, default=db.func.now(), onupdate=db.func.now(),
        comment="Dernière mise à jour"
    )

    site = db.relationship("Site", backref=db.backref("csr_plans", lazy="dynamic"))
