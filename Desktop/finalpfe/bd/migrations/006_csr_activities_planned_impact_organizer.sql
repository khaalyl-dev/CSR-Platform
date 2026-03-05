-- csr_activities: colonnes pour volontaires prévus, impact cible, unité impact, nature collab., organisateur, organisation
-- À appliquer si la table a été créée sans ces colonnes (ancienne version du modèle).
-- Exécution manuelle ou via: python run_migration_csr_activities_columns.py (depuis backend/)

-- Organisation (INTERNAL ou PARTNERSHIP)
ALTER TABLE csr_activities
  ADD COLUMN organization VARCHAR(20) NOT NULL DEFAULT 'INTERNAL'
  COMMENT 'Organisation: INTERNAL ou PARTNERSHIP'
  AFTER planned_budget;

-- Nature de la collaboration (Charity/Donation, Partnership, Sponsorship, Others)
ALTER TABLE csr_activities
  ADD COLUMN collaboration_nature VARCHAR(30) NULL
  COMMENT 'Nature: CHARITY_DONATION, PARTNERSHIP, SPONSORSHIP, OTHERS'
  AFTER organization;

-- Organisateur (ex. HR, HR/EHS)
ALTER TABLE csr_activities
  ADD COLUMN organizer VARCHAR(255) NULL
  COMMENT 'Organisateur (ex. HR)'
  AFTER collaboration_nature;

-- Nombre prévu de volontaires
ALTER TABLE csr_activities
  ADD COLUMN planned_volunteers INT NULL
  COMMENT 'Nombre prévu de volontaires'
  AFTER organizer;

-- Objectif d'impact (nombre)
ALTER TABLE csr_activities
  ADD COLUMN action_impact_target DECIMAL(15,2) NULL
  COMMENT 'Objectif d''impact'
  AFTER planned_volunteers;

-- Unité d'impact (Trees, Students, etc.)
ALTER TABLE csr_activities
  ADD COLUMN action_impact_unit VARCHAR(100) NULL
  COMMENT 'Unité d''impact (Trees, etc.)'
  AFTER action_impact_target;
