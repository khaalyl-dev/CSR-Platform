"""
CSR plans (annual plans) endpoints.
List and create plans; enforce site access for SITE_USER.
"""
import json

from datetime import datetime
import logging
from typing import Optional, Tuple

from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

from core import db, token_required
from models import CsrPlan, Site, UserSite, Validation, ChangeRequest
from features.notification_management.notification_helper import notify_corporate, notify_site_users
from features.audit_history_management.audit_helper import (
    audit_create,
    audit_update,
    audit_delete,
    write_audit,
    snapshot_plan,
)

bp = Blueprint("csr_plans", __name__, url_prefix="/api/csr-plans")


def _plan_validation_grade(plan: CsrPlan) -> str:
    """Grade (level_1 / level_2) for the current validation step."""
    mode = plan.validation_mode or "101"
    step = getattr(plan, "validation_step", None)
    if mode == "111" and step == 1:
        return "level_1"
    return "level_2"


def _get_or_create_plan_validation(plan_id: str, site_id: str, grade: str):
    """Get or create Validation row for this plan and grade."""
    v = Validation.query.filter_by(
        entity_type="PLAN", entity_id=plan_id, grade=grade
    ).first()
    if v:
        return v
    v = Validation(
        entity_type="PLAN",
        entity_id=plan_id,
        site_id=site_id,
        grade=grade,
        status="PENDING",
    )
    db.session.add(v)
    return v


def _parse_rejected_activity_ids(plan: CsrPlan):
    """Return list of activity IDs from plan.rejected_activity_ids (JSON text). Supports legacy rejected_activity_id."""
    raw = getattr(plan, "rejected_activity_ids", None)
    if raw:
        try:
            ids = json.loads(raw)
            return ids if isinstance(ids, list) else []
        except (TypeError, json.JSONDecodeError):
            pass
    # Legacy: single rejected_activity_id
    leg = getattr(plan, "rejected_activity_id", None)
    return [leg] if leg else []


def _plan_total_budget_from_activities(plan: CsrPlan):
    """Sum of all activities' planned_budget for this plan."""
    from models import CsrActivity
    total = db.session.query(db.func.coalesce(db.func.sum(CsrActivity.planned_budget), 0)).filter(CsrActivity.plan_id == plan.id).scalar()
    return float(total) if total is not None else None


def _plan_total_realized_budget(plan: CsrPlan):
    """Sum of all realized_budget from realized_csr for this plan's activities."""
    from models import CsrActivity, RealizedCsr
    total = (
        db.session.query(db.func.coalesce(db.func.sum(RealizedCsr.realized_budget), 0))
        .join(CsrActivity, CsrActivity.id == RealizedCsr.activity_id)
        .filter(CsrActivity.plan_id == plan.id)
        .scalar()
    )
    return float(total) if total is not None else None


def _plan_to_json(plan: CsrPlan):
    """Budget total: past year = sum(realized), current/future year = sum(estimated/planned)."""
    current_year = datetime.utcnow().year
    total_estimated = _plan_total_budget_from_activities(plan)
    total_realized_budget = _plan_total_realized_budget(plan)
    if plan.year < current_year:
        total_budget = total_realized_budget  # old year: budget total = sum of realized
    else:
        total_budget = total_estimated  # current or future: budget total = sum of estimated
    return {
        "id": plan.id,
        "site_id": plan.site_id,
        "site_name": plan.site.name if plan.site else None,
        "site_code": plan.site.code if plan.site else None,
        "site_region": plan.site.region if plan.site else None,
        "site_country": plan.site.country if plan.site else None,
        "year": plan.year,
        "validation_mode": plan.validation_mode or "101",
        "validation_step": getattr(plan, "validation_step", None),
        "status": plan.status,
        "total_budget": total_budget,
        "total_estimated_budget": total_estimated,
        "total_realized_budget": total_realized_budget,
        "submitted_at": plan.submitted_at.isoformat() if plan.submitted_at else None,
        "validated_at": plan.validated_at.isoformat() if plan.validated_at else None,
        "rejected_comment": getattr(plan, "rejected_comment", None) or None,
        "rejected_activity_ids": _parse_rejected_activity_ids(plan),
        "unlock_until": plan.unlock_until.isoformat() if getattr(plan, "unlock_until", None) else None,
        "created_by": plan.created_by,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
    }


