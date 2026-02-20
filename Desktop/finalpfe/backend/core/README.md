# core/

Module central : base de données, JWT, utilitaires partagés.

## Contenu

| Fichier        | Description                        |
|----------------|------------------------------------|
| `db.py`        | Instance SQLAlchemy partagée       |
| `jwt_utils.py` | Génération/vérification de tokens JWT, `@token_required`, `@role_required` |

## À développer

- [ ] Migrations (Flask-Migrate) pour schéma DB
- [ ] Refresh tokens (user_sessions)
- [ ] Rate limiting / sécurité (brute-force)
- [ ] Logging structuré
- [ ] Configuration par environnement (dev/staging/prod)
