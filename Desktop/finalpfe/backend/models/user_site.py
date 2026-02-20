"""
UserSite model - many-to-many association between User and Site.

Aligned with schema.dbml user_sites table. Represents site access granted to a user.
- user_id, site_id: unique pair (one record per user-site)
- grade: optional validation level (level_0, level_1, level_2)
- is_active: soft delete (revoked access sets is_active=False)
- granted_by, granted_at: audit of who granted access and when
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    """Generate UUID string for primary key."""
    return str(uuid.uuid4())


class UserSite(db.Model):
    __tablename__ = "user_sites"
    __table_args__ = (
        db.UniqueConstraint("user_id", "site_id", name="uq_user_sites_user_site"),
        {
            "comment": "Association utilisateur–site: droits d'accès par site",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant de l'association")
    user_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        comment="Utilisateur"
    )
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("sites.id", ondelete="CASCADE"), nullable=False,
        comment="Site auquel l'accès est accordé"
    )
    grade = db.Column(
        db.String(20), nullable=True,
        comment="Niveau de validation: level_0, level_1, level_2"
    )
    is_active = db.Column(db.Boolean, nullable=False, default=True, comment="Accès actif ou non")
    granted_by = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Utilisateur ayant accordé l'accès"
    )
    granted_at = db.Column(db.DateTime, nullable=True, comment="Date d'attribution")

    user = db.relationship("User", foreign_keys=[user_id])
    site = db.relationship("Site", backref=db.backref("user_sites", lazy="dynamic"))