def _user_can_access_site(user_id: str, site_id: str) -> bool:
    return UserSite.query.filter_by(
        user_id=user_id, site_id=site_id, is_active=True
    ).first() is not None


def _user_has_grade(user_id: str, site_id: str, grade: str) -> bool:
    us = UserSite.query.filter_by(user_id=user_id, site_id=site_id, is_active=True).first()
    return us and (us.grade or "").lower() == grade.lower()


def _compute_can_approve(plan: CsrPlan, user_id: str, role: str) -> bool:
    """True si l'utilisateur courant peut approuver/rejeter ce plan (status SUBMITTED)."""
    if plan.status != "SUBMITTED":
        return False
    step_raw = getattr(plan, "validation_step", None)
    step = int(step_raw) if step_raw is not None else None
    mode = str(plan.validation_mode or "101")
    if mode == "111" and step == 1:
        return _user_can_access_site(user_id, plan.site_id) and _user_has_grade(user_id, plan.site_id, "level_1")
    return role in ("CORPORATE_USER", "CORPORATE")


@bp.get("")
@token_required
def list_plans():
    """List CSR plans. Optional query: site_id, year, status. SITE_USER only sees plans of their sites."""
    site_id = request.args.get("site_id")
    year = request.args.get("year", type=int)
    status = request.args.get("status")

    q = CsrPlan.query
    role = (getattr(request, "role", "") or "").upper()

    if role in ("SITE_USER", "SITE"):
        # Restrict to sites the user has access to
        user_sites = UserSite.query.filter_by(user_id=request.user_id, is_active=True).all()
        allowed_site_ids = [us.site_id for us in user_sites]
        if not allowed_site_ids:
            return jsonify([]), 200
        q = q.filter(CsrPlan.site_id.in_(allowed_site_ids))

    if site_id:
        q = q.filter_by(site_id=site_id)
    if year is not None:
        q = q.filter_by(year=year)
    if status:
        q = q.filter_by(status=status)

    from models import CsrActivity
    plans = q.order_by(CsrPlan.year.desc(), CsrPlan.created_at.desc()).all()
    role_str = (getattr(request, "role", "") or "").upper()
    user_id = getattr(request, "user_id", None)
    result = []
    for p in plans:
        obj = _plan_to_json(p)
        obj["activities_count"] = CsrActivity.query.filter_by(plan_id=p.id).count()
        if p.status == "SUBMITTED" and user_id:
            obj["can_approve"] = obj["can_reject"] = _compute_can_approve(p, user_id, role_str)
        else:
            obj["can_approve"] = obj["can_reject"] = False
        result.append(obj)
    return jsonify(result), 200


@bp.post("")
@token_required
def create_plan():
    """Create a new CSR plan (DRAFT). SITE_USER must have access to the chosen site."""
    data = request.get_json(silent=True)
    if not data:
        logger.warning("create_plan 400: body absent ou JSON invalide")
        return jsonify({"message": "Données manquantes ou format JSON invalide"}), 400

    site_id = (data.get("site_id") or "").strip() if data.get("site_id") is not None else ""
    year = data.get("year")
    if not site_id:
        logger.warning("create_plan 400: site_id manquant, body=%s", {k: v for k, v in data.items() if k != "total_budget"})
        return jsonify({"message": "Le site est obligatoire"}), 400
    if year is None or year == "":
        logger.warning("create_plan 400: year manquant, site_id=%s", site_id)
        return jsonify({"message": "L'année est obligatoire"}), 400

    try:
        year = int(year)
    except (TypeError, ValueError):
        logger.warning("create_plan 400: year invalide %r", year)
        return jsonify({"message": "L'année doit être un nombre entier (ex: 2025)"}), 400

    role = getattr(request, "role", "").upper()
    if role in ("SITE_USER", "SITE"):
        if not _user_can_access_site(request.user_id, site_id):
            return jsonify({"message": "Vous n'avez pas accès à ce site"}), 403

    if CsrPlan.query.filter_by(site_id=site_id, year=year).first():
        logger.info("create_plan 400: plan déjà existant site=%s year=%s", site_id, year)
        return jsonify({"message": "Un plan existe déjà pour ce site et cette année"}), 400

    validation_mode = data.get("validation_mode", "101")
    if validation_mode not in ("101", "111"):
        validation_mode = "101"
    total_budget = data.get("total_budget")
    if total_budget is not None:
        try:
            total_budget = float(total_budget)
        except (TypeError, ValueError):
            total_budget = None

    plan = CsrPlan(
        site_id=site_id,
        year=year,
        validation_mode=validation_mode,
        status="DRAFT",
        total_budget=total_budget,
        created_by=request.user_id,
    )
    db.session.add(plan)
    db.session.flush()
    audit_create(
        user_id=request.user_id,
        site_id=site_id,
        entity_type="PLAN",
        entity_id=plan.id,
        description=f"Création plan {plan.year} site {site_id}",
        new_snapshot=snapshot_plan(plan),
    )
    db.session.commit()
    return jsonify(_plan_to_json(plan)), 201


