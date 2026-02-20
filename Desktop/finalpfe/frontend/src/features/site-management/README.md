# SiteManagement

Gestion des informations propres à chaque site.

## Scope

- Isolation des données par site
- Suivi des plans et activités spécifiques au site
- Interface pour consulter les activités et plans liés au site

## Structure

- `sites-list/` – Liste des sites avec filtres
- `models/` – Site, Category, ExternalPartner
- `api/` – sites-api, categories-api, external-partners-api

## À développer

- [ ] **Sites API** – Remplacer SitesService mock par appels HTTP (sites-api.ts)
- [ ] **Site detail** – Page détail d’un site (infos, plans, activités liées)
- [ ] **Site create/edit** – Formulaire création/édition site (corporate)
- [ ] **Categories API** – CRUD catégories (Environment, Social, Governance, etc.)
- [ ] **Categories list/form** – Interface gestion des catégories
- [ ] **External partners API** – CRUD partenaires externes
- [ ] **External partners list/form** – Liste et formulaire partenaires (NGO, School, Association, etc.)
