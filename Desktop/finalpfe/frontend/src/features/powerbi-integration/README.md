# PowerBIIntegration

Connexion aux données CSR pour dashboards Power BI.

## Scope

- Actualisation automatique des données (quotidienne, snapshots mensuels)
- Analyse year-over-year et benchmark inter-sites
- Visualisation de tendances, KPI et comparaisons

## Structure

- `models/` – CsrSnapshot
- `api/` – snapshots-api

## À développer

- [ ] **Snapshots API** – Lecture csr_snapshots (filtres site, year, month)
- [ ] **Power BI embed** – Intégration iframe/embed Power BI dans l’app
- [ ] **Données export** – Export données au format attendu par Power BI
- [ ] **Refresh** – Lien vers actualisation snapshot (backend)
- [ ] **Benchmark** – Vue comparatif inter-sites
- [ ] **Year-over-year** – Graphiques évolution annuelle
