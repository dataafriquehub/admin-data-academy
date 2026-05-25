# Backoffice — Data Academy

Backoffice Next.js (App Router) consommant l’API **Data Academy**.
Sa coque visuelle (sidebar / topbar / panneaux / modale) **réplique** celle du portail étudiant `front-data-academy-student` ; seules les entrées de menu et les pages métier diffèrent.

Voir [`docs/BACKOFFICE_NEXTJS.md`](docs/BACKOFFICE_NEXTJS.md) pour le cadrage produit / API et `swagger.json` pour le contrat.

Toutes les specs détaillées par écran sont dans le dossier [`docs/`](docs/) :

- `BACKOFFICE_NEXTJS.md` — cadrage global (auth, API, charte UI, conventions)
- `Backoffice_dashboard.md` — Tableau de bord
- `Backoffice_users.md` — Utilisateurs
- `Backoffice_programs.md` — Programmes
- `Backoffice_modules.md` — Modules
- `Backoffice_applications.md` — Candidatures
- `Backoffice_mentorship.md` — Mentorat
- `Backoffice_notifications.md` — Notifications
- `Backoffice_settings.md` — Paramètres
- `message_backoffice.md` — Messagerie

## Variables d’environnement

Dans `.env.local` à la racine :

```
# URL de l'API. Pas de slash final. Inclure /api si tout y est exposé.
NEXT_PUBLIC_API_BASE_URL=https://api-academy-dev.dataafriquehub.org/api

# Optionnel : route du refresh JWT si différente du défaut /users/auth/token/refresh/
# NEXT_PUBLIC_JWT_REFRESH_PATH=/users/auth/token/refresh/

# Optionnel : landing publique (bouton « Voir en ligne » sur les articles publiés)
# NEXT_PUBLIC_MARKETING_SITE_URL=http://localhost:3000
```

## Blog (articles landing)

- Menu **Blog** → `/dashboard/blog` (admin + program_creator)
- API : `GET/POST/PATCH/DELETE /api/blog/posts/`
- Articles publiés visibles sur la landing : `GET /api/blog/posts/public/`
- Prérequis backend : app `apps.blog` migrée (`python manage.py migrate blog`)

## Lancer en local

```
npm install
npm run dev          # http://localhost:3000
npm run lint
npm run build
```

## Arborescence clé

```
src/
  app/
    layout.tsx                 # Poppins + AuthProvider
    login/page.tsx
    dashboard/
      layout.tsx               # AuthGuard + <Layout>
      page.tsx                 # tableau de bord
      programs/  modules/  admissions/  mentorship/
      messaging/  notifications/  users/  profile/  settings/
  components/
    layout/Layout.tsx          # coque (drawer mobile, collapse desktop, bouton flottant)
    layout/Sidebar.tsx         # logo, sections Navigation / Paramètres, badge messages
    layout/TopBar.tsx          # hamburger, search, messages, notifs, theme, avatar+menu, modale
    ConfirmAction.tsx          # modale de confirmation (portail)
    auth-guard.tsx
    ui/                        # primitives (Button, Card, Input, Badge)
  hooks/useTheme.ts            # light/dark/system, classe sur <html>
  lib/api.ts                   # apiFetch + Bearer + refresh JWT
  lib/navigation.ts            # NAV_ITEMS, SETTING_ITEMS, filtres rôle
  lib/types.ts  config.ts
  providers/auth-provider.tsx
  services/notificationService.ts
  services/messagingService.ts # téléchargement pièce jointe en blob authentifié
```

## Checklist alignement avec `front-data-academy-student`

- [x] **Sidebar équivalente** — fixed/relative, drawer mobile, **collapse 224 ↔ 72px**, bouton flottant `solar:alt-arrow-left-bold`, sections **Navigation** + **Paramètres**, badge messages avec polling, transitions max-width/opacity identiques
- [x] **TopBar équivalente** — hamburger mobile, slot gauche, recherche optionnelle, panneau **Messages** (polling 30 s, aperçu, lien « Tout voir »), panneau **Notifications** (polling 60 s, mark-all-read), toggle clair/sombre, séparateur, **avatar + menu** (Profil, Paramètres, Politique, Déconnexion) + **modale `ConfirmAction`** avant logout
- [x] **Dark mode** — `useTheme` (`light` / `dark` / `system`), classes `.dark` / `.light` posées sur `<html>`, `prefers-color-scheme` honoré, copie exacte du bloc `@theme` et des variables neutres dark de la ref dans `src/app/globals.css`
- [x] **Typographie** — Poppins via `next/font` (`--font-poppins`)
- [x] **Iconify** — famille **Solar** comme la ref
- [x] **Filtrage rôle** — menu sidebar et accès basés sur `role` (`GET /users/auth/me/`)
- [x] **Pas de lien nu** vers `/messaging/attachments/{id}/download/` — téléchargement en blob avec Bearer

## Ce qui diffère volontairement de l’étudiant

- Routes et libellés du menu (programmes côté admin/concepteur, candidatures, mentorat staff, utilisateurs, etc.)
- Pas de sélecteur de langue dans la sidebar (le repo étudiant a `react-i18next`, le backoffice est en français uniquement). Le slot existe — ajouter un i18n est trivial si nécessaire.
- Logo simplifié (icône `solar:graduation-bold` + libellé `DATA ACADEMY admin`) tant que `/academy-logo.svg` n’est pas fourni dans `public/`. Pour l’ajouter, déposer le fichier dans `public/academy-logo.svg` et remplacer l’`Icon` du composant `Sidebar.tsx` par `<img src="/academy-logo.svg" />`.
