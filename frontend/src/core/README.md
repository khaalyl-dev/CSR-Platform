# Core

Services, guards et modèles transversaux.

## Structure

- `guards/` – authGuard, roleGuard
- `interceptors/` – jwtInterceptor (401 → redirect login)
- `services/` – AuthStore, AuthService
- `models/` – enums (UserRole, PlanStatus, etc.)

## À développer

- [ ] **Refresh token** – Gestion refresh token si backend le supporte
- [ ] **Session expiry** – Redirection / warning avant expiration
- [ ] **HTTP interceptor** – Ajouter Authorization Bearer à toutes les requêtes API (si pas déjà fait)
