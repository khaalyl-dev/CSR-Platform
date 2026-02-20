# ValidationWorkflowManagement

Gestion des étapes de validation des plans et activités.

## Scope

- Notifications aux parties prenantes lors des validations/rejets
- Historique des validations et commentaires
- Support pour workflow multi-niveaux et approbation finale

## Structure

- `models/` – Validation, ValidationStep
- `api/` – validations-api

## À développer

- [ ] **Validations API** – CRUD validations, validation_steps
- [ ] **Validation list** – Page « Demandes en attente » (PENDING)
- [ ] **Validation detail** – Vue détail + boutons Approuver/Rejeter + commentaire
- [ ] **Validation steps** – Affichage des étapes multi-niveaux (level, validator, status)
- [ ] **Historique** – Liste des validations passées (APPROVED/REJECTED)
- [ ] **Notifications** – Déclencher notifications sur validation/rejet (intégration notification-management)
