# AuditAndHistoryManagement

Historisation des modifications de plans et activités.

## Scope

- Suivi des validations et actions de changement
- Traçabilité complète pour audit interne
- Analyse de tendances année après année

## Structure

- `models/` – AuditLog, EntityHistory
- `api/` – audit-api

## À développer

- [ ] **Audit API** – Lecture audit_logs, entity_history (filtres site, entity, date)
- [ ] **Audit list** – Page liste des logs (action, user, entity, date)
- [ ] **Entity history** – Affichage diff old_data vs new_data par modification
- [ ] **Filtres** – Par site, entity_type, période, user
- [ ] **Export** – Export logs pour audit
- [ ] **Tendances** – Vue year-over-year (analyse évolution)
