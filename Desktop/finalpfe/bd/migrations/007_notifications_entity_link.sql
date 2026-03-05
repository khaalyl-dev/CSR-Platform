-- Lien direct vers l'entité concernée par la notification
ALTER TABLE notifications
ADD COLUMN entity_type VARCHAR(50) NULL
COMMENT 'Type d''entité liée (PLAN, CHANGE_REQUEST, etc.)'
AFTER type,
ADD COLUMN entity_id CHAR(36) NULL
COMMENT 'Identifiant de l''entité liée'
AFTER entity_type;
