"""
CSR plans (annual plans) endpoints.
List and create plans; enforce site access for SITE_USER.
"""
from datetime import datetime
import logging
from features.notification_management.notification_helper import notify_corporate

from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

from core import db, token_required
from models import CsrPlan, Site, UserSite

bp = Blueprint("csr_plans", __name__, url_prefix="/api/csr-plans")


def _plan_to_json(plan: CsrPlan):
    return {
        "id": plan.id,
        "site_id": plan.site_id,
        "site_name": plan.site.name if plan.site else None,
        "site_code": plan.site.code if plan.site else None,
        "year": plan.year,
        "validation_mode": plan.validation_mode or "101",
        "validation_step": getattr(plan, "validation_step", None),
        "status": plan.status,
        "total_budget": float(plan.total_budget) if plan.total_budget is not None else None,
        "submitted_at": plan.submitted_at.isoformat() if plan.submitted_at else None,
        "validated_at": plan.validated_at.isoformat() if plan.validated_at else None,
        "rejected_comment": getattr(plan, "rejected_comment", None) or None,
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

    plans = q.order_by(CsrPlan.year.desc(), CsrPlan.created_at.desc()).all()
    role_str = (getattr(request, "role", "") or "").upper()
    user_id = getattr(request, "user_id", None)
    result = []
    for p in plans:
        obj = _plan_to_json(p)
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
    db.session.commit()
    return jsonify(_plan_to_json(plan)), 201


@bp.get("/<string:plan_id>")
@token_required
def get_plan(plan_id):
    """Get plan by ID with activities. SITE_USER must have access to the plan's site."""
    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404

    role = (getattr(request, "role", "") or "").upper()
    if role in ("SITE_USER", "SITE"):
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Accès refusé"}), 403

    from models import CsrActivity
    activities = CsrActivity.query.filter_by(plan_id=plan.id).order_by(CsrActivity.activity_number).all()

    out = _plan_to_json(plan)
    role_str = (getattr(request, "role", "") or "").upper()
    out["can_approve"] = out["can_reject"] = _compute_can_approve(plan, request.user_id, role_str)
    out["activities"] = [
        {
            "id": a.id,
            "activity_number": a.activity_number or "",
            "title": a.title or "",
            "status": a.status,
            "planned_budget": float(a.planned_budget) if a.planned_budget is not None else None,
        }
        for a in activities
    ]
    return jsonify(out), 200


@bp.patch("/<string:plan_id>/submit")
@token_required
def submit_plan(plan_id):
    """Passer un plan de DRAFT à SUBMITTED (envoi pour validation)."""
    plan = CsrPlan.query.get(plan_id)
    if not plan:
        return jsonify({"message": "Plan introuvable"}), 404
    if plan.status != "DRAFT":
        return jsonify({"message": "Seuls les plans en brouillon peuvent être envoyés pour validation"}), 400

    role = (getattr(request, "role", "") or "").upper()
    if role in ("SITE_USER", "SITE"):
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Vous n'avez pas accès à ce plan"}), 403

    plan.status = "SUBMITTED"
    plan.submitted_at = datetime.utcnow()
    # Mode 111: Level 1 valide d'abord (step 1), puis Level 2 valide (step 2)
    # Mode 101: Level 2 valide directement (step 2)
    plan.validation_step = 1 if (plan.validation_mode or "101") == "111" else 2
    db.session.commit()
     # ── Notification corporate ────────────────────────────────────────────
    site_name = plan.site.name if plan.site else "Site inconnu"
    notify_corporate(
        title="Nouveau plan soumis",
        message=f"Le site {site_name} a soumis son plan annuel CSR {plan.year} pour validation.",
        type="info",
        site_id=plan.site_id
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

    # Mode 111 step 1: Level 1 (site user avec grade level_1) doit valider
    if mode == "111" and step == 1:
        if not _user_can_access_site(request.user_id, plan.site_id):
            return jsonify({"message": "Accès refusé"}), 403
        if not _user_has_grade(request.user_id, plan.site_id, "level_1"):
            return jsonify({"message": "Seul un validateur Level 1 de ce site peut approuver à cette étape"}), 403
        plan.validation_step = 2
        db.session.commit()
        return jsonify(_plan_to_json(plan)), 200

    # Mode 111 step 2 ou Mode 101: Level 2 (corporate) valide
    if role not in ("CORPORATE_USER", "CORPORATE"):
        return jsonify({"message": "Seul un utilisateur corporate peut effectuer la validation finale"}), 403

    plan.status = "VALIDATED"
    plan.validated_at = datetime.utcnow()
    plan.validation_step = None
    db.session.commit()
    return jsonify(_plan_to_json(plan)), 200


@bp.patch("/<string:plan_id>/reject")
@token_required
def reject_plan(plan_id):
    """Rejeter un plan soumis. Obligatoire: motif (comment). Level 1 ou Level 2 peut rejeter."""
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

    plan.status = "REJECTED"
    plan.rejected_comment = motif
    plan.validation_step = None
    db.session.commit()
    return jsonify(_plan_to_json(plan)), 200