def _bulk_submit_plan(plan_id: str, user_id: str, role: str) -> Tuple[bool, Optional[str]]:
    """Submit one plan. Returns (success, error_message)."""
    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return False, "Plan introuvable"
    if plan.status != "DRAFT":
        return False, f"Plan non brouillon (statut: {plan.status})"
    if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, plan.site_id):
        return False, "Accès refusé"
    plan.status = "SUBMITTED"
    plan.submitted_at = datetime.utcnow()
    plan.validation_step = 1 if (plan.validation_mode or "101") == "111" else 2
    grade = _plan_validation_grade(plan)
    _get_or_create_plan_validation(plan_id, plan.site_id, grade)
    return True, None


def _bulk_delete_plan(plan_id: str, user_id: str, role: str) -> Tuple[bool, Optional[str]]:
    """Delete one plan. Returns (success, error_message)."""
    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return False, "Plan introuvable"
    if plan.status not in ("DRAFT", "REJECTED"):
        return False, f"Seuls brouillon/rejeté (statut: {plan.status})"
    if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, plan.site_id):
        return False, "Accès refusé"
    db.session.delete(plan)
    return True, None


@bp.post("/bulk-submit")
@token_required
def bulk_submit_plans():
    """Soumettre plusieurs plans (DRAFT → SUBMITTED). Body: { plan_ids: string[] }."""
    data = request.get_json() or {}
    plan_ids = data.get("plan_ids") or []
    if not isinstance(plan_ids, list):
        plan_ids = []
    plan_ids = [str(x).strip() for x in plan_ids if x]
    if not plan_ids:
        return jsonify({"message": "Aucun plan sélectionné", "success_count": 0, "errors": []}), 400

    role = (getattr(request, "role", "") or "").upper()
    user_id = request.user_id
    results = []
    for pid in plan_ids:
        ok, err = _bulk_submit_plan(pid, user_id, role)
        results.append({"plan_id": pid, "success": ok, "error": err})
    db.session.commit()

    success_count = sum(1 for r in results if r["success"])
    errors = [r for r in results if not r["success"]]
    return jsonify({
        "message": f"{success_count} plan(s) soumis pour validation.",
        "success_count": success_count,
        "total": len(plan_ids),
        "errors": [{"plan_id": e["plan_id"], "error": e["error"]} for e in errors],
    }), 200


