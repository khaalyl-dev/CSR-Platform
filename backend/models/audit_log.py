"""
AuditLog model - audit trail of who did what (create, update, approve, reject, etc.).

Each row records: who (user_id), what action (CREATE, UPDATE, DELETE, APPROVE...),
which entity (plan or activity), when. Used for compliance and debugging.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    """Generate a new UUID string for the primary key."""
    return str(uuid.uuid4())


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    __table_args__ = (
        db.Index("ix_audit_logs_site", "site_id"),
        db.Index("ix_audit_logs_user", "user_id"),
        db.Index("ix_audit_logs_created", "created_at"),
        db.Index("ix_audit_logs_action", "action"),
        db.Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        {
            "comment": "Journal des actions pour traçabilité et audit",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default)
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("sites.id", ondelete="SET NULL"), nullable=True
    )
    user_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action = db.Column(db.String(64), nullable=False)  # CREATE, UPDATE, DELETE, APPROVE, REJECT, REQUEST_MODIFICATION
    entity_type = db.Column(db.String(20), nullable=False)  # PLAN, ACTIVITY
    entity_id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), nullable=True)
    description = db.Column(db.Text, nullable=True)
    entity_history_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("entity_history.id", ondelete="SET NULL"), nullable=True
    )
    created_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)

    site = db.relationship("Site", backref=db.backref("audit_logs", lazy="dynamic"))
    user = db.relationship("User", backref=db.backref("audit_logs", lazy="dynamic"))
