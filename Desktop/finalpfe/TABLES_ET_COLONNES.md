# Tables et description des colonnes – CSR Management System

Documentation de chaque table et de chaque colonne du schéma (aligné avec schema.dbml).
Le projet utilise MySQL avec `CHAR(36)` pour les UUID.

---

## Enums (types énumérés)

| Enum | Valeurs | Description |
|------|---------|-------------|
| **user_role** | SITE_USER, CORPORATE_USER | Rôle de l'utilisateur (site ou corporate). |
| **grade** | level_0, level_1, level_2 | Niveau de validation (user_sites). |
| **plan_status** | DRAFT, SUBMITTED, VALIDATED, REJECTED, LOCKED | Statut du plan annuel CSR. |
| **activity_status** | DRAFT, IN_PROGRESS, COMPLETED, CANCELLED, VALIDATED | Statut d'une activité CSR. |
| **validation_status** | PENDING, APPROVED, REJECTED | Statut d'une validation. |
| **entity_type** | PLAN, ACTIVITY | Type d'entité (plan ou activité). |
| **partner_type** | NGO, SCHOOL, ASSOCIATION, SUPPLIER, GOVERNMENT, OTHER | Type de partenaire externe. |
| **organization_type** | INTERNAL, PARTNERSHIP | Organisation de l'activité (interne ou partenariat). |
| **contract_type** | ONE_SHOT, SUCCESSIVE_PERFORMANCE | Type de contrat (ponctuel ou récurrent). |
| **collaboration_nature** | CHARITY_DONATION, PARTNERSHIP, SPONSORSHIP, OTHERS | Nature de la collaboration (rapport consolidé). |

---

## users

Utilisateurs du système (Site User, Corporate User).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant unique de l'utilisateur. |
| **first_name** | varchar | Prénom. |
| **last_name** | varchar | Nom. |
| **email** | varchar (unique) | Adresse email (identifiant de connexion). |
| **password_hash** | varchar | Mot de passe hashé (authentification). |
| **role** | user_role | Rôle : SITE_USER ou CORPORATE_USER. |
| **is_active** | boolean | Compte actif ou désactivé. |
| **is_corporate_global** | boolean | Accès corporate global (tous les sites). |
| **created_at** | timestamp | Date de création du compte. |
| **updated_at** | timestamp | Dernière mise à jour. |

---

## user_sessions

Sessions et jetons de rafraîchissement (JWT, contrôle des sessions).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant de la session. |
| **user_id** | uuid (FK → users) | Utilisateur concerné. |
| **refresh_token** | varchar | Jeton de rafraîchissement. |
| **ip_address** | varchar | Adresse IP de connexion. |
| **user_agent** | varchar | Navigateur / client. |
| **expires_at** | timestamp | Date d'expiration de la session. |
| **created_at** | timestamp | Date de création de la session. |

---

## sites

Sites / entités COFICAB (usine, plant). Données isolées par site.

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant unique du site. |
| **name** | varchar | Nom du site (ex. usine, ville). |
| **code** | varchar (unique) | Code du site (ex. COFXX, code usine). |
| **region** | varchar | Région (ex. EE, America, North Africa). |
| **country** | varchar | Pays (ex. Serbia, Romania). |
| **location** | varchar | Adresse ou localisation. |
| **description** | text | Description du site. |
| **is_active** | boolean | Site actif ou non. |
| **created_at** | timestamp | Date de création. |
| **updated_at** | timestamp | Dernière mise à jour. |

---

## user_sites

Association utilisateur–site : droits d'accès par site (contrôle d'accès par site).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant de l'association. |
| **user_id** | uuid (FK → users) | Utilisateur. |
| **site_id** | uuid (FK → sites) | Site auquel l'accès est accordé. |
| **grade** | grade (null) | Niveau de validation : level_0, level_1, level_2. |
| **is_active** | boolean | Accès actif ou révoqué (soft delete). |
| **granted_by** | uuid (FK → users, null) | Utilisateur ayant accordé l'accès. |
| **granted_at** | timestamp (null) | Date d'attribution. |

**Contrainte :** (user_id, site_id) unique (une association par paire utilisateur–site).

---

## categories

