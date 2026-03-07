"""
Excel import endpoint: upload .xlsx file to create/update CSR plan and activities (and optional realizations).
Saves the uploaded file in the media folder and creates a Document record for download.
"""
import logging
import shutil
import tempfile
import os
from datetime import datetime

from flask import Blueprint, request, jsonify

from core import db, token_required
from models import CsrPlan, CsrActivity, RealizedCsr, Site, Category, UserSite, Document, User
from .excel_import import parse_excel_rows

# Same media root as file_management so downloads work (project root/frontend/src/media)
MEDIA_FOLDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "..", "..", "frontend", "src", "media"
)
IMPORTS_SUBFOLDER = "imports"

logger = logging.getLogger(__name__)

bp = Blueprint("csr_import", __name__, url_prefix="/api/csr-plans")


def _user_can_access_site(user_id: str, site_id: str) -> bool:
    return UserSite.query.filter_by(
        user_id=user_id, site_id=site_id, is_active=True
    ).first() is not None


def _build_site_cache():
    """Build cache: {normalized_key -> Site} for O(1) lookup."""
    sites = Site.query.all()
    cache = {}
    for s in sites:
        if s.code:
            cache[str(s.code).strip().lower()] = s
        if s.name:
            cache[str(s.name).strip().lower()] = s
    return cache


def _resolve_site_cached(site_code_or_name: str, site_cache: dict):
    """Resolve site from cache by code or name (case-insensitive)."""
    if not site_code_or_name or not str(site_code_or_name).strip():
        return None
    s = str(site_code_or_name).strip().lower()
    return site_cache.get(s)


def _resolve_category_cached(name: str, category_cache: dict, created_cats: dict):
    """Resolve category from cache. Create if not found and cache it."""
    if not name or not str(name).strip():
        return None
    n = str(name).strip()
    key = n.lower()
    if key in category_cache:
        return category_cache[key]
    cat = Category.query.filter(db.func.lower(Category.name) == key).first()
    if cat:
        category_cache[key] = cat
        return cat
    if key in created_cats:
        return created_cats[key]
    cat = Category(name=n)
    db.session.add(cat)
    db.session.flush()
    category_cache[key] = cat
    created_cats[key] = cat
    return cat


def _safe_int(val):
    if val is None or val == "":
        return None
    if isinstance(val, int):
        return val
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return None


def _safe_float(val):
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", ".")
    if not s:
        return None
    try:
        import re
        return float(re.sub(r"[^\d.\-]", "", s))
    except (TypeError, ValueError):
        return None


def _safe_str(val, max_len=255):
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    return s[:max_len] if max_len else s


def _collect_plan_keys_from_rows(rows, site_id_override, year_override, role, user_id, site_cache):
    """From parsed rows, return unique (site_id, site_name, year) and list of errors. No DB writes."""
    errors = []
    seen = set()
    result = []
    for i, row in enumerate(rows):
        row_num = i + 2
        site_id = site_id_override
        year = year_override
        if not site_id:
            site_val = row.get("site")
            if not site_val:
                errors.append(f"Ligne {row_num}: site manquant")
                continue
            site = _resolve_site_cached(str(site_val), site_cache)
            if not site:
                errors.append(f"Ligne {row_num}: site inconnu '{site_val}'")
                continue
            site_id = site.id
        else:
            site = Site.query.get(site_id)
        if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, site_id):
            errors.append(f"Ligne {row_num}: accès refusé au site {site.name or site_id}")
            continue
        if year is None:
            y = row.get("year")
            if y is not None and y != "":
                year = _safe_int(y)
            if year is None and year_override is not None:
                year = year_override
            if year is None:
                year = 2024
        if year < 2000 or year > 2100:
            errors.append(f"Ligne {row_num}: année invalide {year}")
            continue
        key = (site_id, year)
        if key not in seen:
            seen.add(key)
            result.append({
                "site_id": site_id,
                "site_name": site.name if site else None,
                "year": year,
            })
    return result, errors


