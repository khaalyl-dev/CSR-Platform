"""
Audit helper - write audit_logs and entity_history rows when plans/activities change.

Import these functions in route files and call them after create/update/delete.
write_audit() adds a row to audit_logs (who did what). write_entity_history() stores
before/after JSON for rollback or debugging.
"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from core import db
from models.audit_log import AuditLog
from models.entity_history import EntityHistory


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
    log = AuditLog(
        id=_uuid(),
        user_id=user_id,
        site_id=site_id,
        action=action.upper(),
        entity_type=entity_type.upper(),
        entity_id=entity_id,
        description=description or None,
        entity_history_id=entity_history_id,
    )
    db.session.add(log)
    return log


def write_entity_history(
    site_id: Optional[str],
    entity_type: str,
    entity_id: Optional[str],
    old_data: Optional[dict],
    new_data: Optional[dict],
    modified_by: Optional[str],
) -> EntityHistory:
    """
    Append one entity_history row. For CREATE: old_data=None, new_data=snapshot.
    For DELETE: old_data=snapshot, new_data=None. For UPDATE: both set.
    """
    hist = EntityHistory(
        id=_uuid(),
        site_id=site_id,
        entity_type=entity_type.upper(),
        entity_id=entity_id,
        old_data=old_data,
        new_data=new_data,
        modified_by=modified_by,
    )
    db.session.add(hist)
    return hist


def audit_create(
    user_id: Optional[str],
    site_id: Optional[str],
    entity_type: str,
    entity_id: str,
    description: str,
    new_snapshot: dict,
) -> None:
    """Log a create and store snapshot for possible rollback (rollback = delete entity)."""
    hist = write_entity_history(
        site_id=site_id,
        entity_type=entity_type,
        entity_id=entity_id,
        old_data=None,
        new_data=new_snapshot,
        modified_by=user_id,
    )
    db.session.flush()
    write_audit(
        user_id=user_id,
        site_id=site_id,
        action="CREATE",
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        entity_history_id=hist.id,
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
    """Log an update and store old/new for rollback (rollback = apply old_snapshot)."""
    hist = write_entity_history(
        site_id=site_id,
        entity_type=entity_type,
        entity_id=entity_id,
        old_data=old_snapshot,
        new_data=new_snapshot,
        modified_by=user_id,
    )
    db.session.flush()
    write_audit(
        user_id=user_id,
        site_id=site_id,
        action="UPDATE",
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        entity_history_id=hist.id,
    )


def audit_delete(
    user_id: Optional[str],
    site_id: Optional[str],
    entity_type: str,
    entity_id: str,
    description: str,
    old_snapshot: dict,
) -> None:
    """Log a delete and store snapshot for rollback (rollback = re-insert)."""
    hist = write_entity_history(
        site_id=site_id,
        entity_type=entity_type,
        entity_id=entity_id,
        old_data=old_snapshot,
        new_data=None,
        modified_by=user_id,
    )
    db.session.flush()
    write_audit(
        user_id=user_id,
        site_id=site_id,
        action="DELETE",
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        entity_history_id=hist.id,
    )


def snapshot_plan(plan) -> dict:
    """Build snapshot dict for a CsrPlan instance."""
    return _model_to_snapshot(plan)


def snapshot_activity(activity) -> dict:
    """Build snapshot dict for a CsrActivity instance."""
    return _model_to_snapshot(activity)