@bp.post("/bulk-delete")
@token_required
def bulk_delete_plans():
    """Supprimer plusieurs plans (DRAFT ou REJECTED uniquement). Body: { plan_ids: string[] }."""
    data = request.get_json() or {}
    plan_ids = data.get("plan_ids") or []
    if not isinstance(plan_ids, list):
        plan_ids = []
    plan_ids = [str(x).strip() for x in plan_ids if x]
    if not plan_ids:
        return jsonify({"message": "Aucun plan sélectionné", "success_count": 0, "errors": []}), 400

    role = (getattr(request, "role", "") or "").upper()
    user_id = request.user_id
    results = []
    for pid in plan_ids:
        ok, err = _bulk_delete_plan(pid, user_id, role)
        results.append({"plan_id": pid, "success": ok, "error": err})
    db.session.commit()

    success_count = sum(1 for r in results if r["success"])
    errors = [r for r in results if not r["success"]]
    return jsonify({
        "message": f"{success_count} plan(s) supprimé(s).",
        "success_count": success_count,
        "total": len(plan_ids),
        "errors": [{"plan_id": e["plan_id"], "error": e["error"]} for e in errors],
    }), 200


@bp.patch("/<string:plan_id>")
@token_required
def update_plan(plan_id):
    """Update a plan. Allowed only when editable (DRAFT/REJECTED and not past unlock_until)."""
    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    if not _plan_is_editable(plan):
        return jsonify({"message": "Plan non modifiable (verrouillé ou période d'ouverture expirée)"}), 400

    role = (getattr(request, "role", "") or "").upper()
    if role in ("SITE_USER", "SITE"):
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Vous n'avez pas accès à ce plan"}), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "Données manquantes"}), 400

    old_snapshot = snapshot_plan(plan)
    if "year" in data and data["year"] is not None:
        try:
            year = int(data["year"])
        except (TypeError, ValueError):
            return jsonify({"message": "L'année doit être un nombre entier"}), 400
        if year < 2000 or year > 2100:
            return jsonify({"message": "Année invalide"}), 400
        existing = CsrPlan.query.filter_by(site_id=plan.site_id, year=year).first()
        if existing and existing.id != plan_id:
            return jsonify({"message": "Un plan existe déjà pour ce site et cette année"}), 400
        plan.year = year

    if "validation_mode" in data and data["validation_mode"] is not None:
        mode = (data["validation_mode"] or "").strip()
        if mode in ("101", "111"):
            plan.validation_mode = mode

    if plan.status == "REJECTED":
        plan.rejected_comment = None
        plan.rejected_activity_ids = None

    audit_update(
        user_id=request.user_id,
        site_id=plan.site_id,
        entity_type="PLAN",
        entity_id=plan_id,
        description=f"Modification plan {plan.year}",
        old_snapshot=old_snapshot,
        new_snapshot=snapshot_plan(plan),
    )
    db.session.commit()
    return jsonify(_plan_to_json(plan)), 200


def _plan_is_editable(plan: CsrPlan) -> bool:
    """True if plan can be edited: DRAFT/REJECTED (and not past unlock_until), or VALIDATED with unlock_until in the future."""
    unlock_until = getattr(plan, "unlock_until", None)
    now = datetime.utcnow()
    if plan.status in ("DRAFT", "REJECTED"):
        if unlock_until and now > unlock_until:
            return False
        return True
    if plan.status == "VALIDATED" and unlock_until and now <= unlock_until:
        return True
    return False


