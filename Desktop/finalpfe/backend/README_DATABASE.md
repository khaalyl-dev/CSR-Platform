# Base de données – Backend

## Création initiale

Depuis le dossier `backend/` :

```bash
python init_db.py
```

Cela crée toutes les tables à partir des modèles SQLAlchemy (`models/`) et insère des utilisateurs et sites de test.

## Schéma et documentation

- **Colonnes et tables :** `../bd/TABLES_ET_COLONNES.md`
- **Schéma DBML :** `../bd/schema.dbml`
- **Migrations à appliquer (base existante) :** `../bd/MIGRATIONS.md`

## Migrations (base déjà créée)

Si la base existe déjà et que le schéma a évolué (nouvelles colonnes, etc.), exécuter les scripts de migration depuis `backend/` :

| Script | Description |
|--------|-------------|
| `python run_migration_validations_rejected_activity_ids.py` | validations : ajoute `rejected_activity_ids` (TEXT, JSON). |
| `python run_migration_rejected_activity_ids.py` | csr_plans : ajoute `rejected_activity_ids` (TEXT, JSON), supprime l’ancienne colonne `rejected_activity_id` si présente. |
| `python run_migration_csr_activities_columns.py` | csr_activities : ajoute organization, collaboration_nature, organizer, planned_volunteers, action_impact_target, action_impact_unit si manquantes. |
| `python create_csr_tables.py` | Crée les tables CSR (categories, csr_plans, csr_activities, realized_csr) et ajoute les colonnes optionnelles manquantes (dont csr_activities ci‑dessus). |

Les scripts sont idempotents (vérifient l’état avant de modifier).

## Fichiers SQL de référence

- `migrations/add_rejected_activity_id.sql` – ancienne migration (une seule activité).
- Scripts Python `run_migration_*.py` – à privilégier (vérifications + migration des données).
