# Backend (Flask) – CSR Platform

API REST Flask pour la plateforme CSR, organisée en modules métier (features).

## Structure

```
backend/
├── app.py              # Application factory, enregistrement blueprints
├── config.py           # Configuration (env)
├── init_db.py          # Script initialisation DB + utilisateurs tests
├── requirements.txt
├── core/               # Base: DB, JWT, utilitaires
│   ├── db.py
│   ├── jwt_utils.py
│   └── README.md
├── models/             # Modèles SQLAlchemy
│   ├── user.py
│   └── README.md
└── features/           # Modules métier (blueprints)
    ├── user_management/      # Auth, utilisateurs
    ├── site_management/      # Sites, catégories, partenaires
    ├── csr_plan_management/  # Plans CSR, activités
    ├── realized_activity_management/
    ├── validation_workflow_management/
    ├── change_request_management/
    ├── dashboard_analytics/  # Tableaux de bord
    ├── file_management/      # Documents
    ├── audit_history_management/
    ├── notification_management/
    ├── powerbi_integration/
    ├── chatbot_assistant/
    ├── health/               # Health check
    └── README.md
```

Chaque feature a un README avec un checklist « À développer ».

## Setup

### Prérequis

- Python 3.8+
- MySQL

### Installation

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Configuration

1. Créer la base MySQL : `CREATE DATABASE csr_db;`
2. Configurer `.env` :

```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=votre_mot_de_passe
DB_NAME=csr_db
SECRET_KEY=change-me-in-production
```

3. Initialiser la base :

```bash
python3 init_db.py
```

## Lancement

```bash
python3 app.py
```

Par défaut : `http://localhost:5001`. CORS activé pour le frontend Angular.

## Endpoints principaux

| Méthode | Route                      | Description        |
|---------|----------------------------|--------------------|
| POST    | /api/auth/login            | Connexion          |
| POST    | /api/auth/logout           | Déconnexion (JWT)  |
| GET     | /api/dashboard/site/summary| Résumé site        |
| GET     | /api/dashboard/site/activities-chart | Graphique activités |
| GET     | /api/health                | Health check       |

Les endpoints `/api/dashboard/*` et `/api/auth/logout` exigent le header :

```
Authorization: Bearer <token>
```

## Comptes de test

- `user@test.com` / `password123` (role site)
- `admin@test.com` / `admin123` (role corporate)
- `john@example.com` / `john123` (role site)

## Prochaines étapes

- [ ] Migrations (Flask-Migrate)
- [ ] Implémenter les routes vides dans chaque feature
- [ ] Modèles supplémentaires (Site, CsrPlan, etc.)
- [ ] Refresh tokens, rate limiting
