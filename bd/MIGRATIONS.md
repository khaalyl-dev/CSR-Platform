# Base de données – CSR Insight

Le projet utilise une **base fraîche** à chaque setup. Aucune migration incrémentale n’est requise.

---

## Création des tables

Les tables sont créées par `db.create_all()` à partir des modèles dans `backend/models/`.

### Commande (depuis `backend/`)

```bash
python3 init_db.py    # Crée toutes les tables + données de test (utilisateurs, sites, catégories)
```

Pour réinitialiser : supprimer la base MySQL puis recréer, puis exécuter `init_db.py`.

---

## Schéma

- **bd/TABLES_ET_COLONNES.md** – description des tables et colonnes (MySQL)
- **bd/schema.dbml** – schéma conceptuel (DBML)
