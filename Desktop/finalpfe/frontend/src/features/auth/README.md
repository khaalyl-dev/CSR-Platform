# Auth Feature

This folder contains the authentication feature: login page, auth API service, and related logic. Auth state and route guards live in the `core/` folder.

## File Structure

```
features/auth/
├── login.ts          # Login component (form + logic)
├── login.html        # Login template (two-column layout)
├── auth-api.ts       # HTTP service for auth endpoints
└── README.md         # This file
```

Related files outside this folder:

```
core/
├── auth-store.ts     # Global auth state (token, user)
└── auth.guard.ts     # Route guard for protected pages
```

---

## Files Explained

### `login.ts`

The **Login** standalone component. It:

- Uses Angular signals for `loading` and `errorMessage`
- Builds a reactive form with email, password, and "remember me"
- On submit: calls `AuthApi.login()`, updates `AuthStore`, then navigates to `/dashboard`
- Shows validation and API error messages

**Dependencies:** FormBuilder, AuthApi, AuthStore, Router (injected via `inject()`).

### `login.html`

The login template:

- **Left column:** logo, title "Connexion", form (email, password, remember me, submit)
- **Right column:** background image with CSR slogan (desktop only)
- Error messages shown above the form when `errorMessage()` is set
- Uses Tailwind CSS
- French labels: Connexion, Email, Mot de passe, Se souvenir de moi, Se connecter

### `auth-api.ts`

Injectable service for auth HTTP calls:

- **`login(email, password)`** – POST to `/api/auth/login` with `{ email, password }`
- Returns `Observable<{ token: string }>`

This service is `providedIn: 'root'` (singleton).

---

## Login Flow

```
User fills form → Submit → AuthApi.login() → Backend
                                    ↓
                              Success?
                           /            \
                         Yes              No
                          ↓                ↓
              AuthStore.setAuth()    Show errorMessage
              Router → /dashboard
```

1. User enters email and password and submits.
2. Component calls `AuthApi.login(email, password)`.
3. **Success:** `AuthStore.setAuth(token, { email })` and redirect to `/dashboard`.
4. **Error:** Set `errorMessage` and show it above the form.

---

## Backend Integration

The login endpoint is expected at:

```
POST /api/auth/login
Body: { "email": string, "password": string }
Success (200): { "token": string }
Error (4xx/5xx): { "message"?: string }
```

Configure the API base URL (e.g. proxy or environment) so requests go to your backend.

---

## Route Configuration

In `app.routes.ts`:

- `/login` → Login component (public)
- `/dashboard` → Dashboard component, protected by `authGuard`
- `/` and `**` → Redirect to `/dashboard`

Unauthenticated users trying to access `/dashboard` are redirected to `/login` by `authGuard`.

---

## Auth State and Guards

- **AuthStore** (`core/auth-store.ts`): Holds `token`, `user`, and `isAuthenticated`.
- **authGuard** (`core/auth.guard.ts`): Uses `AuthStore.isAuthenticated()` to allow or redirect to `/login`.

---

## Assets

- Logo: `/COFICAB-LOGO.png` (from `public/COFICAB-LOGO.png`).
- Background: Unsplash image for the right column.
