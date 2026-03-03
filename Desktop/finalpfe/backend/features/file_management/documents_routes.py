import os
from flask import Blueprint, jsonify, send_from_directory, request
from core import db, token_required
from models import Document, UserSite
from datetime import datetime

bp = Blueprint("documents", __name__, url_prefix="/api/documents")

MEDIA_FOLDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', '..', '..', 'frontend', 'src', 'media'
)

def _document_to_json(doc: Document):
    return {
        "id": doc.id,
        "site_id": doc.site_id,
        "site_name": doc.site.name if doc.site else "",
        "file_name": doc.file_name,
        "file_path": doc.file_path,
        "file_type": doc.file_type_upper,
        "is_pinned": doc.is_pinned,  # ← manquait
        "uploaded_by": doc.uploaded_by or "",
        "uploader_name": f"{doc.uploader.first_name} {doc.uploader.last_name}" if doc.uploader else "—",
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }

@bp.post("")
@token_required
def create_document():
    """Create a document record (file must already exist in media folder). Body: site_id, file_name, file_path (relative), file_type, is_pinned (optional)."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "Données manquantes"}), 400
    site_id = data.get("site_id")
    file_name = (data.get("file_name") or "").strip()
    file_path = (data.get("file_path") or "").strip()
    file_type = (data.get("file_type") or "").strip().upper() or None
    if not site_id or not file_name or not file_path:
        return jsonify({"message": "site_id, file_name et file_path sont obligatoires"}), 400
    full_path = os.path.join(MEDIA_FOLDER, file_path)
    if not os.path.isfile(full_path):
        return jsonify({"message": "Le fichier n'existe pas dans le dossier media"}), 400
    if not file_type:
        ext = os.path.splitext(file_name)[1].lstrip(".").upper()
        file_type = ext or "PDF"
    role = (getattr(request, "role", "") or "").upper()
    if role not in ("CORPORATE_USER", "CORPORATE"):
        user_sites = UserSite.query.filter_by(user_id=request.user_id, is_active=True).all()
        site_ids = [us.site_id for us in user_sites]
        if site_id not in site_ids:
            return jsonify({"message": "Vous n'avez pas accès à ce site"}), 403
    from models import Site
    if not Site.query.get(site_id):
        return jsonify({"message": "Site introuvable"}), 404
    doc = Document(
        site_id=site_id,
        file_name=file_name,
        file_path=file_path,
        file_type=file_type,
        is_pinned=bool(data.get("is_pinned")),
        uploaded_by=getattr(request, "user_id", None),
    )
    db.session.add(doc)
    db.session.commit()
    return jsonify(_document_to_json(doc)), 201


@bp.get("")
@token_required
def list_documents():
    role = request.role.upper()
    if role == "CORPORATE_USER":
        documents = Document.query.order_by(Document.uploaded_at.desc()).all()
    else:
        user_sites = UserSite.query.filter_by(user_id=request.user_id, is_active=True).all()
        site_ids = [us.site_id for us in user_sites]
        if not site_ids:
            return jsonify([]), 200
        documents = Document.query.filter(
            Document.site_id.in_(site_ids)
        ).order_by(Document.uploaded_at.desc()).all()
    return jsonify([_document_to_json(d) for d in documents]), 200

@bp.get("/pinned")
@token_required
def list_pinned():
    role = request.role.upper()
    if role == "CORPORATE_USER":
        docs = Document.query.filter_by(is_pinned=True).all()
    else:
        user_sites = UserSite.query.filter_by(user_id=request.user_id, is_active=True).all()
        site_ids = [us.site_id for us in user_sites]
        docs = Document.query.filter(
            Document.site_id.in_(site_ids),
            Document.is_pinned == True
        ).all()
    return jsonify([_document_to_json(d) for d in docs]), 200

@bp.get("/download/<path:filename>")
@token_required
def download_file(filename):
    return send_from_directory(MEDIA_FOLDER, filename, as_attachment=True)

@bp.get("/site/<string:site_id>")
@token_required
def list_site_documents(site_id):
    documents = Document.query.filter_by(site_id=site_id)\
        .order_by(Document.uploaded_at.desc()).all()
    return jsonify([_document_to_json(d) for d in documents]), 200

@bp.patch("/<string:doc_id>/pin")  # ← manquait
@token_required
def toggle_pin(doc_id):
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({"message": "Document introuvable"}), 404
    doc.is_pinned = not doc.is_pinned
    db.session.commit()
    return jsonify({"message": "OK", "is_pinned": doc.is_pinned}), 200

@bp.put("/<string:doc_id>")
@token_required
def update_document(doc_id):
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({"message": "Document introuvable"}), 404
    data = request.get_json()
    if "file_name" in data:
        doc.file_name = data["file_name"]
    if "file_type" in data:
        doc.file_type = data["file_type"].upper() if data["file_type"] else None
    if "site_id" in data:
        doc.site_id = data["site_id"]
    doc.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_document_to_json(doc)), 200

@bp.delete("/<string:doc_id>")
@token_required
def delete_document(doc_id):
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({"message": "Document introuvable"}), 404
    file_path = os.path.join(MEDIA_FOLDER, doc.file_path)
    if os.path.exists(file_path):
        os.remove(file_path)
    db.session.delete(doc)
    db.session.commit()
    return jsonify({"message": "Document supprimé"}), 200