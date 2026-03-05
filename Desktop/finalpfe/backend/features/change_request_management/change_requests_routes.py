"""
Change requests endpoints.
- Create: site user with access to plan can request change (plan must be VALIDATED).
- List: site user sees own; corporate sees all or by status.
- Approve/Reject: corporate only. On approve, plan stays VALIDATED (verrouillé); unlock_until is set so it is temporarily editable.
"""
from flask import Blueprint, jsonify, request
from core import db, token_required, role_required
from models import ChangeRequest, CsrPlan, Document, UserSite
from features.notification_management.notification_helper import notify_corporate, notify_user

bp = Blueprint("change_requests", __name__, url_prefix="/api/change-requests")


def _user_can_access_site(user_id: str, site_id: str) -> bool:
    us = UserSite.query.filter_by(user_id=user_id, site_id=site_id, is_active=True).first()
    return us is not None


def _change_request_to_json(cr: ChangeRequest, include_documents=False):
    out = {
        "id": cr.id,
        "site_id": cr.site_id,
        "site_name": cr.site.name if cr.site else None,
        "entity_type": cr.entity_type,
        "entity_id": cr.entity_id,
        "year": cr.year,
        "reason": cr.reason,
        "status": cr.status,
        "requested_by": cr.requested_by,
        "requested_by_name": f"{cr.requester.first_name} {cr.requester.last_name}" if cr.requester else None,
        "requested_duration": cr.requested_duration,
        "reviewed_by": cr.reviewed_by,
        "reviewed_by_name": f"{cr.reviewer.first_name} {cr.reviewer.last_name}" if cr.reviewer else None,
        "reviewed_at": cr.reviewed_at.isoformat() if cr.reviewed_at else None,
        "created_at": cr.created_at.isoformat() if cr.created_at else None,
    }
    if include_documents:
        docs = Document.query.filter_by(change_request_id=cr.id).order_by(Document.uploaded_at.asc()).all()
        out["documents"] = [
            {
                "id": d.id,
                "file_name": d.file_name,
                "file_path": d.file_path,
                "file_type": d.file_type_upper if hasattr(d, "file_type_upper") else (d.file_type or ""),
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            }
            for d in docs
        ]
    # Plan summary when entity_type is PLAN
    if cr.entity_type == "PLAN" and cr.entity_id:
        plan = CsrPlan.query.get(cr.entity_id)
        if plan:
            out["plan_site_name"] = plan.site.name if plan.site else None
            out["plan_year"] = plan.year
    return out


def _parse_duration_days(raw) -> int:
    """Parse requested_duration to number of days. Accepts int or string like '7', '14', '30' or '7 days'."""
    if raw is None:
        return 30
    if isinstance(raw, int) and raw > 0:
        return min(365, max(1, raw))
    s = (str(raw).strip() or "30").lower()
    for part in s.split():
        if part.isdigit():
            return min(365, max(1, int(part)))
    return 30


