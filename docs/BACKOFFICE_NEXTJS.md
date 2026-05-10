# Rapport front — Backoffice (Next.js)

Document de cadrage pour implémenter un backoffice Data Academy (**Next.js**, App Router) consommant la même API que le portail étudiant. Tous les chemins d’URL ci‑dessous sont **relatifs** au préfixe **`/api`** (ex. `https://votre-domaine.org/api/...`).

---

## Exigence principale — présentation **identique** au portail étudiant

Le backoffice **ne doit pas** introduire une autre DA ni une autre ergonomie générale.

| Domaine | Exigence |
|--------|----------|
| **Vue d’ensemble** | Même **structure de page** que l’étudiant : grille **Sidebar + colonne principale** (`TopBar` fixe au-dessus, **zone centrale scrollable seule**). |
| **Sidebar** | **Oui** — même comportement que le portail : logo `academy-logo.svg` + libellé **DATA** / **ACADEMY**, sections avec libellés (navigation / paramètres / langue), boutons avec **icônes + texte** (animations expand/collapse), état **actif** (`bg-primary-5`, `text-primary-1`), **réduction desktop** (~224 px → ~72 px) avec bouton flottant sur le bord, **overlay + drawer** sur mobile au clic menu hamburger **de la topbar**. |
| **Topbar** | **Oui** — **tous les éléments** présents dans le portail étudiant, même logique et même famille d’UI (tailles, arrondis, couleurs, hover) : **menu hamburger** (mobile uniquement), **slot gauche** optionnel ou **barre de recherche** configurable (`showSearch`), **bouton Messages** avec badge + **panneau** (aperçu conversations, lien « tout voir »), **bouton Notifications** avec badge + **panneau** (liste + marquer tout lu), **bouton bascule thème sombre / clair**, **séparateur vertical**, **avatar + nom** (≥ sm) avec **menu** (Profil, Paramètres, Politique/confidentialité, Déconnexion) et **modal de confirmation** de déconnexion. |
| **Couleurs** | **Les mêmes** que `src/index.css` : jetons **`primary-*`**, **`secondary-*`**, **`neutral-*`** — aucune palette parallèle. |
| **Thèmes** | **Mode clair (« white »)** et **mode sombre (`dark`)** comme l’étudiant : surcharge des neutres via **`:root.dark` / `:root.light`** et **préférence système** si aucun choix explicite (`prefers-color-scheme`). Toggle topbar équivalent au hook **`useTheme`** (classe sur `<html>`). |
| **Typographie & icons** | **Poppins** ; **`@iconify/react`** avec les mêmes conventions (ex. famille **Solar**) pour garder les mêmes pictos. |

**Ce qui change** entre étudiant et backoffice : **uniquement** le **contenu de la sidebar** (libellés, routes, filtrage par `role`), le **slot gauche** / recherche ou la **page métier** dans `<main>` — pas la **coque** (sidebar/topbar/popovers/modale).

Références composants étudiants :

| Composant / fichier | Rôle |
|--------------------|------|
| `src/components/layout/Layout.jsx` | Shell : sidebar, overlay mobile, bouton collapse, **TopBar** + **`<main>`** scroll. |
| `src/components/layout/Sidebar.jsx` | Navigation, bloc langue FR/EN, styles des items. |
| `src/components/layout/TopBar.jsx` | Hamburger, search, messagerie, notifications, toggle thème, menu utilisateur. |
| `src/index.css` | **`@theme`**, couleurs, police, breakpoints visuels, scrollbars, transitions thème. |
| `src/hooks/useTheme.js` | Persistant classe `dark` / `light` sur `<html>` (à reproduire côté Next). |

Pour le design system réutilisable sous Next.js, **copier** le bloc **`@theme` { … }** et les règles **`:root.dark` / `.light` / média `prefers-color-scheme`** du fichier **`src/index.css`** dans vos styles globaux (ex. `app/globals.css` avec Tailwind v4 comme le projet étudiant).

---

**Références API (versionnées)**

| Fichier | Usage |
|--------|--------|
| `swagger.json` *(racine repo backend)* | OpenAPI |
| `postman_full_collection.json` *(racine repo backend)* | Collection Postman (variable `base_url` ; chemins sous `/api/...`). Variante projet front : `doc_api/postman_full_collection.json`. |
| `deploy/nginx.example.conf` | Exemple reverse-proxy |

