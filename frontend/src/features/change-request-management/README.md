# ChangeRequestManagement

Soumission de demandes de modification pour périodes clôturées.

## Scope

- Justification, pièces justificatives et type de modification
- Workflow de review et approbation/rejet par le corporate
- Réouverture temporaire de la période pour modification si approuvé
- Archivage complet des demandes et décisions

## Structure

- `models/` – ChangeRequest
- `api/` – change-requests-api

## À développer

- [ ] **Change Requests API** – CRUD change_requests
- [ ] **My requests** – Page « Mes Demandes » (site user)
- [ ] **Request form** – Formulaire (entity_type, entity_id, year, reason) + pièces jointes
- [ ] **Pending requests** – Page « Demandes en Attente » (corporate)
- [ ] **Review form** – Boutons Approuver/Rejeter + commentaire
- [ ] **History** – Page « Historique » des demandes (archivage)
- [ ] **Documents** – Intégration file-management pour pièces justificatives
