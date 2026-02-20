# user_management

Authentification et gestion des utilisateurs, avec sessions côté serveur.

## Endpoints existants

| Méthode | Route             | Description              |
|---------|-------------------|--------------------------|
| POST    | /api/auth/login   | Login, crée une session  |
| POST    | /api/auth/logout  | Logout, supprime session |
| GET     | /api/auth/me      | Valide token + session   |

## À développer

- [ ] GET /api/users — liste des utilisateurs (corporate)
- [ ] GET /api/users/:id — détail utilisateur
- [ ] POST /api/users — créer utilisateur
- [ ] PUT /api/users/:id — modifier
- [ ] DELETE /api/users/:id — désactiver
- [ ] Sessions utilisateur (user_sessions)
- [ ] Attribution sites (user_sites)