**Documents complémentaires (backend)**

| Fichier | Usage |
|---------|--------|
| `Backoffice_dashboard.md` | Prompt / spec détaillée **page Dashboard** (KPI + graphiques + listes depuis `GET /users/admin/dashboard/`). |
| `Backoffice_users.md` | Prompt / spec **page Utilisateurs** (liste, filtres client, actions : messagerie, notifications, lien candidatures, reset password) selon Swagger actuel ; écarts backend documentés. |
| `Backoffice_notifications.md` | Prompt / spec **page Notifications** backoffice (inbox + envoi ciblé + rappels quiz, permissions admin, design dense) — contrat **`/notifications/`** complet. |
| `Backoffice_mentorship.md` | Prompt / spec **page Mentorat** (sessions staff, participants, ICS, KPI, filtres, création/PATCH mentor) — contrat **`/mentorship/`** + pièges `perform_create`. |
| `Backoffice_applications.md` | Prompt / spec **page Candidatures** (liste filtrée, drawer sans `GET` détail staff, revue admin, mentor lecture seule) — contrat **`/admissions/applications/`**. |
| `Backoffice_modules.md` | Prompt / spec **page Modules** (catalogue `GET/POST/PATCH` **`/programs/modules/`**, couverture base64, nesting lourd, périmètre program_creator vs admin). |
| `Backoffice_programs.md` | Prompt / spec **page Programmes** (`GET/POST/PATCH` **`/programs/programs/`**, validation admin, `program_modules`, statuts, mentor vs créateur). |
| `Backoffice_settings.md` | Prompt / spec **page Paramètres** (`GET/PATCH` **`/users/auth/me/`**, préférences notif, MDP, avatar via **`POST /uploads/`**). |
| `Backoffice_profile.md` | Prompt / spec **page Profil** (carte d’identité, `GET` **`/users/auth/me/`**, liens vers Paramètres) quand les deux écrans coexistent. |
| `BACKOFFICE_API_BACKLOG.md` | **File d’attente** des évolutions API à appliquer **après** la livraison front backoffice (pagination, filtres, enrichissements serializers), avec checklist régénération Swagger / Postman. |

---

## 1. Configuration Next.js

- **`NEXT_PUBLIC_API_BASE_URL`** : URL backend **sans** slash final ; inclure **`/api`** si tout l’API y est préfixée — alignement Nginx/Docker réel obligatoire.
- Requêtes authentifiées : **`Authorization: Bearer <access_token>`**.
- Corps : **`application/json`** sauf uploads (**multipart**).

---

## 2. Tableau de bord admin (API agrégée)

Une seule requête pour alimenter la **page Dashboard** : KPI, graphiques, listes récentes (voir aussi **`Backoffice_dashboard.md`** pour le prompt IA détaillé).

| Méthode | Endpoint | Notes |
|--------|----------|------|
| **Dashboard** | `GET /users/admin/dashboard/` | Réservé au périmètre **`IsAdminUserCustom`** (admin / équivalents configurés côté backend). Réponse JSON : **`generated_at`**, **`counts`** (utilisateurs par rôle, programmes par validation, candidatures par statut, mentorat, messagerie, notifications non lues, uploads, certificats, etc.), **`recent`** (dernières candidatures, programmes en attente validation, prochaines sessions). **403** si le compte n’est pas autorisé. |

Pour la **liste détaillée des champs**, typer depuis la réponse réelle ou le schéma Swagger (*Utilisateurs* → *Dashboard admin — statistiques agregees*).

---

## 3. Authentification

| Méthode | Endpoint | Notes |
|--------|----------|------|
| Connexion | `POST /users/login/` | Tokens JWT (`LoginResponse` dans Swagger). |
| Rafraîchissement | `POST /users/auth/token/refresh/` | |
| Profil | `GET/PATCH /users/auth/me/` | `PATCH` sans modifier `email` en écriture arbitraire côté produit suivant Swagger. UX **Paramètres** (formulaires) : **`Backoffice_settings.md`** ; vue **Profil** résumé : **`Backoffice_profile.md`**. |
| Liste utilisateurs (admin) | `GET /users/auth/users/` | Périmètre **`IsAdminUserCustom`** (voir permissions). |
| Détail utilisateur + rôle (staff) | `GET` / `PATCH /users/auth/users/{id}/` | Lecture profil ; **`PATCH`** partiel : corps `{"role": "…"}` uniquement — garde-fous (dernier admin, comptes Django superuser réservés aux superusers). |

