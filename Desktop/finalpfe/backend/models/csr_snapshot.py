"""
CsrSnapshot model - aligned with schema.dbml csr_snapshots table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class CsrSnapshot(db.Model):
    __tablename__ = "csr_snapshots"
    __table_args__ = (
        db.UniqueConstraint("site_id", "year", "month", name="uq_csr_snapshots_site_year_month"),
        {
            "comment": "Snapshots pour Power BI (données agrégées par site, année, mois)",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant du snapshot")
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("sites.id", ondelete="CASCADE"), nullable=False,
        comment="Site"
    )
    year = db.Column(db.Integer, nullable=False, comment="Année")
    month = db.Column(db.Integer, nullable=False, comment="Mois")
    total_budget = db.Column(db.Numeric(15, 2), nullable=True, comment="Budget total")
    total_realized = db.Column(db.Numeric(15, 2), nullable=True, comment="Montant réalisé")
    total_activities = db.Column(db.Integer, nullable=True, comment="Nombre d'activités")
    completion_rate = db.Column(db.Numeric(5, 2), nullable=True, comment="Taux de réalisation")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de création du snapshot")
