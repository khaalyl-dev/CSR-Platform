-- Date de début de la dernière ouverture (pour marquer activités ajoutées/modifiées)
ALTER TABLE csr_plans
ADD COLUMN unlock_since DATETIME NULL
COMMENT 'Date de début de la dernière ouverture (approbation demande de modification)'
AFTER unlock_until;
