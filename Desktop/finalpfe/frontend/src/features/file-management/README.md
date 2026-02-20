# FileManagement

Upload et gestion de fichiers liés aux activités et plans.

## Scope

- Formats supportés : Excel, PDF, Word, images
- Limite de taille et prévisualisation des documents
- Stockage sécurisé et lié aux activités ou plans spécifiques

## Structure

- `models/` – Document
- `api/` – documents-api

## À développer

- [ ] **Documents API** – Upload, list, delete (entity_type, entity_id)
- [ ] **Upload component** – Composant réutilisable upload (drag & drop, sélection)
- [ ] **Formats** – Validation Excel, PDF, Word, images (mime_type)
- [ ] **Taille max** – Limite de taille configurable
- [ ] **Liste documents** – Affichage fichiers liés à un plan/activité
- [ ] **Prévisualisation** – Prévisualisation PDF/images dans modal
- [ ] **Téléchargement** – Lien téléchargement sécurisé