@bp.post("/import-excel-preview")
@token_required
def import_excel_preview():
    """
    Parse Excel file and return list of plans (site_id, site_name, year) that would be created.
    Optional form: site_id, year. No DB writes.
    """
    role = (getattr(request, "role", "") or "").upper()
    user_id = getattr(request, "user_id", None)
    if "file" not in request.files and not request.files.get("file"):
        return jsonify({"message": "Aucun fichier envoyé (attendu: champ 'file')"}), 400
    f = request.files.get("file")
    if not f or f.filename == "":
        return jsonify({"message": "Fichier vide ou nom manquant"}), 400
    if not (f.filename or "").lower().endswith((".xlsx", ".xls")):
        return jsonify({"message": "Format non supporté. Utilisez un fichier .xlsx"}), 400
    site_id_override = request.form.get("site_id") or None
    if site_id_override:
        site_id_override = site_id_override.strip()
    year_override = request.form.get("year")
    if year_override is not None and year_override != "":
        try:
            year_override = int(year_override)
        except ValueError:
            year_override = None
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            f.save(tmp.name)
            tmp_path = tmp.name
        rows, parse_errors = parse_excel_rows(tmp_path)
        if parse_errors:
            return jsonify({"message": "Erreurs lors de la lecture du fichier", "errors": parse_errors}), 400
        if not rows:
            return jsonify({"message": "Aucune ligne de données trouvée", "plans": [], "errors": []}), 200
        site_cache = _build_site_cache()
        if site_id_override:
            site = Site.query.get(site_id_override)
            if not site:
                return jsonify({"message": "Site introuvable pour l'ID fourni"}), 400
            if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, site_id_override):
                return jsonify({"message": "Vous n'avez pas accès à ce site"}), 403
        if year_override is not None and (year_override < 2000 or year_override > 2100):
            return jsonify({"message": "Année invalide"}), 400
        plans, errors = _collect_plan_keys_from_rows(rows, site_id_override, year_override, role, user_id, site_cache)
        return jsonify({"plans": plans, "errors": errors}), 200
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