@bp.get("/<string:plan_id>")
@token_required
def get_plan(plan_id):
    """Get plan by ID with activities. SITE_USER must have access to the plan's site. Auto-lock when unlock_until is past."""
    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404

    role = (getattr(request, "role", "") or "").upper()
    if role in ("SITE_USER", "SITE"):
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Accès refusé"}), 403

    # If plan was open for edit and deadline passed, clear unlock_until (re-lock)
    unlock_until = getattr(plan, "unlock_until", None)
    now = datetime.utcnow()
    if unlock_until and now > unlock_until:
        plan.unlock_until = None
        if plan.status == "DRAFT":
            plan.status = "VALIDATED"
        db.session.commit()

    from models import CsrActivity, RealizedCsr
    activities = CsrActivity.query.filter_by(plan_id=plan.id).order_by(CsrActivity.activity_number).all()
    # Clear expired activity-level unlocks
    for a in activities:
        au = getattr(a, "unlock_until", None)
        if au and now > au:
            a.unlock_until = None
            a.unlock_since = None
    db.session.commit()
    out = _plan_to_json(plan)
    role_str = (getattr(request, "role", "") or "").upper()
    out["can_approve"] = out["can_reject"] = _compute_can_approve(plan, request.user_id, role_str)

    def _activity_is_editable(a):
        """True if activity can be edited: plan editable OR activity individually unlocked."""
        if _plan_is_editable(plan):
            return True
        unlock_until = getattr(a, "unlock_until", None)
        return unlock_until is not None and now <= unlock_until

    # Reference: timestamp when the change request was approved (validation approved) for this plan.
    # We compare this with each activity's created_at and updated_at from csr_activities.
    validation_approved_at = getattr(plan, "unlock_since", None)
    if not validation_approved_at:
        last_approved = (
            ChangeRequest.query.filter_by(
                entity_type="PLAN", entity_id=plan.id, status="APPROVED"
            ).filter(ChangeRequest.reviewed_at.isnot(None)).order_by(ChangeRequest.reviewed_at.desc()).first()
        )
        if last_approved and last_approved.reviewed_at:
            validation_approved_at = last_approved.reviewed_at

    def _naive(dt):
        if dt is None:
            return None
        return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) else dt

    ref_ts = _naive(validation_approved_at)
    from datetime import timedelta
    plan_created = _naive(getattr(plan, "created_at", None))
    if ref_ts is not None and plan_created is not None and ref_ts < plan_created - timedelta(days=1):
        ref_ts = None  # reject ref older than plan (avoid marking all as added)

    out["activities"] = []
    for a in activities:
        added_during_unlock = False
        modified_during_unlock = False
        if ref_ts is not None:
            created_ts = _naive(a.created_at)
            updated_ts = _naive(a.updated_at)
            # Compare validation_approved_at with activity created_at / updated_at:
            # Added: activity row was inserted AFTER the validation was approved (created_at > ref)
            if created_ts is not None and created_ts > ref_ts:
                added_during_unlock = True
            # Modified: activity existed before approval (created_at < ref) and was updated after (updated_at > ref)
            elif (
                created_ts is not None
                and updated_ts is not None
                and created_ts < ref_ts
                and updated_ts > ref_ts
            ):
                modified_during_unlock = True

        realizations = RealizedCsr.query.filter_by(activity_id=a.id).order_by(RealizedCsr.year.desc(), RealizedCsr.month.desc()).all()
        first_real = realizations[0] if realizations else None
        out["activities"].append({
            "id": a.id,
            "activity_number": a.activity_number or "",
            "title": a.title or "",
            "description": a.description or "",
            "status": a.status,
            "category_name": a.category.name if a.category else "",
            "collaboration_nature": a.collaboration_nature or "",
            "organization": a.organization or "INTERNAL",
            "contract_type": a.contract_type or "ONE_SHOT",
            "organizer": a.organizer or "",
            "edition": a.edition,
            "start_year": a.start_year,
            "external_partner_name": a.external_partner.name if a.external_partner else None,
            "planned_budget": float(a.planned_budget) if a.planned_budget is not None else None,
            "planned_volunteers": a.planned_volunteers,
            "action_impact_target": float(a.action_impact_target) if a.action_impact_target is not None else None,
            "action_impact_unit": a.action_impact_unit or "",
            "realized_budget": float(first_real.realized_budget) if first_real and first_real.realized_budget is not None else None,
            "participants": first_real.participants if first_real else None,
            "total_hc": first_real.total_hc if first_real else None,
            "percentage_employees": float(first_real.percentage_employees) if first_real and first_real.percentage_employees is not None else None,
            "number_external_partners": first_real.number_external_partners if first_real else None,
            "action_impact_actual": float(first_real.action_impact_actual) if first_real and first_real.action_impact_actual is not None else None,
            "action_impact_unit_realized": first_real.action_impact_unit if first_real else "",
            "realization_count": len(realizations),
            "added_during_unlock": added_during_unlock,
            "modified_during_unlock": modified_during_unlock,
            "activity_editable": _activity_is_editable(a),
        })
    return jsonify(out), 200


