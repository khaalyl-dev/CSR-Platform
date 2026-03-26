"""
Change requests endpoints.
- Create: site user with access to plan can request change (plan must be VALIDATED).
- List: site user sees own; corporate sees all or by status.
- Approve/Reject: corporate only. On approve, plan stays VALIDATED (verrouillé); unlock_until is set so it is temporarily editable.
"""
from typing import Optional

from flask import Blueprint, jsonify, request
from sqlalchemy import and_, or_
from sqlalchemy.orm import joinedload
from core import db, token_required, role_required
from models import AuditLog, ChangeRequest, CsrActivity, CsrPlan, Document, UserSite, User, RealizedCsr
from features.notification_management.notification_helper import notify_corporate, notify_user
from features.audit_history_management.audit_helper import write_audit

bp = Blueprint("change_requests", __name__, url_prefix="/api/change-requests")


def _user_can_access_site(user_id: str, site_id: str) -> bool:
    us = UserSite.query.filter_by(user_id=user_id, site_id=site_id, is_active=True).first()
    return us is not None


def _user_has_grade(user_id: str, site_id: str, grade: str) -> bool:
    us = UserSite.query.filter_by(
        user_id=user_id,
        site_id=site_id,
        is_active=True,
        grade=grade,
    ).first()
    return us is not None


def _user_has_any_grade(user_id: str, grade: str) -> bool:
    us = UserSite.query.filter_by(
        user_id=user_id,
        is_active=True,
        grade=grade,
    ).first()
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
    # Activity summary when entity_type is ACTIVITY
    if cr.entity_type == "ACTIVITY" and cr.entity_id:
        activity = CsrActivity.query.get(cr.entity_id)
        if activity and activity.plan:
            out["plan_site_name"] = activity.plan.site.name if activity.plan.site else None
            out["plan_year"] = activity.plan.year
            out["plan_id"] = activity.plan_id
            out["activity_title"] = activity.title or ""
            out["activity_number"] = activity.activity_number or ""
    return out


def _corporate_validation_step_pending(activity: CsrActivity) -> bool:
    """True if activity is SUBMITTED and the next validator is corporate (mode 101, or 111 with step 2)."""
    if not activity or activity.status != "SUBMITTED":
        return False
    mode = getattr(activity, "off_plan_validation_mode", None) or "101"
    step = getattr(activity, "off_plan_validation_step", None)
    if mode == "111":
        return step == 2
    return True


def _level1_validation_step_pending(activity: CsrActivity) -> bool:
    """True if activity is SUBMITTED and the next validator is level 1 (mode 111 step 1)."""
    if not activity or activity.status != "SUBMITTED":
        return False
    mode = getattr(activity, "off_plan_validation_mode", None) or "101"
    step = getattr(activity, "off_plan_validation_step", None)
    return mode == "111" and step == 1


def _off_plan_awaits_level1_validation(activity: CsrActivity) -> bool:
    """True if this off-plan activity is SUBMITTED and awaits level 1 validation."""
    if not activity or not getattr(activity, "is_off_plan", False):
        return False
    return _level1_validation_step_pending(activity)


def _off_plan_awaits_corporate_validation(activity: CsrActivity) -> bool:
    """True if this off-plan activity is SUBMITTED and the next step is corporate (mode 101, or 111 after L1)."""
    if not activity or not getattr(activity, "is_off_plan", False):
        return False
    return _corporate_validation_step_pending(activity)


def _in_plan_mod_awaits_corporate_validation(activity: CsrActivity) -> bool:
    """True if an in-plan activity was submitted for modification review and awaits corporate (same step rules as off-plan)."""
    if not activity or getattr(activity, "is_off_plan", False):
        return False
    plan = activity.plan
    if not plan or plan.status != "VALIDATED":
        return False
    return _corporate_validation_step_pending(activity)


