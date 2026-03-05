-- Migration: validations – rejected_activity_ids (rejet multi-activités)
-- Voir bd/MIGRATIONS.md. Script Python : backend/run_migration_validations_rejected_activity_ids.py

-- Ajouter la colonne (échoue si elle existe déjà)
-- ALTER TABLE validations
--   ADD COLUMN rejected_activity_ids TEXT NULL
--   COMMENT 'IDs des activités à modifier (JSON array) en cas de rejet';