**Rôle** : champ `role` (`admin`, `program_creator`, `student`, `mentor`, …). Filtrer **menus sidebar** et **routes** après `GET …/auth/me/` — même **patterns** UX que le portail (éléments masqués, pas chrome différent).

---

## 4. Matrice rôle → périmètre backoffice

| Zone | Admin | Program creator | Mentor |
|------|-------|-----------------|--------|
| Dashboard agrégé (`/users/admin/dashboard/`) | **Oui** | Non (*endpoint 403*) — prévoir redirection ou masquage menu | Non |
| Programmes & modules | Oui | Ses programmes ; règles API | Liste programmes **approved** |
| Candidatures / revue | Oui | Selon API | Selon reviewer |
| Mentorat (staff) | Oui | Non typiquement | Ses sessions staff |
| Notifications ciblées (`POST …/send/`) | Oui | Non | Non |
| Liste tous utilisateurs | Oui | Non | Non |

Détail : `permission_classes` Django + **Swagger** = contrat exact.

---

## 5. Programmes & modules

Préfixe **`/programs/`**.

| Ressource | Méthodes |
|-----------|----------|
| `/programs/programs/` | GET, POST |
| `/programs/programs/{id}/` | GET, PUT, PATCH, DELETE |
| `/programs/modules/` | GET, POST |
| `/programs/modules/{id}/` | GET, PUT, PATCH, DELETE |

Détail UX page **Modules** (catalogue indépendant, permissions créateur / admin, payload `contents` / `quizzes` / `cover_image_base64`) : **`Backoffice_modules.md`**.

Détail UX page **Programmes** (liste par rôle, validation, parcours `program_modules`, prix & dates) : **`Backoffice_programs.md`**.

**Programme — rattachement modules** :

- **`program_modules`** recommandé : `{ module_id, order, start_date?, end_date?, length_in_weeks? }`, dates monotones si présentes ; **ne pas** mélanger avec **`module_ids`** dans une même requête.
- **`module_ids`** (legacy).

**Couvertures** : `cover_url` ; souvent après **`POST /uploads/`** puis URL retournée.

---

## 6. Admissions & certificats

Préfixe **`/admissions/`** — listes dossiers (**filtres** `status`, `program`, `student`, `search`, `ordering`), **review** admin (`PATCH …/applications/review/<id>/`), progression / agenda, **`/certificates/`**, gabarit certificat par programme (`certificate-template`). Détail UX page **Candidatures** : **`Backoffice_applications.md`**. Voir Swagger pour chemins détaillés.

---

## 7. Mentorat

Préfixe **`/mentorship/`** — CRUD **`/sessions/`** et **`/attendees/`** staff (**admin + mentor** ; mentor filtré sur ses sessions), export **`GET …/sessions/{id}/calendar/`** (ICS). Endpoint **`/sessions/for-my-accessible-programs/`** = portail (étudiant / concepteur / mentor) — **403** pour **admin**, qui doit utiliser la liste staff. Détail UX : **`Backoffice_mentorship.md`**.

---

## 8. Messagerie

Préfixe **`/messaging/`**. Pièces jointes : téléchargement **`GET …/attachments/{id}/download/`** avec **Bearer** — pas de navigation « lien nu » sans jeton dans le navigateur.

---

## 9. Notifications

Voir Swagger : **`/notifications/`** — liste (filtres `is_read`, `type`), non lues, marquer lues / tout lire, **`POST /notifications/send/`** (envoi ciblé, **`IsAdminOrSuperuser`**), rappels quiz **`/notifications/quiz-deadlines/preview/`** et **`…/send/`**. Détail UX + design : **`Backoffice_notifications.md`**.

---

## 10. Uploads

