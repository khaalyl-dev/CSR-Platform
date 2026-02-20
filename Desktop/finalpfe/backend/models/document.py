"""
Document model - aligned with schema.dbml documents table.
"""
import uuid

from sqlalchemy import CHAR

from core.db import db


def _uuid_default():
    return str(uuid.uuid4())


class Document(db.Model):
    __tablename__ = "documents"
    __table_args__ = {
        "comment": "Fichiers joints (photos, Excel, PDF, Word) liés aux plans ou activités",
        "mysql_charset": "utf8mb4",
        "mysql_collate": "utf8mb4_unicode_ci",
    }

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default, comment="Identifiant du document")
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("sites.id", ondelete="CASCADE"), nullable=False,
        comment="Site"
    )
    entity_type = db.Column(db.String(20), nullable=False, comment="Type: PLAN ou ACTIVITY")
    entity_id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), nullable=False, comment="Plan ou activité lié")
    file_name = db.Column(db.String(255), nullable=False, comment="Nom du fichier")
    file_path = db.Column(db.String(512), nullable=False, comment="Chemin de stockage")
    uploaded_by = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Utilisateur ayant déposé le fichier"
    )
    uploaded_at = db.Column(db.DateTime, default=db.func.now(), comment="Date d'upload")