@bp.post("/import-excel")
@token_required
def import_excel():
    """
    Upload an Excel file (multipart/form-data, field name: file).
    Optional form fields: site_id, year (to fix site/year if not in file or to override).
    Creates one plan per (site, year) and activities from rows. Optionally creates realized_csr rows.
    """
    role = (getattr(request, "role", "") or "").upper()
    user_id = getattr(request, "user_id", None)
    # Only use created_by/uploaded_by if user exists in DB (avoids FK constraint failure)
    effective_user_id = user_id if (user_id and User.query.get(user_id)) else None

    if "file" not in request.files and not request.files.get("file"):
        return jsonify({"message": "Aucun fichier envoyé (attendu: champ 'file')"}), 400

    f = request.files.get("file")
    if not f or f.filename == "":
        return jsonify({"message": "Fichier vide ou nom manquant"}), 400

    if not (f.filename or "").lower().endswith((".xlsx", ".xls")):
        return jsonify({"message": "Format non supporté. Utilisez un fichier .xlsx"}), 400

    site_id_override = request.form.get("site_id") or None
    if site_id_override:
        site_id_override = site_id_override.strip()
    year_override = request.form.get("year")
    if year_override is not None and year_override != "":
        try:
            year_override = int(year_override)
        except ValueError:
            year_override = None
    # Per-plan validation modes: JSON array of { "site_id", "year", "validation_mode" }
    validation_modes_map = {}  # (site_id, year) -> "101" or "111"
    validation_modes_json = request.form.get("validation_modes")
    if validation_modes_json:
        try:
            import json
            modes_list = json.loads(validation_modes_json)
            if isinstance(modes_list, list):
                for item in modes_list:
                    sid = item.get("site_id")
                    y = item.get("year")
                    mode = (item.get("validation_mode") or "101").strip()
                    if mode not in ("101", "111"):
                        mode = "101"
                    if sid is not None and y is not None:
                        validation_modes_map[(str(sid), int(y))] = mode
        except (TypeError, ValueError, KeyError):
            pass
    # Fallback single mode if no per-plan mapping
    validation_mode_default = (request.form.get("validation_mode") or "101").strip()
    if validation_mode_default not in ("101", "111"):
        validation_mode_default = "101"

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            f.save(tmp.name)
            tmp_path = tmp.name

        rows, parse_errors = parse_excel_rows(tmp_path)
        if parse_errors:
            return jsonify({
                "message": "Erreurs lors de la lecture du fichier",
                "errors": parse_errors,
            }), 400

        if not rows:
            return jsonify({"message": "Aucune ligne de données trouvée dans le fichier"}), 400

        # Save uploaded file to media folder for later download
        original_filename = (f.filename or "import.xlsx").strip()
        safe_name = "".join(c for c in original_filename if c.isalnum() or c in "._- ").strip() or "import.xlsx"
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        import_filename = f"{timestamp}_{safe_name}"
        imports_dir = os.path.join(MEDIA_FOLDER, IMPORTS_SUBFOLDER)
        os.makedirs(imports_dir, exist_ok=True)
        saved_path = os.path.join(imports_dir, import_filename)
        shutil.copy2(tmp_path, saved_path)
        relative_file_path = f"{IMPORTS_SUBFOLDER}/{import_filename}"

        # If override: all rows are assigned to this site/year
        if site_id_override:
            site = Site.query.get(site_id_override)
            if not site:
                return jsonify({"message": "Site introuvable pour l'ID fourni"}), 400
            if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, site_id_override):
                return jsonify({"message": "Vous n'avez pas accès à ce site"}), 403
        else:
            site = None

        if year_override is not None and (year_override < 2000 or year_override > 2100):
            return jsonify({"message": "Année invalide"}), 400

        plans_created = []
        activities_created = 0
        realized_created = 0
        errors = []
        plan_cache = {}  # (site_id, year) -> plan
        site_cache = _build_site_cache()
        category_cache = {}  # name_lower -> Category
        created_cats = {}
        activity_numbers_cache = {}  # plan_id -> {activity_number -> activity}

        for i, row in enumerate(rows):
            row_num = i + 2  # 1-based + header
            site_id = site_id_override
            year = year_override

            if not site_id:
                site_val = row.get("site")
                if not site_val:
                    errors.append(f"Ligne {row_num}: site manquant")
                    continue
                site = _resolve_site_cached(str(site_val), site_cache)
                if not site:
                    errors.append(f"Ligne {row_num}: site inconnu '{site_val}'")
                    continue
                site_id = site.id
            else:
                site = Site.query.get(site_id)

            if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, site_id):
                errors.append(f"Ligne {row_num}: accès refusé au site {site.name or site_id}")
                continue

            if year is None:
                y = row.get("year")
                if y is not None and y != "":
                    year = _safe_int(y)
                if year is None and year_override is not None:
                    year = year_override
                if year is None:
                    year = 2024  # default for consolidated report
            if year < 2000 or year > 2100:
                errors.append(f"Ligne {row_num}: année invalide {year}")
                continue

            key = (site_id, year)
            if key not in plan_cache:
                plan = CsrPlan.query.filter_by(site_id=site_id, year=year).first()
                if not plan:
                    mode = validation_modes_map.get(key, validation_mode_default)
                    plan = CsrPlan(
                        site_id=site_id,
                        year=year,
                        status="DRAFT",
                        validation_mode=mode,
                        created_by=effective_user_id,
                    )
                    db.session.add(plan)
                    db.session.flush()
                    plans_created.append({"site_id": site_id, "site_name": site.name, "year": year, "plan_id": plan.id})
                plan_cache[key] = plan
            plan = plan_cache[key]

            cat_name = row.get("category")
            if not cat_name or not str(cat_name).strip():
                cat_name = "Uncategorized"
            category = _resolve_category_cached(str(cat_name).strip(), category_cache, created_cats)
            if not category:
                errors.append(f"Ligne {row_num}: impossible de créer la catégorie")
                continue

            activity_number = _safe_str(row.get("activity_number") or row.get("title")) or f"CSR-{row_num}"
            title = _safe_str(row.get("title"), 255) or _safe_str(row.get("activity_number"), 255) or f"Activité {row_num}"

            if plan.id not in activity_numbers_cache:
                acts = CsrActivity.query.filter_by(plan_id=plan.id).all()
                activity_numbers_cache[plan.id] = {a.activity_number: a for a in acts}
            existing_act = activity_numbers_cache[plan.id].get(activity_number)
            if existing_act:
                activity = existing_act
            else:
                collab_raw = _safe_str(row.get("collaboration_nature"), 50)
                collab = None
                if collab_raw:
                    c = collab_raw.upper().replace("/", "_").replace(" ", "_").replace("-", "_")
                    if "CHARITY" in c or "DONATION" in c:
                        collab = "CHARITY_DONATION"
                    elif "PARTNERSHIP" in c:
                        collab = "PARTNERSHIP"
                    elif "SPONSORSHIP" in c:
                        collab = "SPONSORSHIP"
                    else:
                        collab = "OTHERS"
                activity = CsrActivity(
                    plan_id=plan.id,
                    category_id=category.id,
                    activity_number=activity_number,
                    title=title,
                    description=_safe_str(row.get("description"), 2000),
                    planned_budget=_safe_float(row.get("planned_budget")),
                    organization=_safe_str(row.get("organization"), 20) or "INTERNAL",
                    contract_type=_safe_str(row.get("contract_type"), 30) or "ONE_SHOT",
                    collaboration_nature=collab,
                    organizer=_safe_str(row.get("organizer"), 255),
                    status="DRAFT",
                )
                db.session.add(activity)
                db.session.flush()
                activities_created += 1
                activity_numbers_cache[plan.id][activity_number] = activity

            # Optional: realization row (Actual Budget in € or Nbr of internal Participants, etc.)
            real_budget = _safe_float(row.get("realized_budget"))
            participants = _safe_int(row.get("participants"))
            real_year = _safe_int(row.get("realization_year")) or year
            real_month = _safe_int(row.get("realization_month")) or 1
            impact_actual = _safe_float(row.get("impact_actual"))
            if real_budget is not None or participants is not None or impact_actual is not None:
                rc = RealizedCsr(
                    activity_id=activity.id,
                    year=real_year,
                    month=min(12, max(1, real_month)),
                    realized_budget=real_budget,
                    participants=participants,
                    action_impact_actual=impact_actual,
                    action_impact_unit=_safe_str(row.get("impact_unit"), 100),
                    volunteer_hours=_safe_float(row.get("volunteer_hours")),
                    organizer=_safe_str(row.get("organizer"), 255),
                    number_external_partners=_safe_int(row.get("number_external_partners")),
                    created_by=effective_user_id,
                )
                db.session.add(rc)
                realized_created += 1

        # Recalculate total_budget for each plan in one query
        plan_ids = [p.id for p in plan_cache.values()]
        if plan_ids:
            totals = db.session.query(CsrActivity.plan_id, db.func.coalesce(db.func.sum(CsrActivity.planned_budget), 0)).filter(
                CsrActivity.plan_id.in_(plan_ids)
            ).group_by(CsrActivity.plan_id).all()
            total_by_plan = {pid: float(t) for pid, t in totals}
            for plan in plan_cache.values():
                plan.total_budget = total_by_plan.get(plan.id, 0)

        # Persist uploaded file as Document so user can download it
        document_site_id = site_id_override
        if not document_site_id and plan_cache:
            document_site_id = next(iter(plan_cache.keys()))[0]
        if document_site_id:
            doc = Document(
                site_id=document_site_id,
                file_name=original_filename,
                file_path=relative_file_path,
                file_type="XLSX",
                is_pinned=False,
                uploaded_by=effective_user_id,
            )
            db.session.add(doc)
            db.session.flush()
            saved_document_id = doc.id
        else:
            saved_document_id = None

        db.session.commit()

        return jsonify({
            "message": "Import terminé",
            "plans_created": len(plans_created),
            "plans": plans_created,
            "activities_created": activities_created,
            "realized_created": realized_created,
            "errors": errors[:50],
            "total_rows": len(rows),
            "document_id": saved_document_id,
            "file_path": relative_file_path,
            "file_name": original_filename,
        }), 200

    except Exception as e:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        logger.exception("import_excel failed")
        return jsonify({"message": f"Erreur serveur: {e}"}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
