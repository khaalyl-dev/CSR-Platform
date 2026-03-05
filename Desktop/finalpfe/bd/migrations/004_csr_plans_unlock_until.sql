-- Plan ouvert pour modification jusqu'à cette date (demande de modification approuvée)
ALTER TABLE csr_plans
  ADD COLUMN unlock_until DATETIME NULL
  COMMENT 'Date limite de modification (après approbation demande de modification)'
  AFTER validated_at;