Catégories d'activités CSR (Environnement, Social, Gouvernance, Education, Santé, etc.).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant de la catégorie. |
| **name** | varchar | Nom (ex. Environment, Education, Social, Health). |
| **description** | text | Description de la catégorie. |
| **created_at** | timestamp | Date de création. |
| **updated_at** | timestamp | Dernière mise à jour. |

---

## external_partners

Partenaires externes (ONG, écoles, associations, etc.) – « Name of external entity ».

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant du partenaire. |
| **name** | varchar | Nom du partenaire. |
| **type** | partner_type | Type : NGO, SCHOOL, ASSOCIATION, etc. |
| **contact_person** | varchar | Personne contact. |
| **email** | varchar | Email. |
| **phone** | varchar | Téléphone. |
| **address** | text | Adresse. |
| **website** | varchar | Site web. |
| **description** | text | Description. |
| **is_active** | boolean | Partenaire actif ou non. |
| **created_at** | timestamp | Date de création. |
| **updated_at** | timestamp | Dernière mise à jour. |

---

## csr_plans

Plans annuels CSR par site (création, édition, workflow de validation).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant du plan. |
| **site_id** | uuid (FK → sites) | Site concerné. |
| **year** | int | Année du plan. |
| **status** | plan_status | DRAFT, SUBMITTED, VALIDATED, REJECTED, LOCKED. |
| **total_budget** | decimal | Budget total du plan (€). |
| **submitted_at** | timestamp (null) | Date de soumission. |
| **validated_at** | timestamp (null) | Date de validation finale. |
| **created_by** | uuid (FK → users) | Créateur du plan. |
| **created_at** | timestamp | Date de création. |
| **updated_at** | timestamp | Dernière mise à jour. |

**Contrainte :** (site_id, year) unique (un plan par site et par année).

---

## csr_activities

Activités CSR (planifiées ou hors plan). Aligné avec Annual CSR Plan et rapport consolidé.

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant de l'activité. |
| **plan_id** | uuid (FK → csr_plans, null) | Plan annuel si activité planifiée. |
| **site_id** | uuid (FK → sites) | Site (COFICAB Entity / Plant). |
| **category_id** | uuid (FK → categories) | Catégorie (Environment, Social, etc.). |
| **external_partner_id** | uuid (FK → external_partners, null) | Partenaire externe éventuel. |
| **activity_number** | varchar | Numéro d'activité (ex. CSR 1, CSR 2). |
| **title** | varchar | Titre / intitulé (Activity Title/description). |
| **description** | text | Description détaillée (Activity description). |
| **activity_type** | varchar | Type d'activité (ex. Planting trees, Renovating schools). |
| **organization** | organization_type | INTERNAL ou PARTNERSHIP. |
| **collaboration_nature** | collaboration_nature (null) | Charity/Donation, Partnership, Sponsorship, Others. |
| **contract_type** | contract_type | ONE_SHOT ou SUCCESSIVE_PERFORMANCE. |
| **periodicity** | varchar | Périodicité (ex. NA, Every year). |
| **planned_budget** | decimal (null) | Budget prévu (Cost EUR). |
| **planned_volunteers** | int (null) | Nombre prévu de volontaires internes. |
| **action_impact_target** | decimal (null) | Objectif d'impact (nombre). |
| **action_impact_unit** | varchar (null) | Unité d'impact (Trees, Students, etc.). |
| **action_impact_duration** | varchar (null) | Durée de l'impact (ex. Lifetime, 5 years). |
| **sustainability_description** | text (null) | Durabilité de l'action. |
| **start_year** | int (null) | Année de démarrage (activités récurrentes). |
| **edition** | int (null) | Numéro d'édition (activités récurrentes). |
| **organizer** | varchar (null) | Organisateur (ex. HR, HR/EHS). |
| **responsible_user_id** | uuid (FK → users) | Responsable de l'activité. |
| **start_date** | date | Date de début prévue. |
| **end_date** | date | Date de fin prévue. |
| **status** | activity_status | DRAFT, IN_PROGRESS, COMPLETED, CANCELLED, VALIDATED. |
| **slide_number** | varchar (null) | Numéro de slide dans le PPT (rapport). |
| **created_at** | timestamp | Date de création. |
| **updated_at** | timestamp | Dernière mise à jour. |

**Contrainte :** (site_id, activity_number) unique.

---

## activity_kpis