**`POST /uploads/`** en **multipart** (`file`, `folder`, etc.) → **`url`** absolue à réutiliser (`cover_url`, etc.).

---

## 11. Bonnes pratiques Next.js

Client API avec auth, layouts par **rôle** (avec la **même** coque étudiante), formulaires avec erreurs Django 400, pagination `page` / `page_size` si disponible dans l’API. Pour le dashboard admin : **`GET /users/admin/dashboard/`** en un seul appel (cf. **`Backoffice_dashboard.md`**).

---

## 12. Rappels visuels (tokens — même source que l’étudiant)

Pas de tableau « équivalent appréhendé » : la **vérité** est **`src/index.css`**.

- **Bleu primaire** : `#0872E0` (`primary-1`).
- **Orange secondaire / accents** : `#FF8A00` (`secondary-1`).
- **Neutres** : **`neutral-0` … `neutral-8`** (fonds `neutral-1`–`neutral-3`, texte dense `neutral-7`–`neutral-8`, bordures `neutral-4`).
- Logo texte deux tons : **`#2F80ED`** (DATA) + **`#F2994A`** (ACADEMY) comme dans **`Sidebar.jsx`**.

Checklist avant livraison UI :

1. Sidebar + TopBar **fonctionnellement équivalentes** au port étudiant (liste des contrôles ci‑dessus).
2. Fichier thème **aligné** sur `index.css` (couleurs + dark/light).
3. Aucun écran backoffice « plein écran sans sidebar » pour la navigation courante (sauf pages publiques login si séparées).

---

## 13. Erreurs fréquentes

| Symptôme | Piste |
|----------|--------|
| 401 | Token absent ou expiré. |
| 403 | Rôle ou périmètre objet. |
| 400 | Validation JSON / `program_modules` vs `module_ids`. |
| 413 | Nginx `client_max_body_size` + limites API. |
| 502 | Mauvais port upstream. |

---

## 14. Génération artefacts API (backend)

```bash
python manage.py generate_swagger swagger.json -o -f json
python scripts/generate_postman_collection.py
```

---

*Backoffice Next.js : **même coque** que `front-data-academy-student` (sidebar, topbar et contrôles, couleurs, **clair + sombre**) ; contenu de navigation et pages métier adaptés aux rôles staff. Contrat API : **Swagger**.*

---

## Annexe — Prompt maître (copier-coller pour l’agent / l’équipe)

Collez le bloc ci-dessous tel quel dans Cursor, ChatGPT, ou un ticket d’implémentation. Adapter uniquement **[CHEMIN_VERS_REPO_ETUDIANT]** et l’URL d’API.

