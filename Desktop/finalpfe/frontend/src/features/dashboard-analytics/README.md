# DashboardAndAnalytics

Tableau de bord consolidé par site et global.

## Scope

- Filtres avancés (site, catégorie, type, période, statut)
- Visualisation des KPI : taux de réalisation, écarts budgétaires, top activités
- Graphiques interactifs : courbes, camemberts, barres
- Export Excel/PDF et drill-down par site

## Structure

- `dashboard/` – Dashboard site avec métriques et graphique activités (Chart.js)
- `models/` – (snapshots dans powerbi-integration)

## À développer

- [ ] **Filtres avancés** – Filtres par site, catégorie, période, statut
- [ ] **Vue corporate** – Dashboard consolidé tous sites
- [ ] **Graphiques supplémentaires** – Camemberts (par catégorie), courbes (tendance), barres comparatives
- [ ] **KPI cards** – Taux de réalisation, écarts budgétaires, top activités
- [ ] **Export Excel/PDF** – Export du tableau de bord
- [ ] **Drill-down** – Clic sur une métrique → liste détaillée
