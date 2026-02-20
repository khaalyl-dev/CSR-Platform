"""
UserSession model - aligned with schema.dbml user_sessions table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class UserSession(db.Model):
    __tablename__ = "user_sessions"
    __table_args__ = {
        "comment": "Sessions et jetons de rafraîchissement (JWT)",
        "mysql_charset": "utf8mb4",
        "mysql_collate": "utf8mb4_unicode_ci",
    }

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant de la session")
    user_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        comment="Utilisateur concerné"
    )
    refresh_token = db.Column(db.String(512), nullable=False, index=True, comment="Jeton de rafraîchissement")
    ip_address = db.Column(db.String(45), nullable=True, comment="Adresse IP de connexion")
    user_agent = db.Column(db.String(512), nullable=True, comment="Navigateur / client")
    expires_at = db.Column(db.DateTime, nullable=False, comment="Date d'expiration de la session")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de création de la session")

    user = db.relationship("User", backref=db.backref("sessions", lazy="dynamic"))
