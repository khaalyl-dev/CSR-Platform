"""
Document model - uploaded files (profile photos, attachments for activities, change requests).

Stores file path, type (PDF, PNG, etc.), and links to site, entity (plan/activity), or
change_request. Files are stored on disk; this table just holds metadata.
"""
import uuid
import os
from sqlalchemy import CHAR
from core.db import db


def _uuid_default():
    """Generate a new UUID string for the primary key."""
    return str(uuid.uuid4())


class Document(db.Model):
    __tablename__ = "documents"
    __table_args__ = {
        "comment": "Fichiers joints liés aux sites CSR",
        "mysql_charset": "utf8mb4",
        "mysql_collate": "utf8mb4_unicode_ci",
    }

    id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True, default=_uuid_default)

    # ── Lien site ─────────────────────────────────────────────────────────────
    site_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"),
        db.ForeignKey("sites.id", ondelete="CASCADE"),
        nullable=True,
        comment="Site auquel appartient le document (NULL pour photo de profil)"
    )

    # ── Infos fichier ─────────────────────────────────────────────────────────
    file_name = db.Column(db.String(255), nullable=False, comment="Nom du fichier")
    file_path = db.Column(db.String(512), nullable=False, comment="Chemin de stockage")
    file_type = db.Column(db.String(20), nullable=True, comment="Type: PDF, DOCX, PNG, XLS...")
    is_pinned = db.Column(db.Boolean, default=False, comment="Document épinglé")

    # ── Lien demande de modification (optionnel) ───────────────────────────────
    change_request_id = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"),
        db.ForeignKey("change_requests.id", ondelete="CASCADE"),
        nullable=True,
        comment="Demande de modification à laquelle ce document est joint"
    )

    # ── Lien entité (ex. activité pour photos) ──────────────────────────────────
    entity_type = db.Column(db.String(20), nullable=True, comment="PLAN, ACTIVITY, etc.")
    entity_id = db.Column(CHAR(36, collation="utf8mb4_unicode_ci"), nullable=True, comment="ID de l'entité (ex. activity_id)")

    # ── Métadonnées ───────────────────────────────────────────────────────────
    uploaded_by = db.Column(
        CHAR(36, collation="utf8mb4_unicode_ci"),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Utilisateur ayant déposé le fichier"
    )
    uploaded_at = db.Column(db.DateTime, default=db.func.now(), comment="Date d'upload")
    updated_at = db.Column(
        db.DateTime,
        default=db.func.now(),
        onupdate=db.func.now(),
        comment="Date de dernière modification"
    )

    # ── Relations ─────────────────────────────────────────────────────────────
    site = db.relationship("Site", backref="documents", lazy="joined")
    uploader = db.relationship("User", backref="documents", lazy="joined")

    # ── Helper ────────────────────────────────────────────────────────────────
    @property
    def file_type_upper(self):
        """Return file type in uppercase (e.g. PDF, DOCX) for display or MIME lookup."""
        if self.file_type:
            return self.file_type.upper()
        ext = os.path.splitext(self.file_name)[1].lstrip('.').upper()
        return ext or "—"