@bp.post("")
@token_required
def create_change_request():
    """Create a change request for a validated plan. Body: plan_id, reason (required), requested_duration (optional, days)."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "Données manquantes"}), 400
    plan_id = (data.get("plan_id") or "").strip()
    reason = (data.get("reason") or "").strip()
    requested_duration = data.get("requested_duration")
    if not plan_id:
        return jsonify({"message": "plan_id obligatoire"}), 400
    if not reason:
        return jsonify({"message": "La justification (reason) est obligatoire"}), 400
    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    if plan.status != "VALIDATED":
        return jsonify({"message": "Seuls les plans validés peuvent faire l'objet d'une demande de modification"}), 400
    role = (getattr(request, "role", "") or "").upper()
    user_id = request.user_id
    if role in ("SITE_USER", "SITE"):
        if not _user_can_access_site(user_id, plan.site_id):
            return jsonify({"message": "Vous n'avez pas accès à ce site"}), 403
    duration_days = _parse_duration_days(requested_duration)
    duration_label = f"{duration_days} jours"
    cr = ChangeRequest(
        site_id=plan.site_id,
        entity_type="PLAN",
        entity_id=plan.id,
        year=plan.year,
        reason=reason,
        status="PENDING",
        requested_by=user_id,
        requested_duration=duration_label,
    )
    db.session.add(cr)
    db.session.commit()

    site_name = plan.site.name if plan.site else "Site inconnu"
    notify_corporate(
        title="Nouvelle demande de modification",
        message=(
            f"Le site {site_name} a demande une modification pour le plan CSR {plan.year}. "
            f"Motif: {reason}"
        ),
        type="warning",
        site_id=plan.site_id,
        entity_type="CHANGE_REQUEST",
        entity_id=cr.id,
    )

    return jsonify(_change_request_to_json(cr, include_documents=True)), 201


@bp.get("")
@token_required
def list_change_requests():
    """List change requests. Query: status (optional). Site user: only own. Corporate: all."""
    status = (request.args.get("status") or "").strip().upper() or None
    role = (getattr(request, "role", "") or "").upper()
    user_id = request.user_id
    if role in ("CORPORATE_USER", "CORPORATE"):
        q = ChangeRequest.query
        if status:
            q = q.filter(ChangeRequest.status == status)
        q = q.order_by(ChangeRequest.created_at.desc())
        items = q.all()
    else:
        q = ChangeRequest.query.filter_by(requested_by=user_id)
        if status:
            q = q.filter(ChangeRequest.status == status)
        q = q.order_by(ChangeRequest.created_at.desc())
        items = q.all()
    return jsonify([_change_request_to_json(cr) for cr in items]), 200


@bp.get("/<string:cr_id>")
@token_required
def get_change_request(cr_id):
    """Get one change request with documents."""
    cr = ChangeRequest.query.get(cr_id)
    if not cr:
        return jsonify({"message": "Demande introuvable"}), 404
    role = (getattr(request, "role", "") or "").upper()
    user_id = request.user_id
    if role in ("SITE_USER", "SITE"):
        if cr.requested_by != user_id:
            return jsonify({"message": "Accès non autorisé"}), 403
    return jsonify(_change_request_to_json(cr, include_documents=True)), 200


@bp.post("/<string:cr_id>/approve")
@token_required
def approve_change_request(cr_id):
    """Approve a change request. Corporate only. Keeps plan status VALIDATED (verrouillé) and sets unlock_until so the plan is temporarily editable."""
    from datetime import datetime, timedelta
    role = (getattr(request, "role", "") or "").upper()
    if role not in ("CORPORATE_USER", "CORPORATE"):
        return jsonify({"message": "Seul un utilisateur corporate peut approuver une demande de modification"}), 403
    cr = ChangeRequest.query.get(cr_id)
    if not cr:
        return jsonify({"message": "Demande introuvable"}), 404
    if cr.status != "PENDING":
        return jsonify({"message": "Cette demande n'est plus en attente"}), 400
    cr.status = "APPROVED"
    cr.reviewed_by = request.user_id
    cr.reviewed_at = datetime.utcnow()
    if cr.entity_type == "PLAN" and cr.entity_id:
        plan = CsrPlan.query.get(cr.entity_id)
        if plan:
            # Keep status VALIDATED (verrouillé); set unlock_until and unlock_since for highlighting
            now = datetime.utcnow()
            days = _parse_duration_days(cr.requested_duration)
            plan.unlock_until = now + timedelta(days=days)
            plan.unlock_since = now
    db.session.commit()

    site_name = cr.site.name if cr.site else "Site inconnu"
    notify_user(
        cr.requested_by,
        title="Demande de modification approuvee",
        message=(
            f"Votre demande de modification pour le site {site_name} a ete approuvee. "
            f"Le plan est maintenant ouvert pendant {cr.requested_duration or 'une periode limitee'}."
        ),
        type="success",
        site_id=cr.site_id,
        entity_type="CHANGE_REQUEST",
        entity_id=cr.id,
    )
    return jsonify(_change_request_to_json(cr, include_documents=True)), 200


@bp.post("/<string:cr_id>/reject")
@token_required
def reject_change_request(cr_id):
    """Reject a change request. Corporate only."""
    role = (getattr(request, "role", "") or "").upper()
    if role not in ("CORPORATE_USER", "CORPORATE"):
        return jsonify({"message": "Seul un utilisateur corporate peut rejeter une demande de modification"}), 403
    data = request.get_json(silent=True) or {}
    comment = (data.get("comment") or "").strip()
    cr = ChangeRequest.query.get(cr_id)
    if not cr:
        return jsonify({"message": "Demande introuvable"}), 404
    if cr.status != "PENDING":
        return jsonify({"message": "Cette demande n'est plus en attente"}), 400
    from datetime import datetime
    cr.status = "REJECTED"
    cr.reviewed_by = request.user_id
    cr.reviewed_at = datetime.utcnow()
    if comment:
        cr.reason = (cr.reason or "") + "\n[Rejet: " + comment + "]"
    db.session.commit()

    site_name = cr.site.name if cr.site else "Site inconnu"
    notify_user(
        cr.requested_by,
        title="Demande de modification rejetee",
        message=(
            f"Votre demande de modification pour le site {site_name} a ete rejetee. "
            f"Motif: {comment or 'Aucun motif precise.'}"
        ),
        type="error",
        site_id=cr.site_id,
        entity_type="CHANGE_REQUEST",
        entity_id=cr.id,
    )
    return jsonify(_change_request_to_json(cr, include_documents=True)), 200