KPI par activité (objectifs et réalisations).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant du KPI. |
| **activity_id** | uuid (FK → csr_activities) | Activité concernée. |
| **name** | varchar | Nom du KPI. |
| **target_value** | decimal | Valeur cible. |
| **actual_value** | decimal (null) | Valeur réalisée. |
| **unit** | varchar | Unité (ex. Trees, Students, €). |

---

## realized_csr

Activités réalisées (saisie des réalisations, coûts, participants, impact). Aligné avec CSR Reporting form et rapport consolidé.

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant de la réalisation. |
| **activity_id** | uuid (FK → csr_activities) | Activité (planifiée ou hors plan). |
| **realized_budget** | decimal | Budget réel dépensé (Actual Budget €). |
| **participants** | int | Nombre de participants internes. |
| **total_hc** | int (null) | Effectif total du site (Total HC). |
| **percentage_employees** | decimal (null) | % des employés participants. |
| **volunteer_hours** | decimal | Heures de volontariat. |
| **action_impact_actual** | decimal (null) | Impact réalisé (nombre). |
| **action_impact_unit** | varchar (null) | Unité d'impact. |
| **impact_description** | text | Description de l'impact. |
| **organizer** | varchar (null) | Organisateur (département). |
| **number_external_partners** | int (null) | Nombre de partenaires externes. |
| **realization_date** | date | Date de réalisation. |
| **comment** | text | Commentaire. |
| **contact_department** | varchar (null) | Département du contact (Reporting form). |
| **contact_name** | varchar (null) | Nom du contact. |
| **contact_email** | varchar (null) | Email du contact. |
| **created_by** | uuid (FK → users) | Utilisateur ayant saisi. |
| **created_at** | timestamp | Date de saisie. |

---

## validations

Enregistrement des validations (plans ou activités) – workflow site → corporate.

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant de la validation. |
| **entity_type** | entity_type | PLAN ou ACTIVITY. |
| **entity_id** | uuid | ID du plan ou de l'activité. |
| **site_id** | uuid (FK → sites) | Site concerné. |
| **status** | validation_status | PENDING, APPROVED, REJECTED. |
| **validated_by** | uuid (FK → users, null) | Validateur. |
| **comment** | text | Commentaire (rejet / remarque). |
| **validated_at** | timestamp (null) | Date de décision. |
| **created_at** | timestamp | Date de création de la demande de validation. |

---

## validation_steps

Étapes multi-niveaux d'une validation (workflow multi-niveaux).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant de l'étape. |
| **validation_id** | uuid (FK → validations) | Validation parente. |
| **level** | int | Niveau (ordre dans le workflow). |
| **validator_id** | uuid (FK → users) | Validateur de cette étape. |
| **status** | validation_status | PENDING, APPROVED, REJECTED. |
| **comment** | text | Commentaire. |
| **validated_at** | timestamp (null) | Date de validation de l'étape. |

---

## change_requests

Demandes de modification pour périodes clôturées (justification, pièces, review corporate).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant de la demande. |
| **site_id** | uuid (FK → sites) | Site concerné. |
| **entity_type** | entity_type | PLAN ou ACTIVITY. |
| **entity_id** | uuid | Plan ou activité à modifier. |
| **year** | int | Année / période concernée. |
| **reason** | text | Justification de la demande. |
| **status** | validation_status | PENDING, APPROVED, REJECTED. |
| **requested_by** | uuid (FK → users) | Demandeur. |
| **reviewed_by** | uuid (FK → users, null) | Relecteur corporate. |
| **reviewed_at** | timestamp (null) | Date de décision. |
| **created_at** | timestamp | Date de soumission. |

---

## documents

Fichiers joints (photos, Excel, PDF, Word) liés aux plans ou activités.

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant du document. |
| **site_id** | uuid (FK → sites) | Site. |
| **entity_type** | entity_type | PLAN ou ACTIVITY. |
| **entity_id** | uuid | Plan ou activité lié. |
| **file_name** | varchar | Nom du fichier. |
| **file_path** | varchar | Chemin de stockage. |
| **mime_type** | varchar | Type MIME (Excel, PDF, image, etc.). |
| **file_size** | bigint | Taille en octets. |
| **uploaded_by** | uuid (FK → users) | Utilisateur ayant déposé le fichier. |
| **uploaded_at** | timestamp | Date d'upload. |

