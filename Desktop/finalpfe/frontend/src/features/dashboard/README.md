# Dashboard Feature

This folder contains the **site dashboard** for the CSR platform. It is the Angular equivalent of the Laravel `site/dashboard.blade.php` view and is designed to work with a Flask backend.

## File Structure

```text
features/dashboard/
├── dashboard.ts         # Dashboard component (logic)
├── dashboard.html       # Dashboard template (UI)
├── dashboard-api.ts     # HTTP service to fetch dashboard data from Flask
└── README.md            # This file
```

---

## Dashboard Component (`dashboard.ts`)

Standalone Angular component that:

- Calls `DashboardApi` to load:
  - High-level site metrics (`getSiteSummary`)
  - Activities chart data for the last months (`getActivitiesChart`)
- Uses Angular **signals** (`loading`, `errorMessage`, `summary`, `chart`)
- Renders a **Chart.js** bar chart for activities if data is available

Key state:

- `summary: DashboardSummary | null` – site ID, counts, total cost
- `chart: ActivitiesChart | null` – chart labels + data
- `loading: boolean` – initial loading state
- `errorMessage: string | null` – error message if summary call fails

---

## Template (`dashboard.html`)

Tailwind-based layout similar to the original Laravel site dashboard:

- **Header text**: \"Interface site\" and a intro paragraph
- **Metric cards**:
  - Plans créés
  - Plans validés
  - Activités ce mois
  - Coût total (€)
- **Action buttons** (currently disabled placeholders):
  - \"Plans annuels (bientôt)\"
  - \"Activités réalisées (bientôt)\"
- **Activities chart**:
  - If `chart.labels` has data → shows a `<canvas>` where Chart.js renders a bar chart
  - Else → shows a text message: \"Aucune donnée d'activité disponible pour le moment.\"

The template uses the new Angular control flow (`@if`) to display summary, errors, and chart content.

---

## Dashboard API (`dashboard-api.ts`)

Service used by the component to talk to the Flask backend.

### Types

```ts
export interface DashboardSummary {
  siteId: string | null;
  plansCount: number;
  validatedPlansCount: number;
  activitiesThisMonth: number;
  totalCost: number;
}

export interface ActivitiesChart {
  labels: string[];
  data: number[];
}
```

### Expected Flask Endpoints

You should implement these endpoints in your Flask backend:

1. **Site summary**

```http
GET /api/dashboard/site/summary
```

**Response JSON:**

```json
{
  "siteId": "SITE-01",
  "plansCount": 10,
  "validatedPlansCount": 7,
  "activitiesThisMonth": 3,
  "totalCost": 12345.67
}
```

2. **Activities chart**

```http
GET /api/dashboard/site/activities-chart
```

**Response JSON:**

```json
{
  "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  "data": [2, 4, 1, 3, 5, 0]
}
```

The Angular app currently calls these endpoints relative to its origin (e.g. `/api/...`). During development, you can use:

- An Angular dev-server proxy (e.g. `/api` → `http://localhost:5000/api`), or
- Configure CORS in your Flask app and serve both on separate ports.

---

## Chart.js Integration

- The dashboard uses the global `Chart` object (from Chart.js) to render the bar chart.
- Make sure Chart.js is loaded globally in `src/index.html`, for example:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

If `Chart` is not available or if the API returns no labels/data, the component simply shows the fallback text instead of a chart.

---

## Routing

`app.routes.ts` already maps:

- `/dashboard` → `Dashboard` component (protected by `authGuard`)

Unauthenticated users are redirected to `/login` by the guard, reusing the same behavior as in the Laravel app (login first, then access the dashboard).

