"""
Excel import endpoint: upload .xlsx file to create/update CSR plan and activities (and optional realizations).
Saves the uploaded file in the media folder and creates a Document record for download.
"""
import logging
import os
import re
import shutil
import tempfile
from datetime import datetime

from flask import Blueprint, request, jsonify

from core import db, token_required
from models import CsrPlan, CsrActivity, RealizedCsr, Site, Category, ExternalPartner, UserSite, Document, User
from .excel_import import parse_excel_rows, validate_rows_values

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


def _build_region_country_sets():
    """Build sets of known region and country values from Site (normalized lower)."""
    sites = Site.query.all()
    regions = set()
    countries = set()
    for s in sites:
        if s.region and str(s.region).strip():
            regions.add(str(s.region).strip().lower())
        if s.country and str(s.country).strip():
            countries.add(str(s.country).strip().lower())
    return regions, countries


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


def _resolve_external_partner_cached(name: str, partner_cache: dict, created_partners: dict):
    """Resolve external partner from cache. Create if not found and cache it (type=OTHER)."""
    if not name or not str(name).strip():
        return None
    n = str(name).strip()
    key = n.lower()
    if key in partner_cache:
        return partner_cache[key]
    partner = ExternalPartner.query.filter(db.func.lower(ExternalPartner.name) == key).first()
    if partner:
        partner_cache[key] = partner
        return partner
    if key in created_partners:
        return created_partners[key]
    partner = ExternalPartner(name=n, type="OTHER")
    db.session.add(partner)
    db.session.flush()
    partner_cache[key] = partner
    created_partners[key] = partner
    return partner


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


def _to_json_val(val):
    """Convert value to JSON-serializable type (numpy/pandas -> Python)."""
    if val is None:
        return None
    if hasattr(val, "item"):  # numpy scalar
        return val.item()
    if isinstance(val, (str, int, float, bool)):
        return val
    s = str(val).strip().lower()
    if s == "nan" or not s:
        return None
    return val


def _row_to_json_safe(row):
    """Convert row dict to JSON-serializable (no numpy/pandas)."""
    return {k: _to_json_val(v) for k, v in row.items()}


def _collect_plan_keys_from_rows(rows, site_id_override, year_override, role, user_id, site_cache, known_regions=None, known_countries=None):
    """From parsed rows, return unique (site_id, site_name, year) and list of errors. No DB writes."""
    errors = []
    seen = set()
    result = []
    known_regions = known_regions or set()
    known_countries = known_countries or set()
    for i, row in enumerate(rows):
        row_num = i + 2
        # Region: missing or unknown
        region_val = row.get("region")
        if not region_val or not str(region_val).strip():
            errors.append(f"Activity {row_num}: région manquante")
        else:
            rn = str(region_val).strip().lower()
            if known_regions and rn not in known_regions:
                errors.append(f"Activity {row_num}: région inconnue '{region_val}'")
        # Country: missing or unknown
        country_val = row.get("country")
        if not country_val or not str(country_val).strip():
            errors.append(f"Activity {row_num}: pays manquant")
        else:
            cn = str(country_val).strip().lower()
            if known_countries and cn not in known_countries:
                errors.append(f"Activity {row_num}: pays inconnu '{country_val}'")
        # Site: required and must be known
        site_id = site_id_override
        year = year_override
        if not site_id:
            site_val = row.get("site")
            if not site_val:
                errors.append(f"Activity {row_num}: site manquant")
                continue
            site = _resolve_site_cached(str(site_val), site_cache)
            if not site:
                errors.append(f"Activity {row_num}: site inconnu '{site_val}'")
                continue
            site_id = site.id
        else:
            site = Site.query.get(site_id)
        if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, site_id):
            errors.append(f"Activity {row_num}: accès refusé au site {site.name or site_id}")
            continue
        if year is None:
            sy = row.get("start_year")
            if sy is not None and sy != "":
                year = _safe_int(sy)
            if year is None:
                y = row.get("year")
                if y is not None and y != "":
                    year = _safe_int(y)
            if year is None and year_override is not None:
                year = year_override
            if year is None:
                year = 2024
        if year < 2000 or year > 2100:
            errors.append(f"Activity {row_num}: année invalide {year}")
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
        rows, structure_errors, row_errors = parse_excel_rows(tmp_path)
        if structure_errors:
            return jsonify({"message": "Erreurs lors de la lecture du fichier", "errors": structure_errors}), 400
        if not rows:
            return jsonify({
                "message": "Aucune ligne de données trouvée",
                "plans": [],
                "rows": [],
                "errors": row_errors[:50],
            }), 200
        site_cache = _build_site_cache()
        known_regions, known_countries = _build_region_country_sets()
        if site_id_override:
            site = Site.query.get(site_id_override)
            if not site:
                return jsonify({"message": "Site introuvable pour l'ID fourni"}), 400
            if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, site_id_override):
                return jsonify({"message": "Vous n'avez pas accès à ce site"}), 403
        if year_override is not None and (year_override < 2000 or year_override > 2100):
            return jsonify({"message": "Année invalide"}), 400

        # For SITE users: keep only accessible rows in preview table,
        # but report inaccessible sites in errors.
        denied_access_errors = []
        denied_sites_seen = set()
        if role in ("SITE_USER", "SITE") and not site_id_override:
            filtered = []
            for r in rows:
                site_val = r.get("site")
                if not site_val:
                    filtered.append(r)
                    continue
                site_obj = _resolve_site_cached(str(site_val), site_cache)
                if not site_obj:
                    filtered.append(r)
                    continue
                if _user_can_access_site(user_id, site_obj.id):
                    filtered.append(r)
                else:
                    site_label = str(site_obj.name or site_val).strip()
                    key = site_label.lower()
                    if key and key not in denied_sites_seen:
                        denied_sites_seen.add(key)
                        denied_access_errors.append(f"accès refusé au site {site_label}")
            rows = filtered
            if not rows:
                return jsonify({
                    "message": "Aucune ligne accessible trouvée pour vos sites",
                    "plans": [],
                    "rows": [],
                    "errors": denied_access_errors[:50],
                }), 200

        plans, errors = _collect_plan_keys_from_rows(
            rows, site_id_override, year_override, role, user_id, site_cache, known_regions, known_countries
        )
        all_errors = (row_errors or []) + (denied_access_errors or []) + (errors or [])
        # Convert rows to JSON-safe dicts for editable preview
        rows_safe = [_row_to_json_safe(r) for r in rows]
        return jsonify({"plans": plans, "rows": rows_safe, "errors": all_errors}), 200
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def _extract_max_activity_number(plan_id):
    """Get max numeric value from activity_numbers in plan. Returns 0 if none."""
    acts = CsrActivity.query.filter_by(plan_id=plan_id).all()
    max_val = 0
    for a in acts:
        if not a or not a.activity_number:
            continue
        s = str(a.activity_number).strip()
        nums = re.findall(r'\d+', s)
        for n in nums:
            try:
                val = int(n)
                if val > max_val:
                    max_val = val
            except (TypeError, ValueError):
                pass
    return max_val


