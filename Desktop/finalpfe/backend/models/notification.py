"""
Notification model - aligned with schema.dbml notifications table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class Notification(db.Model):
    __tablename__ = "notifications"
    __table_args__ = {
        "comment": "Notifications système (alertes, rappels, validation/rejet)",
        "mysql_charset": "utf8mb4",
        "mysql_collate": "utf8mb4_unicode_ci",
    }

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant de la notification")
    user_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        comment="Utilisateur destinataire"
    )
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("sites.id", ondelete="CASCADE"), nullable=True,
        comment="Site concerné"
    )
    title = db.Column(db.String(255), nullable=False, comment="Titre")
    message = db.Column(db.Text, nullable=True, comment="Contenu du message")
    entity_type = db.Column(db.String(20), nullable=True, comment="Type: PLAN ou ACTIVITY")
    entity_id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), nullable=True, comment="Entité liée")
    is_read = db.Column(db.Boolean, nullable=False, default=False, comment="Notification lue ou non")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de création")