---

## audit_logs

Journal des actions pour traçabilité et audit.

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant du log. |
| **site_id** | uuid (FK → sites) | Site concerné. |
| **user_id** | uuid (FK → users) | Utilisateur ayant agi. |
| **action** | varchar | Type d'action (création, modification, validation, etc.). |
| **entity_type** | entity_type | PLAN ou ACTIVITY. |
| **entity_id** | uuid | Entité concernée. |
| **description** | text | Description de l'action. |
| **created_at** | timestamp | Date et heure de l'action. |

---

## entity_history

Historique des modifications (anciennes et nouvelles valeurs) pour plans et activités.

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant de l'entrée. |
| **site_id** | uuid (FK → sites) | Site. |
| **entity_type** | entity_type | PLAN ou ACTIVITY. |
| **entity_id** | uuid | Entité modifiée. |
| **old_data** | jsonb | Données avant modification. |
| **new_data** | jsonb | Données après modification. |
| **modified_by** | uuid (FK → users) | Utilisateur ayant modifié. |
| **modified_at** | timestamp | Date de modification. |

---

## notifications

Notifications système (alertes email, rappels, validation/rejet).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant de la notification. |
| **site_id** | uuid (FK → sites) | Site concerné. |
| **title** | varchar | Titre. |
| **message** | text | Contenu du message. |
| **type** | varchar | Type (soumission, validation, rappel, etc.). |
| **entity_type** | entity_type | PLAN ou ACTIVITY. |
| **entity_id** | uuid | Entité liée. |
| **created_by** | uuid (FK → users) | Créateur (système ou utilisateur). |
| **created_at** | timestamp | Date de création. |

---

## user_notifications

Lien notification ↔ utilisateur (destinataires, lecture).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant. |
| **user_id** | uuid (FK → users) | Utilisateur destinataire. |
| **notification_id** | uuid (FK → notifications) | Notification. |
| **is_read** | boolean | Notification lue ou non. |
| **read_at** | timestamp (null) | Date de lecture. |
| **created_at** | timestamp | Date d'envoi au destinataire. |

---

## notification_settings

Préférences de notification par utilisateur et par site (ex. email activé/désactivé).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant. |
| **user_id** | uuid (FK → users) | Utilisateur. |
| **site_id** | uuid (FK → sites) | Site. |
| **email_enabled** | boolean | Réception des emails activée ou non. |

---

## csr_snapshots

Snapshots pour Power BI (données agrégées par site, année, mois).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant du snapshot. |
| **site_id** | uuid (FK → sites) | Site. |
| **year** | int | Année. |
| **month** | int | Mois. |
| **total_budget** | decimal | Budget total. |
| **total_realized** | decimal | Montant réalisé. |
| **total_activities** | int | Nombre d'activités. |
| **completion_rate** | decimal | Taux de réalisation. |
| **created_at** | timestamp | Date de création du snapshot. |

**Contrainte :** (site_id, year, month) unique.

---

## chatbot_logs

Historique des échanges avec le chatbot (optionnel).

| Colonne | Type | Description |
|---------|------|-------------|
| **id** | uuid (PK) | Identifiant. |
| **user_id** | uuid (FK → users) | Utilisateur. |
| **site_id** | uuid (FK → sites) | Site (contexte). |
| **question** | text | Question posée. |
| **answer** | text | Réponse du chatbot. |
| **created_at** | timestamp | Date de l'échange. |

---

## Références entre tables (résumé)

- **users** ← user_sessions, user_sites, csr_plans.created_by, csr_activities.responsible_user_id, realized_csr.created_by, validations.validated_by, validation_steps.validator_id, change_requests.requested_by/reviewed_by, documents.uploaded_by, audit_logs, entity_history.modified_by, notifications.created_by, user_notifications, notification_settings, chatbot_logs
- **sites** ← user_sites, csr_plans, csr_activities, validations, change_requests, documents, audit_logs, entity_history, notifications, notification_settings, csr_snapshots, chatbot_logs
- **categories** ← csr_activities
- **external_partners** ← csr_activities
- **csr_plans** ← csr_activities
- **csr_activities** ← activity_kpis, realized_csr
- **validations** ← validation_steps
- **notifications** ← user_notifications
