"""
ChatbotLog model - aligned with schema.dbml chatbot_logs table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class ChatbotLog(db.Model):
    __tablename__ = "chatbot_logs"
    __table_args__ = {
        "comment": "Historique des échanges avec le chatbot",
        "mysql_charset": "utf8mb4",
        "mysql_collate": "utf8mb4_unicode_ci",
    }

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant")
    user_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        comment="Utilisateur"
    )
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("sites.id", ondelete="SET NULL"), nullable=True,
        comment="Site (contexte)"
    )
    question = db.Column(db.Text, nullable=True, comment="Question posée")
    answer = db.Column(db.Text, nullable=True, comment="Réponse du chatbot")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de l'échange")
