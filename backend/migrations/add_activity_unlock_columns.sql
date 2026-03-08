-- Add unlock_until and unlock_since to csr_activities for activity-level change request approval
-- Run this if you have an existing database (db.create_all does not alter existing tables)

ALTER TABLE csr_activities
  ADD COLUMN unlock_until DATETIME NULL COMMENT 'Date limite de modification (après approbation demande modification activité)',
  ADD COLUMN unlock_since DATETIME NULL COMMENT 'Date de début de la dernière ouverture (approbation demande modification activité)';