def _pending_off_plan_corporate_item(activity: CsrActivity) -> dict:
    plan = activity.plan
    site = plan.site if plan else None
    requester_name = None
    realized = (
        RealizedCsr.query.filter_by(activity_id=activity.id)
        .order_by(RealizedCsr.created_at.desc())
        .first()
    )
    if realized and getattr(realized, "created_by", None):
        u = User.query.get(realized.created_by)
        if u:
            requester_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or None
    rid = (realized.created_by if realized else None) or ""
    # Synthetic list id (not a DB row); avoids colliding with change_requests.id UUIDs.
    synthetic_id = f"off-plan-{activity.id}"
    return {
        "pending_item_type": "OFF_PLAN_ACTIVITY",
        "id": synthetic_id,
        "activity_id": activity.id,
        "plan_id": activity.plan_id,
        "site_id": plan.site_id if plan else None,
        "site_name": site.name if site else None,
        "plan_site_name": site.name if site else None,
        "plan_year": plan.year if plan else None,
        "year": plan.year if plan else 0,
        "activity_number": activity.activity_number or "",
        "activity_title": activity.title or "",
        "entity_type": "ACTIVITY",
        "entity_id": activity.id,
        "reason": "Activité hors plan — validation corporate en attente.",
        "requested_by_name": requester_name,
        "requested_by": rid,
        "status": "PENDING",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": activity.created_at.isoformat() if activity.created_at else None,
        "off_plan_validation_mode": getattr(activity, "off_plan_validation_mode", None),
    }


def _pending_off_plan_level1_item(activity: CsrActivity) -> dict:
    plan = activity.plan
    site = plan.site if plan else None
    requester_name = None
    realized = (
        RealizedCsr.query.filter_by(activity_id=activity.id)
        .order_by(RealizedCsr.created_at.desc())
        .first()
    )
    if realized and getattr(realized, "created_by", None):
        u = User.query.get(realized.created_by)
        if u:
            requester_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or None
    rid = (realized.created_by if realized else None) or ""
    synthetic_id = f"off-plan-l1-{activity.id}"
    return {
        "pending_item_type": "OFF_PLAN_ACTIVITY",
        "id": synthetic_id,
        "activity_id": activity.id,
        "plan_id": activity.plan_id,
        "site_id": plan.site_id if plan else None,
        "site_name": site.name if site else None,
        "plan_site_name": site.name if site else None,
        "plan_year": plan.year if plan else None,
        "year": plan.year if plan else 0,
        "activity_number": activity.activity_number or "",
        "activity_title": activity.title or "",
        "entity_type": "ACTIVITY",
        "entity_id": activity.id,
        "reason": "Activité hors plan — validation niveau 1 en attente.",
        "requested_by_name": requester_name,
        "requested_by": rid,
        "status": "PENDING",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": activity.created_at.isoformat() if activity.created_at else None,
        "off_plan_validation_mode": getattr(activity, "off_plan_validation_mode", None),
    }