```
Tu es un développeur front senior. Construis une application Next.js (App Router, TypeScript recommandé) : le **backoffice Data Academy**.

## Source de vérité UI — NON NÉGOCIABLE
Le backoffice doit **se présenter exactement comme** le portail étudiant existant (**référence** : projet `front-data-academy-student` à [CHEMIN_VERS_REPO_ETUDIANT]). Pas de nouveau design system ni autre mise en page « admin » générique.

1) **Copie comportement et structure** depuis ces fichiers de référence (lis-les et reproduis le rendu pixel-logique équivalent — classes Tailwind, espacements, états hover/actif, panneaux) :
   - `src/components/layout/Layout.jsx` — shell : sidebar + overlay mobile + bouton collapse + TopBar fixe + `<main>` scroll seul ; fond page `bg-neutral-3`.
   - `src/components/layout/Sidebar.jsx` — logo, libellés DATA / ACADEMY, sections, items nav (icône + label, collapse ~224px / ~72px), bas de sidebar (paramètres, aide si présent), **commutateurs langue FR/EN** avec les mêmes styles.
   - `src/components/layout/TopBar.jsx` — **tout** ce qui existe : hamburger mobile, slot gauche / recherche (`showSearch` + champ arrondi), **Messages** avec badge et dropdown (aperçu conversations + voir tout), **Notifications** avec badge et dropdown (liste + marquer tout lu), **toggle dark/light**, séparateur, **avatar + nom** + menu (Profil, Paramètres, Politique/confidentialité, Déconnexion) + **modal de confirmation** logout.
   - `src/index.css` — importe/recopie le bloc **`@theme`**, `@import "tailwindcss"`, `@font-face`/Poppins, règles **`:root.dark` / `:root.light`**, `@media (prefers-color-scheme: dark)`, scrollbars et transitions globales.
   - `src/hooks/useTheme.js` — même logique : persistance classe sur `<html>`, préférence utilisateur vs système.

2) **Seule différence avec l’étudiant** : le **tableau des entrées sidebar** et les **routes** pointent vers les écrans backoffice (`/programs` admin, admissions, mentorship, utilisateurs admin, envoi notifications, dashboard admin, etc.). Les **URLs/menus** filtrent selon **`role`** retourné par `GET /users/auth/me/`. Le **chrome** (sidebar/topbar/popovers/modale/thème)** reste strictement aligné.**

3) **Stack** : Next.js App Router ; Tailwind **v4** comme le repo étudiant ; `@iconify/react` (famille Solar où c’est utilisé là-bas). Police **Poppins**.

## API backend
- Préfixe : toutes les routes sous **`/api/...`** (aligner avec `NEXT_PUBLIC_API_BASE_URL`, sans slash final ; inclure `/api` dans la variable si pertinent).
- Toute requête authentifiée : header `Authorization: Bearer <access_token>`.
- JSON par défaut ; uploads en **multipart** (`POST /uploads/`, messaging avec fichiers si besoin).

### Auth & périmètres
- `POST /users/login/`, refresh `POST /users/auth/token/refresh/`, session/profil `GET/PATCH /users/auth/me/` ; staff liste users `GET /users/auth/users/` ; détail / rôle `GET` / `PATCH /users/auth/users/{id}/` (`PATCH` corps `role` uniquement).
- **Dashboard admin agrégé (une requête)** : `GET /users/admin/dashboard/` — réservé comptes autorisés côté API ; utilise `counts` pour KPI/graphes et `recent` pour tableaux/listes widgets. Détail fonctionnel dans le doc **`Backoffice_dashboard.md`** du repo backend.
- Après connexion : lire `role`; **garder hors backoffice pur** ou rediriger les rôles non staff si le produit l’exige (admin / program_creator / mentor selon votre matrice). Menu et routes suivent Swagger + permissions API.

### Domaines fonctionnels principaux à couvrir (détail des chemins & body : **Swagger** + collection Postman)
- **Programs** `GET/POST /programs/programs/`, `GET/PATCH/PUT/DELETE …/{id}/` ; modules `GET/POST /programs/modules/`, `GET/PATCH …/{id}/`. Pour les programmes utiliser **`program_modules`** `{ module_id, order, start_date?, end_date?, … }` ; **ne pas** mixer `program_modules` et `module_ids` dans la même requête.
- **Admissions** : applications, filtres `by-status`, `by-program`, review, progress, certificates, certificate-template par programme si exposé.
- **Mentorship** : sessions staff (admin + mentor) — distinguer endpoints « staff » vs `for-my-accessible-programs` (étudiants).
- **Messaging** : converser ; pour pièces jointes **toujours** télécharger avec client authentifié (`blob`) — pas de lien `<a href>` direct vers `/attachments/{id}/download/` (401 sans Bearer).
- **Notifications** incl. `POST /notifications/send/` si rôle admin.
- **Uploads** `POST /uploads/` → réutiliser l’URL retournée dans `cover_url` etc.

### Qualité livrable
- Client HTTP unique type `fetchWithAuth` (ou axios) + gestion 401/refresh si vous implémentez le flux.
- Layouts **protégés** par rôle avec la **même coque** Layout/Sidebar/TopBar partout dans l’espace privé staff.
- i18n : au minimum français + anglais cohérent avec les clés équivalentes côté étudiant où c’est pertinent.
- Liste des erreurs Django 400 bien affichées sur formulaires complexes (program_modules, dates).

Livrer : projet Next runnable, README (env, commandes), et une checklist UI confirmant Sidebar + Topbar **fonctionnellement équivalentes** au repo étudiant (y compris dark mode).

Commence par lire les fichiers de layout et `index.css` du repo étudiant, puis scaffold Next + thème copié, puis auth, puis coque commune, puis pages métier par rôle.
```
