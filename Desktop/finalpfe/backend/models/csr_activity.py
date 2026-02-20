"""
CsrActivity model - aligned with schema.dbml csr_activities table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class CsrActivity(db.Model):
    __tablename__ = "csr_activities"
    __table_args__ = (
        db.Index("ix_csr_activities_plan_id", "plan_id"),
        db.Index("ix_csr_activities_category_id", "category_id"),
        db.UniqueConstraint("plan_id", "activity_number", name="uq_csr_activities_plan_number"),
        {
            "comment": "Activités CSR (planifiées ou hors plan)",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant de l'activité")
    plan_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("csr_plans.id", ondelete="CASCADE"), nullable=False,
        comment="Plan annuel CSR"
    )
    category_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False,
        comment="Catégorie (Environment, Social, etc.)"
    )
    external_partner_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("external_partners.id", ondelete="SET NULL"), nullable=True,
        comment="Partenaire externe éventuel"
    )
    activity_number = db.Column(db.String(50), nullable=False, comment="Numéro d'activité (ex. CSR 1)")
    title = db.Column(db.String(255), nullable=False, comment="Titre / intitulé")
    description = db.Column(db.Text, nullable=True, comment="Description détaillée")
    activity_type = db.Column(db.String(255), nullable=True, comment="Type d'activité")
    organization = db.Column(
        db.String(20), nullable=False, default="INTERNAL",
        comment="Organisation: INTERNAL ou PARTNERSHIP"
    )
    collaboration_nature = db.Column(
        db.String(30), nullable=True,
        comment="Nature collaboration: CHARITY_DONATION, PARTNERSHIP, SPONSORSHIP, OTHERS"
    )
    contract_type = db.Column(
        db.String(30), nullable=False, default="ONE_SHOT",
        comment="Type contrat: ONE_SHOT ou SUCCESSIVE_PERFORMANCE"
    )
    periodicity = db.Column(db.String(100), nullable=True, comment="Périodicité (ex. NA, Every year)")
    is_off_plan = db.Column(db.Boolean, nullable=False, default=False, comment="Activité hors plan")
    planned_budget = db.Column(db.Numeric(15, 2), nullable=True, comment="Budget prévu (€)")
    planned_volunteers = db.Column(db.Integer, nullable=True, comment="Nombre prévu de volontaires")
    action_impact_target = db.Column(db.Numeric(15, 2), nullable=True, comment="Objectif d'impact")
    action_impact_unit = db.Column(db.String(100), nullable=True, comment="Unité d'impact (Trees, etc.)")
    action_impact_duration = db.Column(db.String(100), nullable=True, comment="Durée de l'impact")
    sustainability_description = db.Column(db.Text, nullable=True, comment="Durabilité de l'action")
    start_year = db.Column(db.Integer, nullable=True, comment="Année de démarrage")
    edition = db.Column(db.Integer, nullable=True, comment="Numéro d'édition")
    organizer = db.Column(db.String(255), nullable=True, comment="Organisateur (ex. HR)")
    responsible_user_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Responsable de l'activité"
    )
    start_date = db.Column(db.Date, nullable=True, comment="Date de début prévue")
    end_date = db.Column(db.Date, nullable=True, comment="Date de fin prévue")
    status = db.Column(
        db.String(20), nullable=False, default="DRAFT",
        comment="Statut: DRAFT, IN_PROGRESS, COMPLETED, CANCELLED, VALIDATED"
    )
    kpi_value = db.Column(db.Numeric(15, 2), nullable=True, comment="Valeur KPI cible")
    kpi_unit = db.Column(db.String(100), nullable=True, comment="Unité du KPI")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de création")
    updated_at = db.Column(
        db.DateTime, default=db.func.now(), onupdate=db.func.now(),
        comment="Dernière mise à jour"
    )

    plan = db.relationship("CsrPlan", backref=db.backref("csr_activities", lazy="dynamic"))
    category = db.relationship("Category", backref=db.backref("csr_activities", lazy="dynamic"))
