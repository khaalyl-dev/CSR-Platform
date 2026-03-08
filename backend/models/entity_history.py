"""
EntityHistory model - stores before/after data for each change (for rollback or audit).

For CREATE: old_data=null, new_data=json. For DELETE: old_data=json, new_data=null.
For UPDATE: both have the JSON. audit_logs can link to this via entity_history_id.
"""
import uuid

from sqlalchemy import CHAR
from sqlalchemy.dialects.mysql import JSON

from core.db import db


def _uuid_default():
    """Generate a new UUID string for the primary key."""
    return str(uuid.uuid4())


class EntityHistory(db.Model):
    __tablename__ = "entity_history"
    __table_args__ = (
        db.Index("ix_entity_history_site", "site_id"),
        db.Index("ix_entity_history_entity", "entity_type", "entity_id"),
        db.Index("ix_entity_history_modified", "modified_at"),
        {
            "comment": "Historique des modifications (old/new) pour rollback",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default)
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("sites.id", ondelete="SET NULL"), nullable=True
    )
    entity_type = db.Column(db.String(20), nullable=False)  # PLAN, ACTIVITY
    entity_id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), nullable=True)
    old_data = db.Column(JSON, nullable=True)  # NULL for CREATE
    new_data = db.Column(JSON, nullable=True)  # NULL for DELETE
    modified_by = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    modified_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)

    site = db.relationship("Site", backref=db.backref("entity_history", lazy="dynamic"))
    user = db.relationship("User", backref=db.backref("entity_history", lazy="dynamic"))
