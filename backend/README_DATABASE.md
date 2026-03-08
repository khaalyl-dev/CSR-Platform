# Database – Backend

The MySQL database is initialized via `init_db.py`. No incremental migrations.

---

## Initial setup (fresh DB)

```bash
cd backend
python init_db.py
```

**Effects:**
- `db.create_all()` creates all tables from models in `models/`
- Inserts CSR categories (Environment, Social, Gouvernance, Education, Santé)
- Inserts test users (user@test.com, admin@test.com, john@example.com)
- Inserts test sites
- Assigns sites to users (user_sites)

**Reset:** Drop the MySQL database, recreate it (`CREATE DATABASE csr_db`), then run `python init_db.py` again.

---

## Schema documentation

| File | Content |
|------|---------|
| `../bd/TABLES_ET_COLONNES.md` | Table and column descriptions (MySQL) |
| `../bd/schema.dbml` | Conceptual DBML schema |
| `../bd/MIGRATIONS.md` | Fresh DB instructions |
