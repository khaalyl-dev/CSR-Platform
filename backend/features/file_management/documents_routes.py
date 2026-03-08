import os
from flask import Blueprint, jsonify, send_from_directory, request
from sqlalchemy import or_
from config import get_media_folder
from core import db, token_required
from models import Document, UserSite
from datetime import datetime


def _exclude_profile_photos(query):
    """Exclude USER_PROFILE documents from list/pinned so they are not shown in the document interface."""
    return query.filter(or_(Document.entity_type.is_(None), Document.entity_type != "USER_PROFILE"))


bp = Blueprint("documents", __name__, url_prefix="/api/documents")

MEDIA_FOLDER = get_media_folder()

def _document_to_json(doc: Document):
    out = {
        "id": doc.id,
        "site_id": doc.site_id or "",
        "site_name": doc.site.name if doc.site else "",
        "file_name": doc.file_name,
        "file_path": doc.file_path,
        "file_type": doc.file_type_upper,
        "is_pinned": doc.is_pinned,
        "uploaded_by": doc.uploaded_by or "",
        "uploader_name": f"{doc.uploader.first_name} {doc.uploader.last_name}" if doc.uploader else "—",
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }
    if hasattr(doc, "change_request_id"):
        out["change_request_id"] = doc.change_request_id
    if hasattr(doc, "entity_type"):
        out["entity_type"] = doc.entity_type
    if hasattr(doc, "entity_id"):
        out["entity_id"] = doc.entity_id
    return out

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
        change_request_id=data.get("change_request_id") or None,
        entity_type=(data.get("entity_type") or "").strip().upper() or None,
        entity_id=(data.get("entity_id") or "").strip() or None,
    )
    db.session.add(doc)
    db.session.commit()
    return jsonify(_document_to_json(doc)), 201


UPLOAD_SUBFOLDER = "change_requests"
UPLOAD_SUBFOLDER_ACTIVITY_PHOTOS = "activity_photos"
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "gif", "webp"}
PHOTO_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def _allowed_file(filename):
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[-1].lower()
    return ext in ALLOWED_EXTENSIONS


def _upload_subfolder(entity_type: str) -> str:
    """Return subfolder for uploads: activity_photos for ACTIVITY, else change_requests."""
    return UPLOAD_SUBFOLDER_ACTIVITY_PHOTOS if (entity_type or "").upper() == "ACTIVITY" else UPLOAD_SUBFOLDER


@bp.post("/upload")
@token_required
def upload_document():
    """Upload a file (multipart): file (required), site_id (required), change_request_id (optional), entity_type (optional), entity_id (optional). Saves to media/change_requests/ or media/activity_photos/ and creates a Document row."""
    if "file" not in request.files:
        return jsonify({"message": "Aucun fichier fourni"}), 400
    f = request.files["file"]
    if not f or f.filename == "":
        return jsonify({"message": "Fichier vide ou nom manquant"}), 400
    if not _allowed_file(f.filename):
        return jsonify({"message": "Type de fichier non autorisé"}), 400
    site_id = (request.form.get("site_id") or "").strip()
    change_request_id = (request.form.get("change_request_id") or "").strip() or None
    entity_type = (request.form.get("entity_type") or "").strip().upper() or None
    entity_id = (request.form.get("entity_id") or "").strip() or None
    if not site_id:
        return jsonify({"message": "site_id obligatoire"}), 400
    role = (getattr(request, "role", "") or "").upper()
    if role not in ("CORPORATE_USER", "CORPORATE"):
        user_sites = UserSite.query.filter_by(user_id=request.user_id, is_active=True).all()
        site_ids = [us.site_id for us in user_sites]
        if site_id not in site_ids:
            return jsonify({"message": "Vous n'avez pas accès à ce site"}), 403
    from models import Site
    if not Site.query.get(site_id):
        return jsonify({"message": "Site introuvable"}), 404
    from datetime import datetime
    import uuid
    original = (f.filename or "file").strip()
    safe = "".join(c for c in original if c.isalnum() or c in "._- ").strip() or "file"
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    uid = str(uuid.uuid4())[:8]
    ext = safe.rsplit(".", 1)[-1].lower() if "." in safe else "bin"
    filename = f"{ts}_{uid}.{ext}"
    subfolder = _upload_subfolder(entity_type)
    subdir = os.path.join(MEDIA_FOLDER, subfolder)
    os.makedirs(subdir, exist_ok=True)
    relative_path = f"{subfolder}/{filename}"
    full_path = os.path.join(MEDIA_FOLDER, relative_path)
    f.save(full_path)
    file_size = os.path.getsize(full_path)
    file_type = ext.upper() if ext in ALLOWED_EXTENSIONS else "BIN"
    doc = Document(
        site_id=site_id,
        file_name=original,
        file_path=relative_path,
        file_type=file_type,
        is_pinned=False,
        uploaded_by=getattr(request, "user_id", None),
        change_request_id=change_request_id,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.session.add(doc)
    db.session.commit()
    out = _document_to_json(doc)
    out["file_size"] = file_size
    return jsonify(out), 201


@bp.get("")
@token_required
def list_documents():
    entity_type = request.args.get("entity_type", "").strip().upper() or None
    entity_id = request.args.get("entity_id", "").strip() or None
    role = request.role.upper()
    if role == "CORPORATE_USER":
        q = Document.query
    else:
        user_sites = UserSite.query.filter_by(user_id=request.user_id, is_active=True).all()
        site_ids = [us.site_id for us in user_sites]
        if not site_ids:
            return jsonify([]), 200
        q = Document.query.filter(Document.site_id.in_(site_ids))
    q = _exclude_profile_photos(q)
    if entity_type:
        q = q.filter(Document.entity_type == entity_type)
    if entity_id:
        q = q.filter(Document.entity_id == entity_id)
    documents = q.order_by(Document.uploaded_at.desc()).all()
    return jsonify([_document_to_json(d) for d in documents]), 200

@bp.get("/pinned")
@token_required
def list_pinned():
    role = request.role.upper()
    if role == "CORPORATE_USER":
        q = Document.query.filter_by(is_pinned=True)
    else:
        user_sites = UserSite.query.filter_by(user_id=request.user_id, is_active=True).all()
        site_ids = [us.site_id for us in user_sites]
        q = Document.query.filter(
            Document.site_id.in_(site_ids),
            Document.is_pinned == True
        )
    docs = _exclude_profile_photos(q).all()
    return jsonify([_document_to_json(d) for d in docs]), 200

@bp.get("/download/<path:filename>")
@token_required
def download_file(filename):
    return send_from_directory(MEDIA_FOLDER, filename, as_attachment=True)


def _media_folder_for(filename):
    """Return the media folder that contains the file, or MEDIA_FOLDER if not found elsewhere."""
    primary = os.path.join(MEDIA_FOLDER, filename)
    if os.path.isfile(primary):
        return MEDIA_FOLDER
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    fallback = os.path.join(backend_root, "frontend", "src", "media")
    fallback_path = os.path.join(fallback, filename)
    if os.path.isfile(fallback_path):
        return fallback
    return MEDIA_FOLDER


@bp.get("/serve/<path:filename>")
@token_required
def serve_file(filename):
    """Serve file for display (e.g. images in img src). No Content-Disposition attachment."""
    folder = _media_folder_for(filename)
    return send_from_directory(folder, filename, as_attachment=False)

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