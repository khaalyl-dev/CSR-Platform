"""
User model - aligned with schema.dbml users table.
"""
import uuid

import bcrypt
from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = {
        "comment": "Utilisateurs du système (Site User, Corporate User)",
        "mysql_charset": "utf8mb4",
        "mysql_collate": "utf8mb4_unicode_ci",
    }

    id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default,
        comment="Identifiant unique de l'utilisateur"
    )
    first_name = db.Column(db.String(255), nullable=False, comment="Prénom")
    last_name = db.Column(db.String(255), nullable=False, comment="Nom")
    email = db.Column(
        db.String(255), unique=True, nullable=False, index=True,
        comment="Adresse email (identifiant de connexion)"
    )
    password_hash = db.Column(db.String(255), nullable=False, comment="Mot de passe hashé")
    role = db.Column(
        db.String(50), nullable=False, default="SITE_USER",
        comment="Rôle: SITE_USER ou CORPORATE_USER"
    )
    is_active = db.Column(db.Boolean, nullable=False, default=True, comment="Compte actif ou désactivé")
    is_corporate_global = db.Column(
        db.Boolean, nullable=False, default=False,
        comment="Accès corporate global (tous les sites)"
    )
    avatar_url = db.Column(db.String(512), nullable=True, comment="Chemin relatif de la photo de profil (ex: profile_photos/user_id.jpg)")
    phone = db.Column(db.String(64), nullable=True, comment="Téléphone utilisateur (avec préfixe pays)")
    language = db.Column(db.String(10), nullable=False, default="en", comment="Préférence langue (fr/en)")
    theme = db.Column(db.String(20), nullable=False, default="light", comment="Thème UI (light/dark)")
    notify_csr_plan_validation = db.Column(db.Boolean, nullable=False, default=True, comment="Notification validation plan CSR")
    notify_activity_validation = db.Column(db.Boolean, nullable=False, default=True, comment="Notification validation activité")
    notify_activity_reminders = db.Column(db.Boolean, nullable=False, default=True, comment="Rappels d'activités")
    notify_weekly_summary_email = db.Column(db.Boolean, nullable=False, default=True, comment="Email résumé CSR hebdomadaire")
    created_at = db.Column(db.DateTime, default=db.func.now(), comment="Date de création")
    updated_at = db.Column(
        db.DateTime, default=db.func.now(), onupdate=db.func.now(),
        comment="Dernière mise à jour"
    )

    def verify_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash.encode("utf-8"))

    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
