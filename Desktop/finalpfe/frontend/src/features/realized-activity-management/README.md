# RealizedActivityManagement

Saisie des activités réalisées (planifiées ou hors plan).

## Scope

- Suivi des coûts, participants, impact et heures de volontariat
- Gestion des fichiers joints (photos, documents)
- Statut des activités (En cours, Complétée, Annulée)
- Notifications liées aux activités

## Structure

- `models/` – RealizedCsr
- `api/` – realized-csr-api

## À développer

- [ ] **Realized CSR API** – CRUD realized_csr (create, list, get, update)
- [ ] **Realized list** – Page liste des réalisations par activité/site
- [ ] **Realized form** – Formulaire saisie (realized_budget, participants, volunteer_hours, impact_description, realization_date, etc.)
- [ ] **Documents** – Intégration file-management pour pièces jointes
- [ ] **Statuts** – Gestion statuts (DRAFT, IN_PROGRESS, COMPLETED, CANCELLED, VALIDATED)
- [ ] **Lien activité** – Sélection activité (planifiée ou hors plan)
