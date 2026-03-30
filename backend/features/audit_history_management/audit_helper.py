"""
Audit helper - write audit_logs when plans/activities change.

Import these functions in route files and call them after create/update/delete.
write_audit() adds a row to audit_logs (who did what).
"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from core import db
from models.audit_log import AuditLog
from models.user import User


def _serialize_value(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat() if v else None
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (dict, list)):
        return v
    return v


def _model_to_snapshot(instance: Any) -> dict:
    """Build a JSON-serializable snapshot of a model instance (column names -> values)."""
    out = {}
    for c in instance.__table__.columns:
        key = c.key
        val = getattr(instance, key, None)
        out[key] = _serialize_value(val)
    return out


def _uuid():
    return str(uuid.uuid4())


def write_audit(
    user_id: Optional[str],
    site_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[str],
    description: str,
    entity_history_id: Optional[str] = None,
) -> AuditLog:
    """Append one audit log entry. Actions: CREATE, UPDATE, DELETE, APPROVE, REJECT, REQUEST_MODIFICATION."""
    # Safety: avoid FK errors if user_id is stale (JWT token for a user that no longer exists).
    safe_user_id = user_id
    if user_id:
        try:
            if not User.query.get(user_id):
                safe_user_id = None
        except Exception:
            safe_user_id = None
    log = AuditLog(
        id=_uuid(),
        user_id=safe_user_id,
        site_id=site_id,
        action=action.upper(),
        entity_type=entity_type.upper(),
        entity_id=entity_id,
        description=description or None,
        entity_history_id=entity_history_id,
    )
    db.session.add(log)
    return log


def audit_create(
    user_id: Optional[str],
    site_id: Optional[str],
    entity_type: str,
    entity_id: str,
    description: str,
    new_snapshot: dict,
) -> None:
    """Log a create. (new_snapshot kept for call-site compatibility.)"""
    del new_snapshot  # not persisted
    write_audit(
        user_id=user_id,
        site_id=site_id,
        action="CREATE",
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        entity_history_id=None,
    )


def audit_update(
    user_id: Optional[str],
    site_id: Optional[str],
    entity_type: str,
    entity_id: str,
    description: str,
    old_snapshot: dict,
    new_snapshot: dict,
) -> None:
    """Log an update. (snapshots kept for call-site compatibility.)"""
    del old_snapshot, new_snapshot  # not persisted
    write_audit(
        user_id=user_id,
        site_id=site_id,
        action="UPDATE",
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        entity_history_id=None,
    )


def audit_delete(
    user_id: Optional[str],
    site_id: Optional[str],
    entity_type: str,
    entity_id: str,
    description: str,
    old_snapshot: dict,
) -> None:
    """Log a delete. (old_snapshot kept for call-site compatibility.)"""
    del old_snapshot  # not persisted
    write_audit(
        user_id=user_id,
        site_id=site_id,
        action="DELETE",
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        entity_history_id=None,
    )


def snapshot_plan(plan) -> dict:
    """Build snapshot dict for a CsrPlan instance."""
    return _model_to_snapshot(plan)


def snapshot_activity(activity) -> dict:
    """Build snapshot dict for a CsrActivity instance."""
    return _model_to_snapshot(activity)
