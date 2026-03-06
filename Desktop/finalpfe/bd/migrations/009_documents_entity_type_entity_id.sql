-- Link documents to entities (e.g. ACTIVITY for activity photos)
ALTER TABLE documents
  ADD COLUMN entity_type VARCHAR(20) NULL
  COMMENT 'PLAN, ACTIVITY, etc.'
  AFTER change_request_id,
  ADD COLUMN entity_id CHAR(36) NULL
  COMMENT 'ID of the entity (e.g. activity_id)'
  AFTER entity_type;