def _in_plan_mod_review_requester(activity: CsrActivity) -> tuple:
    """(user_id, display_name) for who submitted / resubmitted modification review; else responsible_user if set."""
    rid, requester_name = "", None
    log = (
        AuditLog.query.filter(
            AuditLog.entity_type == "ACTIVITY",
            AuditLog.entity_id == activity.id,
            AuditLog.user_id.isnot(None),
            or_(
                AuditLog.description == "Soumission modification activité (plan validé) pour validation",
                AuditLog.description == "Renvoi modification activité (plan validé) pour validation",
            ),
        )
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    if log and log.user_id:
        rid = log.user_id
        u = User.query.get(log.user_id)
        if u:
            requester_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or None
        return rid, requester_name
    if getattr(activity, "responsible_user_id", None):
        u = User.query.get(activity.responsible_user_id)
        if u:
            rid = activity.responsible_user_id
            requester_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or None
    return rid, requester_name


def _pending_in_plan_mod_corporate_item(activity: CsrActivity) -> dict:
    plan = activity.plan
    site = plan.site if plan else None
    rid, requester_name = _in_plan_mod_review_requester(activity)
    synthetic_id = f"in-plan-mod-{activity.id}"
    return {
        "pending_item_type": "IN_PLAN_ACTIVITY_MOD",
        "id": synthetic_id,
        "activity_id": activity.id,
        "plan_id": activity.plan_id,
        "site_id": plan.site_id if plan else None,
        "site_name": site.name if site else None,
        "plan_site_name": site.name if site else None,
        "plan_year": plan.year if plan else None,
        "year": plan.year if plan else 0,
        "activity_number": activity.activity_number or "",
        "activity_title": activity.title or "",
        "entity_type": "ACTIVITY",
        "entity_id": activity.id,
        "reason": "Modification d'activité sur plan validé — validation corporate en attente.",
        "requested_by_name": requester_name,
        "requested_by": rid,
        "status": "PENDING",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": activity.updated_at.isoformat() if activity.updated_at else None,
        "off_plan_validation_mode": getattr(activity, "off_plan_validation_mode", None),
    }


def _off_plan_mine_list_item(activity: CsrActivity, user_id: str) -> Optional[dict]:
    """Synthetic row for « Mes demandes » : off-plan activity created by user (via realized_csr.created_by)."""
    st = activity.status
    if st == "SUBMITTED":
        cr_status = "PENDING"
        reason = "Activité hors plan — en attente de validation."
    elif st == "VALIDATED":
        cr_status = "APPROVED"
        reason = "Activité hors plan — validée."
    elif st == "REJECTED":
        cr_status = "REJECTED"
        reason = "Activité hors plan — rejetée (vous pouvez modifier et renvoyer)."
    else:
        return None
    plan = activity.plan
    site = plan.site if plan else None
    u = User.query.get(user_id)
    requester_name = (
        f"{u.first_name or ''} {u.last_name or ''}".strip() if u else None
    ) or None
    synthetic_id = f"off-plan-mine-{activity.id}"
    reviewed_at = None
    if st in ("VALIDATED", "REJECTED") and activity.updated_at:
        reviewed_at = activity.updated_at.isoformat()
    return {
        "pending_item_type": "OFF_PLAN_ACTIVITY",
        "id": synthetic_id,
        "activity_id": activity.id,
        "plan_id": activity.plan_id,
        "site_id": plan.site_id if plan else None,
        "site_name": site.name if site else None,
        "plan_site_name": site.name if site else None,
        "plan_year": plan.year if plan else None,
        "year": plan.year if plan else 0,
        "activity_number": activity.activity_number or "",
        "activity_title": activity.title or "",
        "entity_type": "ACTIVITY",
        "entity_id": activity.id,
        "reason": reason,
        "requested_by": user_id,
        "requested_by_name": requester_name,
        "requested_duration": None,
        "status": cr_status,
        "reviewed_by": None,
        "reviewed_by_name": None,
        "reviewed_at": reviewed_at,
        "created_at": activity.created_at.isoformat() if activity.created_at else None,
        "off_plan_validation_mode": getattr(activity, "off_plan_validation_mode", None),
    }


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
    """Create a change request for a validated plan or activity. Body: plan_id or activity_id, reason (required), requested_duration (optional, days)."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "Données manquantes"}), 400
    plan_id = (data.get("plan_id") or "").strip()
    activity_id = (data.get("activity_id") or "").strip()
    reason = (data.get("reason") or "").strip()
    requested_duration = data.get("requested_duration")
    if not plan_id and not activity_id:
        return jsonify({"message": "plan_id ou activity_id obligatoire"}), 400
    if activity_id and plan_id:
        return jsonify({"message": "Indiquez soit plan_id soit activity_id, pas les deux"}), 400
    if not reason:
        return jsonify({"message": "La justification (reason) est obligatoire"}), 400
    role = (getattr(request, "role", "") or "").upper()
    user_id = request.user_id
    plan = None
    entity_type = "PLAN"
    entity_id = plan_id
    if activity_id:
        activity = CsrActivity.query.get(activity_id)
        if not activity:
            return jsonify({"message": "Activité introuvable"}), 404
        plan = activity.plan
        entity_type = "ACTIVITY"
        entity_id = activity.id
    else:
        plan = CsrPlan.query.get(plan_id)
        if not plan:
            return jsonify({"message": "Plan introuvable"}), 404
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    if plan.status != "VALIDATED":
        return jsonify({"message": "Seuls les plans validés peuvent faire l'objet d'une demande de modification"}), 400
    if role in ("SITE_USER", "SITE"):
        if not _user_can_access_site(user_id, plan.site_id):
            return jsonify({"message": "Vous n'avez pas accès à ce site"}), 403
    duration_days = _parse_duration_days(requested_duration)
    duration_label = f"{duration_days} jours"
    cr = ChangeRequest(
        site_id=plan.site_id,
        entity_type=entity_type,
        entity_id=entity_id,
        year=plan.year,
        reason=reason,
        status="PENDING",
        requested_by=user_id,
        requested_duration=duration_label,
    )
    db.session.add(cr)
    db.session.flush()
    desc = f"Demande de modification plan {plan.year}" if entity_type == "PLAN" else f"Demande de modification activité {entity_id}: {reason[:150]}"
    write_audit(
        user_id=request.user_id,
        site_id=plan.site_id,
        action="REQUEST_MODIFICATION",
        entity_type=entity_type,
        entity_id=entity_id,
        description=desc,
    )
    db.session.commit()

    site_name = plan.site.name if plan.site else "Site inconnu"
    msg = f"Le site {site_name} a demande une modification pour le plan CSR {plan.year}. Motif: {reason}"
    if entity_type == "ACTIVITY":
        act = CsrActivity.query.get(entity_id)
        act_label = f"{act.activity_number} – {act.title}" if act else entity_id
        msg = f"Le site {site_name} a demande une modification pour l'activité {act_label}. Motif: {reason}"
    notify_corporate(
        title="Nouvelle demande de modification",
        message=msg,
        type="warning",
        site_id=plan.site_id,
        entity_type="CHANGE_REQUEST",
        entity_id=cr.id,
        notification_category="activity_validation",
    )

    return jsonify(_change_request_to_json(cr, include_documents=True)), 201


@bp.get("")
@token_required
def list_change_requests():
    """List change requests. Query: status (optional). Site user: own change requests + own off-plan submissions.
    Corporate: all change requests; with status=PENDING also off-plan rows awaiting corporate."""
    status = (request.args.get("status") or "").strip().upper() or None
    role = (getattr(request, "role", "") or "").upper()
    user_id = request.user_id
    site_pending_inbox = role in ("SITE_USER", "SITE") and status == "PENDING"
    if role in ("CORPORATE_USER", "CORPORATE"):
        q = ChangeRequest.query
        if status:
            q = q.filter(ChangeRequest.status == status)
        q = q.order_by(ChangeRequest.created_at.desc())
        items = q.all()
    else:
        # For site users, /changes/pending is a validation inbox (not "my pending requests").
        # Their own requests are still available via /changes (without status filter).
        if site_pending_inbox:
            items = []
        else:
            q = ChangeRequest.query.filter_by(requested_by=user_id)
            if status:
                q = q.filter(ChangeRequest.status == status)
            q = q.order_by(ChangeRequest.created_at.desc())
            items = q.all()
    out = []
    for cr in items:
        row = _change_request_to_json(cr)
        row["pending_item_type"] = "CHANGE_REQUEST"
        out.append(row)
    if role in ("SITE_USER", "SITE") and not site_pending_inbox:
        aid_rows = (
            db.session.query(RealizedCsr.activity_id)
            .filter(RealizedCsr.created_by == user_id)
            .distinct()
            .all()
        )
        activity_ids = [row[0] for row in aid_rows if row[0]]
        if activity_ids:
            mine_off = (
                CsrActivity.query.options(
                    joinedload(CsrActivity.plan).joinedload(CsrPlan.site),
                )
                .filter(
                    CsrActivity.id.in_(activity_ids),
                    CsrActivity.is_off_plan.is_(True),
                    CsrActivity.status.in_(("SUBMITTED", "VALIDATED", "REJECTED")),
                )
                .all()
            )
            for a in mine_off:
                row = _off_plan_mine_list_item(a, user_id)
                if not row:
                    continue
                if status:
                    if row["status"] != status:
                        continue
                out.append(row)
    # Site level-1 inbox for off-plan activities that require manager/site validation first (mode 111 step 1).
    if site_pending_inbox:
        # No level_1 assignment anywhere => no validation inbox entries.
        if not _user_has_any_grade(user_id, "level_1"):
            return jsonify([]), 200
        activities = (
            CsrActivity.query.options(
                joinedload(CsrActivity.plan).joinedload(CsrPlan.site),
            )
            .join(CsrPlan, CsrActivity.plan_id == CsrPlan.id)
            .filter(
                CsrActivity.status == "SUBMITTED",
                CsrActivity.is_off_plan.is_(True),
            )
            .all()
        )
        existing_activity_ids = {
            row.get("activity_id")
            for row in out
            if row.get("pending_item_type") == "OFF_PLAN_ACTIVITY"
        }
        for a in activities:
            if not _off_plan_awaits_level1_validation(a):
                continue
            plan = a.plan
            if not plan:
                continue
            if not _user_can_access_site(user_id, plan.site_id):
                continue
            if not _user_has_grade(user_id, plan.site_id, "level_1"):
                continue
            if a.id in existing_activity_ids:
                continue
            out.append(_pending_off_plan_level1_item(a))
    # Only when explicitly filtering PENDING (corporate inbox), not for full history lists.
    if role in ("CORPORATE_USER", "CORPORATE") and status == "PENDING":
        activities = (
            CsrActivity.query.options(
                joinedload(CsrActivity.plan).joinedload(CsrPlan.site),
            )
            .join(CsrPlan, CsrActivity.plan_id == CsrPlan.id)
            .filter(
                CsrActivity.status == "SUBMITTED",
                or_(
                    CsrActivity.is_off_plan.is_(True),
                    and_(CsrActivity.is_off_plan.is_(False), CsrPlan.status == "VALIDATED"),
                ),
            )
            .all()
        )
        for a in activities:
            if _off_plan_awaits_corporate_validation(a):
                out.append(_pending_off_plan_corporate_item(a))
            elif _in_plan_mod_awaits_corporate_validation(a):
                out.append(_pending_in_plan_mod_corporate_item(a))
    out.sort(key=lambda x: (x.get("created_at") or ""), reverse=True)
    return jsonify(out), 200


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
    plan = None
    if cr.entity_type == "PLAN" and cr.entity_id:
        plan = CsrPlan.query.get(cr.entity_id)
        if plan:
            now = datetime.utcnow()
            days = _parse_duration_days(cr.requested_duration)
            plan.unlock_until = now + timedelta(days=days)
            plan.unlock_since = now
    elif cr.entity_type == "ACTIVITY" and cr.entity_id:
        activity = CsrActivity.query.get(cr.entity_id)
        if activity:
            plan = activity.plan
            # Unlock only this activity, not the whole plan
            now = datetime.utcnow()
            days = _parse_duration_days(cr.requested_duration)
            activity.unlock_until = now + timedelta(days=days)
            activity.unlock_since = now
    desc = f"Demande de modification approuvée (plan {plan.year})" if plan else "Demande de modification approuvée"
    write_audit(request.user_id, cr.site_id, "APPROVE", cr.entity_type, cr.entity_id, desc)
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
        notification_category="activity_validation",
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
    desc = f"Demande de modification rejetée: {comment[:200]}" if comment else "Demande de modification rejetée"
    write_audit(request.user_id, cr.site_id, "REJECT", cr.entity_type, cr.entity_id, desc)
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
        notification_category="activity_validation",
    )
    return jsonify(_change_request_to_json(cr, include_documents=True)), 200
