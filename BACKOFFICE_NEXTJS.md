# Rapport front — Backoffice (Next.js)

Document de cadrage pour implémenter un backoffice (administration, suivi, contenu) consommant l’API **Data Academy**. Tous les chemins d’URL ci‑dessous sont **relatifs** au préfixe **`/api`** (ex. `https://votre-domaine.org/api/...`).

**Identité visuelle** : le backoffice doit **reprendre le même design system** que le portail étudiant (`front-data-academy-student`) — palette, typo, rayons, mode sombre, patterns de layout — afin d’offrir une expérience cohérente entre administration et espace apprenant. Voir la [section 11](#11-design-system--cohérence-avec-le-portail-étudiant).

**Références dans le dépôt**

| Fichier | Usage |
|--------|--------|
| `swagger.json` | OpenAPI 2.0, schémas et opérations |
| `postman_full_collection.json` | Collection prête (variable `base_url` = hôte seul, chemins incluent déjà `/api/...`) |
| `deploy/nginx.example.conf` | Exemple reverse-proxy (body size, upstream) |
| `src/index.css` | **Tokens design** : `@theme` Tailwind v4 (couleurs, typo Poppins, tailles de texte) |

---

## 1. Configuration Next.js

- **`NEXT_PUBLIC_API_BASE_URL`** : URL publique du backend **sans** slash final, **avec** le préfixe API si vous exposez tout sous `/api` — typiquement `https://api.example.org/api` **ou** base `https://api.example.org` + préfixe codé en dur `/api`. À aligner avec le déploiement réel (Nginx + Docker écoutant souvent un port mappé).
- Toutes les requêtes authentifiées : header  
  `Authorization: Bearer <access_token>`
- Corps JSON : `Content-Type: application/json` sauf upload (**multipart**).

---

## 2. Authentification

| Méthode | Endpoint | Notes |
|--------|----------|------|
| Connexion | `POST /users/login/` | Corps typique : email + password → réponse avec tokens JWT (voir schéma Swagger `LoginResponse`). |
| Rafraîchissement | `POST /users/auth/token/refresh/` | Si vous utilisez les URLs dj-rest-auth JWT (voir `swagger.json` sous `/users/auth/`). |
| Profil | `GET/PATCH /users/auth/me/` | `PATCH` : champs profil **sans** modifier `email` (non exposés à l’écriture). |
| Liste utilisateurs (admin) | `GET /users/auth/users/` | Réservé **admin** (`UserListView`). |

OAuth / social : `POST /users/auth/social/` si prévu côté produit.

**Rôle utilisateur** : champ `role` sur l’utilisateur (`admin`, `program_creator`, `student`, `mentor`, …). Le backoffice filtre les menus et routes selon `role` renvoyé par `GET …/auth/me/`.

---

## 3. Matrice rôle → périmètre backoffice

| Zone | Admin | Program creator | Mentor |
|------|-------|-----------------|--------|
| Programmes & modules (CRUD, validation) | Oui | Ses programmes + création ; validation selon règles API | Lecture liste programmes **approved** |
| Candidatures / revue | Oui | Selon endpoints | Souvent lecture / actions reviewer selon vue |
| Mentorat (sessions staff) | Oui | Non (staff = admin + mentor sur routes dédiées) | Ses sessions + catalogue staff |
| Notifications « envoi ciblé » | Oui | Non | Non |
| Liste tous utilisateurs | Oui | Non | Non |

Les détails exacts sont dans les classes `permission_classes` des vues Django ; le Swagger reste la vérité contractuelle.

---

## 4. Programmes & modules (cœur du backoffice concepteur / admin)

**Router REST** — préfixe **`/programs/`** (donc URL complète `/api/programs/...`).

| Ressource | Méthodes | Commentaire |
|-----------|----------|-------------|
| `/programs/programs/` | GET, POST | Liste / création programme. |
| `/programs/programs/{id}/` | GET, PUT, PATCH, DELETE | Détail / mise à jour. Admin peut changer `validation_status`, commentaires validation. |
| `/programs/modules/` | GET, POST | Modules catalogue (contenus imbriqués possibles selon serializer). |
| `/programs/modules/{id}/` | GET, PUT, PATCH, DELETE | **program_creator** : uniquement modules dont il est `created_by`. |

**Rattachement modules au programme** — lors du **POST/PUT/PATCH** programme, utiliser de préférence :

- **`program_modules`** (recommandé) : tableau d’objets  
  `{ module_id, order, start_date?, end_date?, length_in_weeks? }`  
  - `start_date` : ouverture calendrier côté apprenant ; `end_date` informatif.  
  - Cohérence : par ordre croissant, les `start_date` (si présentes) doivent être monotones.  
  - Ne pas envoyer **`program_modules` et `module_ids`** dans la même requête.

- **`module_ids`** (legacy) : liste d’IDs dans l’ordre → ordre implicite 1..n, sans dates fines.

**Couvertures / médias** : champs `cover_url` sur programme et module ; remplissage souvent après **`POST /uploads/`** (multipart) puis copie de l’URL retournée.

---

## 5. Admissions & certificates (admin / reviewer)

Préfixe **`/admissions/`**.

| Endpoint | Usage backoffice |
|----------|------------------|
| `GET /admissions/applications/` | Liste filtrée selon rôle. |
| `GET/PATCH /admissions/applications/{id}/` | Détail / mise à jour dossier. |
| `GET …/by-status/?status=…` | Filtrage par statut. |
| `GET …/by-program/?program_id=…` | Candidatures d’un programme. |
| `PATCH /admissions/applications/review/{id}/` | **Revue** (statut, etc. — voir schéma). |
| `GET …/progress/`, `GET …/agenda/`, modules agrégés | Suivi parcours. |
| `GET /admissions/certificates/` | Liste certificats. |
| `GET/PUT /admissions/programs/{program_id}/certificate-template/` | Gabarit PDF certificat programme. |

---

## 6. Mentorat (staff admin + mentor)

Préfixe **`/mentorship/`**.

| Endpoint | Public visé |
|----------|---------------|
| `GET/POST …/sessions/` etc. | **Admin + mentor** : CRUD sessions ; mentor filtré sur ses sessions. |
| `GET …/sessions/{id}/calendar/` | ICS — aussi étudiants/concepteurs si droits (voir backend). |
| `GET …/sessions/for-my-accessible-programs/` | **Pas** pour catalogue staff : portail étudiant / concepteur / mentor (sessions par programme accessible). |

Ne pas utiliser la liste sessions « staff » pour un écran « mes sessions programme » côté élève : endpoint dédié ci‑dessus.

---

## 7. Messagerie

Préfixe **`/messaging/`**.

- Conversations, messages, groupes programme, **pièces jointes** (upload multipart sur `POST …/messages/`, téléchargement `GET …/attachments/{id}/download/` avec Bearer — **ne pas** ouvrir l’URL de téléchargement en navigation directe sans jeton).
- Politique fichiers : taille / nombre limites côté serveur ; purge automatique après durée configurable (commande serveur, pas le front).

---

## 8. Notifications

Préfixe **`/notifications/`**.

- Liste, non lues, marquer lues.
- **`POST /notifications/send/`** : envoi ciblé (**admin** typiquement) — corps selon `SendNotificationSerializer` dans Swagger.

---

## 9. Uploads

- **`GET/POST /uploads/`** — `POST` en **multipart** : champ `file`, optionnel `folder`, `resource_type`.
- Réponse contient une **`url`** absolue à réutiliser dans les entités (`cover_url`, `profile_picture_url`, contenus module, etc.).

---

## 10. Bonnes pratiques Next.js (App Router)

1. **Client API unique** : fonction `fetchWithAuth` qui lit le token (cookie httpOnly préférable si vous posez le token depuis une route handler BFF, ou session serveur) et ajoute `Authorization`.
2. **Route handlers** Next pour proxy optionnel si vous évitez CORS ou masquez l’URL API.
3. **Layouts par rôle** : lecture `role` après chargement session ; redirection si non autorisé.
4. **Formulaires lourds** (programme + `program_modules`) : état local typé (TypeScript) + validation côté client alignée sur les erreurs 400 Django.
5. **Pagination** : plusieurs listes supportent `page` / `page_size` (voir query params dans Swagger).

---

## 11. Design system — cohérence avec le portail étudiant

Le portail étudiant fixe l’identité produit via **`src/index.css`** (Tailwind CSS **v4**, directive `@import "tailwindcss"` et bloc **`@theme { }`**). Pour que le backoffice Next.js **semble le même produit**, reproduire ces éléments dans **`app/globals.css`** (ou équivalent).

### 11.1 Palette (variables CSS → utilitaires Tailwind)

| Rôle | Jeton | Valeur indicatives | Usage UI |
|------|--------|-------------------|----------|
| Primaire (bleu ciel) | `--color-primary-1` | `#0872E0` | Boutons principaux, liens actifs, barre de défilement, focus |
| Primaire (transparences) | `primary-2` … `primary-5` | dérivés `#0872E0` | Survols, fonds légers, badges |
| Secondaire (orange) | `--color-secondary-1` | `#FF8A00` | CTA secondaires, accents (comme le portail) |
| Neutres | `neutral-0` … `neutral-8` | blancs/gris/bleutés `#03172D` | Surfaces `neutral-1`–`neutral-3`, texte `neutral-7`–`neutral-8`, bordures `neutral-4` |

Les classes Tailwind attendues côté étudiant sont du type **`bg-primary-1`**, **`text-neutral-8`**, **`border-neutral-4`**, **`bg-secondary-1`** — à obtenir en recopiant le même `@theme` que dans `src/index.css`.

### 11.2 Typographie

- Police : **Poppins** (Google Fonts), référencée comme `--font-poppins` / `--default-font-family`.
- Échelle déjà définie dans `@theme` : `--text-h1` … `--text-h6`, `--text-body`, `--text-small`, `--text-xs` (voir fichier source pour les px exacts).

### 11.3 Mode sombre

Le portail applique les neutres sombres via **`@media (prefers-color-scheme: dark)`** sur `:root:not(.light)` et via **`:root.dark`** / **`:root.light`** pour un choix utilisateur. Reproduire la même logique sur `<html className="dark">` dans Next.js pour un rendu identique (sidebar, cartes, formulaires).

### 11.4 Patterns de composants (à calquer)

Repères extraits du layout étudiant — à réutiliser pour la shell du backoffice :

- **Fond page** : `bg-neutral-3`
- **Sidebar** : `bg-neutral-1`, `border-r border-neutral-4`, largeur **~224px** ouverte / **~72px** réduite (même ordre de grandeur que le portail)
- **Cartes / panneaux** : `bg-neutral-1`, `border border-neutral-4`, `rounded-2xl`
- **Bouton primaire** : fond `primary-1`, texte blanc, coins arrondis cohérents (`rounded-lg` / `rounded-xl`)
- **Zone de saisie** : fond `neutral-2` ou `neutral-1`, bordure `neutral-4`, texte `neutral-8`

### 11.5 Icônes

Le portail étudiant utilise **`@iconify/react`** (familles type **Solar**, etc.). Réutiliser Iconify avec les mêmes familles évite un décalage visuel avec les écrans « publics ».

### 11.6 Checklist rapide (revue design)

- [ ] Même fichier `@theme` (ou équivalent) que `src/index.css` pour les couleurs et la typo
- [ ] Poppins chargée (next/font ou lien Google Fonts)
- [ ] Mode clair / sombre aligné (`dark` / `light` sur `<html>`)
- [ ] Cartes et sidebar : mêmes neutres et rayons (`rounded-2xl`, bordures `neutral-4`)
- [ ] Boutons : `primary-1` pour l’action principale ; `secondary-1` pour l’accent orange si besoin
- [ ] Scrollbar : optionnellement reprendre les styles WebKit du portail (thumb `primary-1`) pour cohérence

---

## 12. Erreurs fréquentes

| Symptôme | Piste |
|----------|--------|
| 401 | Token expiré ou absent — refresh ou re-login. |
| 403 | Rôle insuffisant ou objet hors périmètre (ex. programme d’un autre concepteur). |
| 400 validation | Corps JSON invalide ou règle métier (`program_modules` vs `module_ids`, dates vs ordre). |
| 413 / upload | Augmenter limite côté **Nginx** (`client_max_body_size`) et vérifier limite API uploads. |
| 502 | Mauvais port upstream (ex. conteneur mappé sur **8002** et non 8000). |

---

## 13. Génération des artefacts API

Depuis la racine du repo backend :

```bash
python manage.py generate_swagger swagger.json -o -f json
python scripts/generate_postman_collection.py
```

À relancer après chaque évolution d’API ; committer `swagger.json` et `postman_full_collection.json` si le contrat change.

---

*Document de cadrage pour un backoffice Next.js aligné API **et** identité visuelle du portail étudiant Data Academy ; se référer toujours à `swagger.json` pour les schémas exacts et les champs requis.*