@bp.patch("/<string:plan_id>/submit")
@token_required
def submit_plan(plan_id):
    """Passer un plan à SUBMITTED (envoi pour validation). Accepte DRAFT ou VALIDATED avec unlock_until (modifications à valider)."""
    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    unlock_until = getattr(plan, "unlock_until", None)
    can_submit = plan.status == "DRAFT" or (
        plan.status == "VALIDATED" and unlock_until and datetime.utcnow() <= unlock_until
    )
    if not can_submit:
        return jsonify({"message": "Seuls les plans en brouillon ou ouverts pour modification peuvent être envoyés pour validation"}), 400

    role = (getattr(request, "role", "") or "").upper()
    if role in ("SITE_USER", "SITE"):
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Vous n'avez pas accès à ce plan"}), 403

    plan.status = "SUBMITTED"
    plan.submitted_at = datetime.utcnow()
    # When re-submitting after change request, clear unlock_until so plan is not editable during validation
    plan.unlock_until = None
    # Mode 111: Level 1 valide d'abord (step 1), puis Level 2 valide (step 2)
    # Mode 101: Level 2 valide directement (step 2)
    plan.validation_step = 1 if (plan.validation_mode or "101") == "111" else 2
    grade = _plan_validation_grade(plan)
    _get_or_create_plan_validation(plan_id, plan.site_id, grade)
    db.session.commit()
         # ── Notification corporate ────────────────────────────────────────────
    site_name = plan.site.name if plan.site else "Site inconnu"
    notify_corporate(
        title="Nouveau plan soumis",
        message=f"Le site {site_name} a soumis son plan annuel CSR {plan.year} pour validation.",
        type="info",
        site_id=plan.site_id,
        entity_type="PLAN",
        entity_id=plan.id,
        notification_category="csr_plan",
    )
    return jsonify(_plan_to_json(plan)), 200


@bp.patch("/<string:plan_id>/approve")
@token_required
def approve_plan(plan_id):
    """
    Approuver un plan soumis.
    Mode 101: Level 2 (corporate) valide directement.
    Mode 111: Level 1 (site user grade level_1) valide d'abord, puis Level 2 (corporate) valide.
    """
    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    if plan.status != "SUBMITTED":
        return jsonify({"message": "Seuls les plans soumis peuvent être approuvés"}), 400

    role = (getattr(request, "role", "") or "").upper()
    step = getattr(plan, "validation_step", None)
    mode = plan.validation_mode or "101"

    grade = _plan_validation_grade(plan)
    v = _get_or_create_plan_validation(plan_id, plan.site_id, grade)

    # Mode 111 step 1: Level 1 (site user avec grade level_1) doit valider
    if mode == "111" and step == 1:
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Accès refusé"}), 403
        if not _user_has_grade(request.user_id, plan.site_id, "level_1"):
            return jsonify({"message": "Seul un validateur Level 1 de ce site peut approuver à cette étape"}), 403
        v.status = "APPROVED"
        v.validated_by = request.user_id
        v.validated_at = datetime.utcnow()
        plan.validation_step = 2
        _get_or_create_plan_validation(plan_id, plan.site_id, "level_2")  # next step PENDING
        write_audit(
            request.user_id, plan.site_id, "APPROVE", "PLAN", plan_id,
            "Validation niveau 1 (Level 1)",
        )
        db.session.commit()
        return jsonify(_plan_to_json(plan)), 200

    # Mode 111 step 2 ou Mode 101: Level 2 (corporate) valide
    if role not in ("CORPORATE_USER", "CORPORATE"):
        return jsonify({"message": "Seul un utilisateur corporate peut effectuer la validation finale"}), 403

    v.status = "APPROVED"
    v.validated_by = request.user_id
    v.validated_at = datetime.utcnow()
    plan.status = "VALIDATED"
    plan.validated_at = datetime.utcnow()
    plan.validation_step = None
    write_audit(
        request.user_id, plan.site_id, "APPROVE", "PLAN", plan_id,
        f"Plan {plan.year} validé",
    )
    db.session.commit()

    site_name = plan.site.name if plan.site else "Site inconnu"
    notify_site_users(
        plan.site_id,
        title="Plan valide",
        message=f"Le plan annuel CSR {plan.year} du site {site_name} a ete valide.",
        type="success",
        entity_type="PLAN",
        entity_id=plan.id,
        notification_category="csr_plan",
    )
    return jsonify(_plan_to_json(plan)), 200


