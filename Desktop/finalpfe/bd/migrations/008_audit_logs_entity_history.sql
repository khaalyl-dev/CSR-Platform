-- Audit logs and entity history for corporate audit trail and rollback
-- entity_history created first (audit_logs references it)
-- entity_history: old_data/new_data for rollback (CREATE=old null, DELETE=new null, UPDATE=both)
-- audit_logs: who did what, when (create, update, delete, approve, request_modification)

CREATE TABLE IF NOT EXISTS entity_history (
  id CHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
  site_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
  entity_type VARCHAR(20) NOT NULL COMMENT 'PLAN, ACTIVITY',
  entity_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL COMMENT 'Id of entity; for DELETE rollback we restore from old_data',
  old_data JSON NULL COMMENT 'State before change; NULL for CREATE',
  new_data JSON NULL COMMENT 'State after change; NULL for DELETE',
  modified_by CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
  modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_entity_history_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL,
  CONSTRAINT fk_entity_history_user FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX ix_entity_history_site (site_id),
  INDEX ix_entity_history_entity (entity_type, entity_id),
  INDEX ix_entity_history_modified (modified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT 'Historique des modifications (old/new) pour rollback';

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
  site_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
  user_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
  action VARCHAR(64) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, APPROVE, REJECT, REQUEST_MODIFICATION',
  entity_type VARCHAR(20) NOT NULL COMMENT 'PLAN, ACTIVITY',
  entity_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
  description TEXT NULL,
  entity_history_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL COMMENT 'Link to entity_history for rollback',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_logs_entity_history FOREIGN KEY (entity_history_id) REFERENCES entity_history(id) ON DELETE SET NULL,
  INDEX ix_audit_logs_site (site_id),
  INDEX ix_audit_logs_user (user_id),
  INDEX ix_audit_logs_created (created_at),
  INDEX ix_audit_logs_action (action),
  INDEX ix_audit_logs_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT 'Journal des actions pour traçabilité et audit';
