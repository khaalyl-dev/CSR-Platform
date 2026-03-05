# Migrations base de données

Ce fichier liste les changements de schéma à appliquer sur une base existante (après création initiale via `init_db.py` ou équivalent).

---

## 1. validations – rejet multi-activités (rejected_activity_ids)

**Date :** 2025-03  
**Contexte :** Les approbations et rejets de plans sont enregistrés dans la table `validations`. En cas de rejet, on stocke les IDs des activités à modifier.

### Changements

- **Ajout** : colonne `rejected_activity_ids` TEXT NULL (tableau JSON d’UUID) dans la table **validations**.

### Backend

- Script : `python run_migration_validations_rejected_activity_ids.py` (depuis `backend/`).

---

## 2. csr_plans – rejet multi-activités (rejected_activity_ids)

**Date :** 2025-03  
**Contexte :** Lors du rejet d’un plan, le validateur peut indiquer plusieurs activités à modifier. Une colonne texte stocke un tableau JSON d’IDs à la place d’une seule FK.

### Changements

- **Ajout** : `rejected_activity_ids` TEXT NULL – tableau JSON d’UUID (ex. `["uuid1", "uuid2"]`).
- **Suppression** (si présente) : `rejected_activity_id` (CHAR(36) FK → csr_activities) et sa contrainte FK.

### MySQL

Si la colonne `rejected_activity_ids` n’existe pas :

```sql
ALTER TABLE csr_plans
  ADD COLUMN rejected_activity_ids TEXT NULL
  COMMENT 'IDs des activités à modifier (JSON array)';
```

Si l’ancienne colonne `rejected_activity_id` existe encore, migrer les données puis la supprimer (voir script backend ci‑dessous).

### Backend

- Script Python à exécuter depuis `backend/` :  
  `python run_migration_rejected_activity_ids.py`  
  (ajoute la colonne, migre les données, supprime l’ancienne colonne et la FK).

---

## 6. csr_activities – colonnes édition (volontaires prévus, impact, nature collab., organisateur)

**Date :** 2025-03  
**Contexte :** L’édition d’une activité planifiée doit permettre de saisir : volontaires prévus, impact cible, unité d’impact, nature de la collaboration, organisation, organisateur. Ces colonnes existent dans le schéma et le modèle Python ; cette migration les ajoute à une table `csr_activities` créée sans elles.

### Changements

- **Ajout** dans **csr_activities** :
  - `organization` VARCHAR(20) NOT NULL DEFAULT 'INTERNAL'
  - `collaboration_nature` VARCHAR(30) NULL
  - `organizer` VARCHAR(255) NULL
  - `planned_volunteers` INT NULL
  - `action_impact_target` DECIMAL(15,2) NULL
  - `action_impact_unit` VARCHAR(100) NULL

### Fichiers

- **bd** : `bd/migrations/006_csr_activities_planned_impact_organizer.sql` (exécution manuelle MySQL si besoin).
- **Backend** : `python run_migration_csr_activities_columns.py` (depuis `backend/`) — ajoute chaque colonne uniquement si elle n’existe pas.
- **Backend** : `create_csr_tables.py` appelle aussi la logique d’ajout de ces colonnes ; lancer `python create_csr_tables.py` met à jour la table.

### Référence

- Schéma à jour : `bd/schema.dbml`
- Colonnes détaillées : `bd/TABLES_ET_COLONNES.md`
- Modèles backend : `backend/models/csr_plan.py`, `backend/models/csr_activity.py`