def _check_row_conflicts(rows, site_id_override, year_override, role, user_id, site_cache):
    """
    Check which rows have activity_number conflicts (already exist in plan).
    Returns list of { row_index, activity_number, site_name, year, next_activity_number }.
    next_activity_number: sequential number starting from max+1 per plan (201, 202, ...).
    """
    conflicts = []
    next_per_plan = {}  # (site_id, year) -> next number to assign
    site_cache_ref = site_cache
    for i, row in enumerate(rows):
        site_id = site_id_override
        year = year_override
        if not site_id:
            site_val = row.get("site")
            if not site_val:
                continue
            site = _resolve_site_cached(str(site_val), site_cache_ref)
            if not site:
                continue
            site_id = site.id
        else:
            site = Site.query.get(site_id)
        if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, site_id):
            continue
        if year is None:
            sy = row.get("start_year")
            if sy is not None and sy != "":
                year = _safe_int(sy)
            if year is None:
                y = row.get("year")
                if y is not None and y != "":
                    year = _safe_int(y)
            if year is None and year_override is not None:
                year = year_override
            if year is None:
                year = 2024
        if year is None or year < 2000 or year > 2100:
            continue
        plan = CsrPlan.query.filter_by(site_id=site_id, year=year).first()
        if not plan:
            continue
        activity_number = _safe_str(row.get("activity_number"))
        if not activity_number:
            continue
        existing = CsrActivity.query.filter_by(plan_id=plan.id, activity_number=activity_number).first()
        if existing:
            plan_key = (site_id, year)
            if plan_key not in next_per_plan:
                max_val = _extract_max_activity_number(plan.id)
                next_per_plan[plan_key] = max_val + 1
            next_num = next_per_plan[plan_key]
            next_per_plan[plan_key] = next_num + 1
            conflicts.append({
                "row_index": i,
                "activity_number": activity_number,
                "site_name": site.name if site else None,
                "year": year,
                "next_activity_number": next_num,
            })
    return conflicts


