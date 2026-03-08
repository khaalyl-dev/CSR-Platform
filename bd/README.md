# Base de données – CSR Insight

Documentation et scripts de migration pour le schéma MySQL (backend Flask).

---

## Contenu du dossier

| Fichier | Description |
|---------|-------------|
| **TABLES_ET_COLONNES.md** | Tables et colonnes détaillées (MySQL) |
| **COLONNES_PAR_FICHIER.md** | Mapping colonnes Excel → schéma |
| **MIGRATIONS.md** | Instructions pour création de base fraîche |
| **schema.dbml** | Schéma conceptuel (DBML) |
| **\*.xlsx** | Fichiers Excel de référence (Annual CSR Plan, Reporting form, Consolidated Report) |

---

## Base utilisée

- **MySQL 8+**
- Charset : `utf8mb4`, collation : `utf8mb4_unicode_ci`

---

## Modèles backend (correspondance)

Le schéma est aligné avec les modèles dans `backend/models/` :

- users, user_sessions, user_sites
- sites, categories, external_partners
- csr_plans, csr_activities, realized_csr
- validations, change_requests, documents
- notifications, audit_logs, entity_history
- csr_snapshots, chatbot_logs

---

## Commande

```bash
# Depuis backend/
python3 init_db.py    # Création des tables + données de test
```