@bp.patch("/<string:plan_id>/reject")
@token_required
def reject_plan(plan_id):
    """Rejeter un plan soumis. Obligatoire: motif (comment). Optionnel: activity_ids (liste d'activités à modifier)."""
    data = request.get_json() or {}
    motif = (data.get("comment") or data.get("motif") or "").strip()
    if not motif:
        return jsonify({"message": "Un motif de rejet est obligatoire"}), 400

    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    if plan.status != "SUBMITTED":
        return jsonify({"message": "Seuls les plans soumis peuvent être rejetés"}), 400

    role = (getattr(request, "role", "") or "").upper()
    step = getattr(plan, "validation_step", None)
    mode = plan.validation_mode or "101"

    # Mode 111 step 1: Level 1 (site user avec grade level_1) peut rejeter
    if mode == "111" and step == 1:
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Accès refusé"}), 403
        if not _user_has_grade(request.user_id, plan.site_id, "level_1"):
            return jsonify({"message": "Seul un validateur Level 1 de ce site peut rejeter à cette étape"}), 403
    else:
        # Mode 111 step 2 ou Mode 101: corporate peut rejeter
        if role not in ("CORPORATE_USER", "CORPORATE"):
            return jsonify({"message": "Seul un utilisateur corporate peut rejeter à cette étape"}), 403

    raw_ids = data.get("activity_ids") or data.get("activity_id")
    if isinstance(raw_ids, str):
        raw_ids = [raw_ids] if raw_ids.strip() else []
    if not isinstance(raw_ids, list):
        raw_ids = []
    activity_ids = [str(x).strip() for x in raw_ids if x]
    if activity_ids:
        from models import CsrActivity
        valid = [
            a.id for a in CsrActivity.query.filter(
                CsrActivity.id.in_(activity_ids), CsrActivity.plan_id == plan_id
            ).all()
        ]
        activity_ids = valid

    grade = _plan_validation_grade(plan)
    v = _get_or_create_plan_validation(plan_id, plan.site_id, grade)
    v.status = "REJECTED"
    v.comment = motif
    v.rejected_activity_ids = json.dumps(activity_ids) if activity_ids else None
    v.validated_by = request.user_id
    v.validated_at = datetime.utcnow()

    plan.status = "REJECTED"
    plan.rejected_comment = motif
    plan.rejected_activity_ids = json.dumps(activity_ids) if activity_ids else None
    plan.validation_step = None
    write_audit(
        request.user_id, plan.site_id, "REJECT", "PLAN", plan_id,
        f"Plan rejeté: {motif[:200]}",
    )
    db.session.commit()

    site_name = plan.site.name if plan.site else "Site inconnu"
    notify_site_users(
        plan.site_id,
        title="Plan rejete",
        message=(
            f"Le plan annuel CSR {plan.year} du site {site_name} a ete rejete. "
            f"Motif: {motif}"
        ),
        type="error",
        entity_type="PLAN",
        entity_id=plan.id,
        notification_category="csr_plan",
    )
    return jsonify(_plan_to_json(plan)), 200


@bp.delete("/<string:plan_id>")
@token_required
def delete_plan(plan_id):
    """Delete a plan. Allowed only when editable (DRAFT/REJECTED and not past unlock_until)."""
    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    if not _plan_is_editable(plan):
        return jsonify({"message": "Plan non modifiable (verrouillé ou période d'ouverture expirée)"}), 400

    role = (getattr(request, "role", "") or "").upper()
    if role in ("SITE_USER", "SITE"):
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Vous n'avez pas accès à ce plan"}), 403

    old_snapshot = snapshot_plan(plan)
    audit_delete(
        user_id=request.user_id,
        site_id=plan.site_id,
        entity_type="PLAN",
        entity_id=plan_id,
        description=f"Suppression plan {plan.year}",
        old_snapshot=old_snapshot,
    )
    db.session.delete(plan)
    db.session.commit()
    return jsonify({"message": "Plan supprimé"}), 200