@bp.post("/import-excel-check-conflicts")
@token_required
def import_excel_check_conflicts():
    """
    Check which rows have activity_number conflicts (activity already exists in plan).
    Expects JSON body: { "rows": [...], "site_id": "...", "year": 2024 }.
    Returns { "conflicts": [{ row_index, activity_number, site_name, year }] }.
    """
    role = (getattr(request, "role", "") or "").upper()
    user_id = getattr(request, "user_id", None)
    data = request.get_json(silent=True) or {}
    rows = data.get("rows")
    if not isinstance(rows, list) or not rows:
        return jsonify({"conflicts": []}), 200
    site_id_override = data.get("site_id") or None
    if site_id_override:
        site_id_override = str(site_id_override).strip()
    year_override = data.get("year")
    if year_override is not None:
        try:
            year_override = int(year_override)
        except (TypeError, ValueError):
            year_override = None
    site_cache = _build_site_cache()
    if site_id_override:
        site = Site.query.get(site_id_override)
        if not site:
            return jsonify({"message": "Site introuvable"}), 400
        if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, site_id_override):
            return jsonify({"message": "Accès refusé"}), 403
    conflicts = _check_row_conflicts(rows, site_id_override, year_override, role, user_id, site_cache)
    return jsonify({"conflicts": conflicts}), 200


