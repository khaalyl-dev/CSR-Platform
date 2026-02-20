"""
RealizedCsr model - aligned with schema.dbml realized_csr table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class RealizedCsr(db.Model):
    __tablename__ = "realized_csr"
    __table_args__ = (
        db.Index("ix_realized_csr_year_month", "year", "month"),
        {
            "comment": "Activités réalisées (saisie réalisations, coûts, participants, impact)",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant de la réalisation")
    activity_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("csr_activities.id", ondelete="CASCADE"), nullable=False,
        comment="Activité (planifiée ou hors plan)"
    )
    year = db.Column(db.Integer, nullable=False, comment="Année de réalisation")
    month = db.Column(db.Integer, nullable=False, comment="Mois de réalisation")
    realized_budget = db.Column(db.Numeric(15, 2), nullable=True, comment="Budget réel dépensé (€)")
    participants = db.Column(db.Integer, nullable=True, comment="Nombre de participants internes")
    total_hc = db.Column(db.Integer, nullable=True, comment="Effectif total du site")
    percentage_employees = db.Column(db.Numeric(5, 2), nullable=True, comment="% des employés participants")
    volunteer_hours = db.Column(db.Numeric(10, 2), nullable=True, comment="Heures de volontariat")
    action_impact_actual = db.Column(db.Numeric(15, 2), nullable=True, comment="Impact réalisé")
    action_impact_unit = db.Column(db.String(100), nullable=True, comment="Unité d'impact")
    impact_description = db.Column(db.Text, nullable=True, comment="Description de l'impact")
    organizer = db.Column(db.String(255), nullable=True, comment="Organisateur (département)")
    number_external_partners = db.Column(db.Integer, nullable=True, comment="Nombre de partenaires externes")
    realization_date = db.Column(db.Date, nullable=True, comment="Date de réalisation")
    comment = db.Column(db.Text, nullable=True, comment="Commentaire")
    contact_department = db.Column(db.String(255), nullable=True, comment="Département du contact")
    contact_name = db.Column(db.String(255), nullable=True, comment="Nom du contact")
    contact_email = db.Column(db.String(255), nullable=True, comment="Email du contact")
    created_by = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Utilisateur ayant saisi"
    )
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de saisie")

    activity = db.relationship("CsrActivity", backref=db.backref("realized_csr", lazy="dynamic"))
