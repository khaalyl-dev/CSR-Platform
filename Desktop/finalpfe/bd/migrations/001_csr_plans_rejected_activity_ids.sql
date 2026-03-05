-- Migration: csr_plans – rejet multi-activités (rejected_activity_ids)
-- Voir bd/MIGRATIONS.md.
-- À privilégier : backend/run_migration_rejected_activity_ids.py (idempotent, migre les données).

-- 1) Ajouter la nouvelle colonne (échoue si la colonne existe déjà)
-- ALTER TABLE csr_plans
--   ADD COLUMN rejected_activity_ids TEXT NULL
--   COMMENT 'IDs des activités à modifier (JSON array)';

-- 2) Migrer les données (si rejected_activity_id existe)
-- UPDATE csr_plans SET rejected_activity_ids = JSON_ARRAY(rejected_activity_id)
-- WHERE rejected_activity_id IS NOT NULL;

-- 3) Supprimer l’ancienne colonne et la FK (MySQL)
-- ALTER TABLE csr_plans DROP FOREIGN KEY fk_csr_plans_rejected_activity;
-- ALTER TABLE csr_plans DROP COLUMN rejected_activity_id;