@bp.post("/import-validate-rows")
@token_required
def import_validate_rows():
    """
    Re-validate current rows (region, country, site) without uploading a file.
    Expects JSON body: { "rows": [...] }. Returns { "errors": [...] }.
    Used when user edits the preview and clicks Next to check if warnings are fixed.
    """
    role = (getattr(request, "role", "") or "").upper()
    user_id = getattr(request, "user_id", None)
    data = request.get_json(silent=True) or {}
    rows = data.get("rows")
    if not isinstance(rows, list):
        return jsonify({"errors": []}), 200
    if not rows:
        return jsonify({"errors": []}), 200
    site_cache = _build_site_cache()
    known_regions, known_countries = _build_region_country_sets()
    _, errors = _collect_plan_keys_from_rows(
        rows, None, None, role, user_id, site_cache, known_regions, known_countries
    )
    row_type_errors = validate_rows_values(rows)
    all_errors = (row_type_errors or []) + (errors or [])
    return jsonify({"errors": all_errors}), 200


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

    # Optional: edited rows from preview (JSON). If provided, use these instead of parsing file.
    rows = None
    rows_json = request.form.get("rows")
    if rows_json:
        try:
            import json as _json
            rows = _json.loads(rows_json)
            if not isinstance(rows, list):
                rows = None
        except (TypeError, ValueError, KeyError):
            rows = None

    duplicate_strategy = (request.form.get("duplicate_strategy") or "overwrite").strip().lower()
    if duplicate_strategy not in ("delete", "ignore", "overwrite"):
        duplicate_strategy = "overwrite"

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            f.save(tmp.name)
            tmp_path = tmp.name

        if rows is None:
            rows, structure_errors, row_errors = parse_excel_rows(tmp_path)
            if structure_errors:
                return jsonify({
                    "message": "Erreurs lors de la lecture du fichier",
                    "errors": structure_errors,
                }), 400
            if row_errors:
                return jsonify({
                    "message": "Erreurs de validation du fichier",
                    "errors": row_errors,
                }), 400

        if not rows:
            return jsonify({"message": "Aucune ligne de données trouvée dans le fichier"}), 400

        validation_errors = validate_rows_values(rows or [])
        if validation_errors:
            return jsonify({
                "message": "Erreurs de validation (aperçu)",
                "errors": validation_errors[:50],
            }), 400

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
        known_regions, known_countries = _build_region_country_sets()
        category_cache = {}  # name_lower -> Category
        created_cats = {}
        external_partner_cache = {}  # name_lower -> ExternalPartner
        created_partners = {}
        activity_numbers_cache = {}  # plan_id -> {activity_number -> activity}
        excel_seen_keys = set() if duplicate_strategy in ("delete", "ignore") else None

        for i, row in enumerate(rows):
            row_num = i + 2  # 1-based + header
            # Region: missing or unknown
            region_val = row.get("region")
            if not region_val or not str(region_val).strip():
                errors.append(f"Activity {row_num}: région manquante")
            else:
                rn = str(region_val).strip().lower()
                if known_regions and rn not in known_regions:
                    errors.append(f"Activity {row_num}: région inconnue '{region_val}'")
            # Country: missing or unknown
            country_val = row.get("country")
            if not country_val or not str(country_val).strip():
                errors.append(f"Activity {row_num}: pays manquant")
            else:
                cn = str(country_val).strip().lower()
                if known_countries and cn not in known_countries:
                    errors.append(f"Activity {row_num}: pays inconnu '{country_val}'")
            # Site: required and must be known
            site_id = site_id_override
            year = year_override
            if not site_id:
                site_val = row.get("site")
                if not site_val:
                    errors.append(f"Activity {row_num}: site manquant")
                    continue
                site = _resolve_site_cached(str(site_val), site_cache)
                if not site:
                    errors.append(f"Activity {row_num}: site inconnu '{site_val}'")
                    continue
                site_id = site.id
            else:
                site = Site.query.get(site_id)

            if role in ("SITE_USER", "SITE") and not _user_can_access_site(user_id, site_id):
                errors.append(f"Activity {row_num}: accès refusé au site {site.name or site_id}")
                continue

            if year is None:
                sy = row.get("start_year")
                if sy is not None and sy != "":
                    year = _safe_int(sy)
                if year is None:
                    y = row.get("year")
                    if y is not None and y != "":
                        year = _safe_int(y)
                if year is None and year_override is not None:
                    year = year_override
                if year is None:
                    year = 2024  # default for consolidated report
            if year < 2000 or year > 2100:
                errors.append(f"Activity {row_num}: année invalide {year}")
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
                errors.append(f"Activity {row_num}: impossible de créer la catégorie")
                continue

            activity_number = _safe_str(row.get("activity_number"))
            if not activity_number:
                errors.append(f"Activity {row_num}: activity_number manquant")
                continue
            title = _safe_str(row.get("title"), 255)
            if not title:
                errors.append(f"Activity {row_num}: titre manquant")
                continue

            # Skip duplicated keys inside the Excel file for delete/ignore modes.
            # Key is aligned with DB unique constraint: (plan_id, activity_number).
            if excel_seen_keys is not None:
                excel_key = (plan.id, activity_number)
                if excel_key in excel_seen_keys:
                    continue
                excel_seen_keys.add(excel_key)

            if plan.id not in activity_numbers_cache:
                acts = CsrActivity.query.filter_by(plan_id=plan.id).all()
                activity_numbers_cache[plan.id] = {a.activity_number: a for a in acts}
            existing_act = activity_numbers_cache[plan.id].get(activity_number)
            if existing_act:
                if duplicate_strategy == "ignore":
                    continue

                if duplicate_strategy == "delete":
                    # Remove existing activity so we can recreate it from the import row.
                    db.session.delete(existing_act)
                    db.session.flush()
                    activity_numbers_cache[plan.id].pop(activity_number, None)
                    existing_act = None

            if not existing_act:
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
                ep_name = _safe_str(row.get("external_partner"), 255)
                ep = _resolve_external_partner_cached(ep_name, external_partner_cache, created_partners) if ep_name else None
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
                    edition=_safe_int(row.get("edition")),
                    planned_volunteers=_safe_int(row.get("planned_volunteers")),
                    action_impact_target=_safe_float(row.get("impact_target")),
                    action_impact_unit=_safe_str(row.get("impact_unit"), 100),
                    external_partner_id=ep.id if ep else None,
                    status="DRAFT",
                )
                db.session.add(activity)
                db.session.flush()
                activities_created += 1
                activity_numbers_cache[plan.id][activity_number] = activity
            else:
                # overwrite mode: update planned volunteers, impact target, impact unit, external partner.
                activity = existing_act
                pv = _safe_int(row.get("planned_volunteers"))
                it = _safe_float(row.get("impact_target"))
                iu = _safe_str(row.get("impact_unit"), 100)
                ep_name = _safe_str(row.get("external_partner"), 255)
                if pv is not None or it is not None or iu is not None or ep_name is not None:
                    if pv is not None:
                        activity.planned_volunteers = pv
                    if it is not None:
                        activity.action_impact_target = it
                    if iu is not None:
                        activity.action_impact_unit = iu
                    if ep_name is not None:
                        ep = _resolve_external_partner_cached(ep_name, external_partner_cache, created_partners)
                        activity.external_partner_id = ep.id if ep else None

            # Optional: realization row (Actual Budget in € or Nbr of internal Participants, etc.)
            real_budget = _safe_float(row.get("realized_budget"))
            participants = _safe_int(row.get("participants"))
            real_year = _safe_int(row.get("realization_year")) or year
            real_month = _safe_int(row.get("realization_month")) or 1
            impact_actual = _safe_float(row.get("impact_actual"))
            pe = _safe_float(row.get("percentage_employees"))
            if pe is not None and 0 < pe <= 1:
                pe = pe * 100
            if real_budget is not None or participants is not None or impact_actual is not None:
                rc = RealizedCsr(
                    activity_id=activity.id,
                    year=real_year,
                    month=min(12, max(1, real_month)),
                    realized_budget=real_budget,
                    participants=participants,
                    total_hc=_safe_int(row.get("total_hc")),
                    percentage_employees=pe,
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
