# NotificationManagement

Alertes et rappels configurables.

## Scope

- Alertes email pour soumission, validation ou rejet
- Rappels pour activités en retard ou modifications nécessaires
- Notifications configurables selon rôle et site

## Structure

- `models/` – Notification, UserNotification, NotificationSettings
- `api/` – notifications-api

## À développer

- [ ] **Notifications API** – List, mark read, get settings
- [ ] **Bell/Inbox** – Composant cloche + liste notifications non lues
- [ ] **Mark read** – Marquer comme lu (user_notifications)
- [ ] **Settings** – Page préférences (email_enabled par site)
- [ ] **Types** – Gestion des types (soumission, validation, rappel)
- [ ] **WebSocket/polling** – Rafraîchissement temps réel (optionnel)
