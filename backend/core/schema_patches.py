"""
Additive schema fixes for existing MySQL databases when models gain columns before formal migrations.

Runs safe ALTER TABLE ... ADD COLUMN only when information_schema shows the column is missing.
"""
import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


def _column_exists(connection, table: str, column: str) -> bool:
    row = connection.execute(
        text(
            """
            SELECT COUNT(*) AS n
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table
              AND COLUMN_NAME = :column
            """
        ),
        {"table": table, "column": column},
    ).fetchone()
    return bool(row and row[0])


def apply_schema_patches(db) -> None:
    """Call from create_app after db.create_all()."""
    dialect = (getattr(db.engine.dialect, "name", "") or "").lower()
    if dialect not in ("mysql", "mariadb"):
        return
    try:
        with db.engine.connect() as conn:
            if not _column_exists(conn, "change_requests", "validation_step"):
                conn.execute(
                    text(
                        "ALTER TABLE change_requests "
                        "ADD COLUMN validation_step INT NULL "
                        "COMMENT '1=niveau 1 site, 2=corporate (déverrouillage)' "
                        "AFTER validation_mode"
                    )
                )
                conn.commit()
                logger.info("Applied schema patch: change_requests.validation_step")
            if not _column_exists(conn, "planned_activity", "off_plan_validation_mode"):
                conn.execute(
                    text(
                        "ALTER TABLE planned_activity "
                        "ADD COLUMN off_plan_validation_mode VARCHAR(10) NULL "
                        "COMMENT 'Mode validation modification in-plan: 101 ou 111' "
                        "AFTER unlock_since"
                    )
                )
                conn.commit()
                logger.info("Applied schema patch: planned_activity.off_plan_validation_mode")
            if not _column_exists(conn, "planned_activity", "off_plan_validation_step"):
                conn.execute(
                    text(
                        "ALTER TABLE planned_activity "
                        "ADD COLUMN off_plan_validation_step INT NULL "
                        "COMMENT 'Étape validation modification in-plan' "
                        "AFTER off_plan_validation_mode"
                    )
                )
                conn.commit()
                logger.info("Applied schema patch: planned_activity.off_plan_validation_step")
            if not _column_exists(conn, "realized_activity", "off_plan_validation_mode"):
                conn.execute(
                    text(
                        "ALTER TABLE realized_activity "
                        "ADD COLUMN off_plan_validation_mode VARCHAR(10) NULL "
                        "COMMENT 'Mode validation hors plan: 101 ou 111' "
                        "AFTER is_off_plan"
                    )
                )
                conn.commit()
                logger.info("Applied schema patch: realized_activity.off_plan_validation_mode")
            if not _column_exists(conn, "realized_activity", "off_plan_validation_step"):
                conn.execute(
                    text(
                        "ALTER TABLE realized_activity "
                        "ADD COLUMN off_plan_validation_step INT NULL "
                        "COMMENT 'Étape validation hors plan (111: 1=L1, 2=corporate)' "
                        "AFTER off_plan_validation_mode"
                    )
                )
                conn.commit()
                logger.info("Applied schema patch: realized_activity.off_plan_validation_step")

            if not _column_exists(conn, "realized_activity", "number_external_partners"):
                conn.execute(
                    text(
                        "ALTER TABLE realized_activity "
                        "ADD COLUMN number_external_partners INT NULL "
                        "COMMENT 'Nombre de partenaires externes'"
                    )
                )
                conn.commit()
                logger.info("Applied schema patch: realized_activity.number_external_partners")
    except Exception as exc:
        logger.warning("Schema patches skipped or failed: %s", exc)
        try:
            db.session.rollback()
        except Exception:
            pass
