# Prompt ultime — Page **Mentorat** backoffice (Next.js)

**Usage :** colle ce document (ou la section « PROMPT POUR L’AGENT ») pour refondre l’écran **Mentorat** en interface **dense, moderne et alignée** sur **`BACKOFFICE_NEXTJS.md`** (Sidebar + TopBar + tokens `primary-*` / `neutral-*`, Poppins, Iconify Solar, thème clair/sombre).

**Prérequis UI :** même coque globale ; ce document ne définit que le **contenu** de `<main>`.

---

## 1. Périmètre rôles (aligné matrice `BACKOFFICE_NEXTJS.md`)

| Rôle | `GET /mentorship/sessions/` (liste staff) | `GET …/for-my-accessible-programs/` |
|------|---------------------------------------------|--------------------------------------|
| **admin** | Oui — **toutes** les sessions, toutes colonnes. | **403** — message expliquant d’utiliser la liste staff. |
| **mentor** | Oui — **uniquement** `mentor = utilisateur connecté`. | Oui — vue portail (groupée par programme) — **pas** l’écran staff principal du backoffice. |
| **program_creator** | **403** (permission `IsAdminOrMentorStaffOnly`). | Contexte étudiant / concepteur — **ne pas** utiliser pour le catalogue staff. |
| **student** | **403**. | Oui (portail). |

**Décision produit backoffice :** la page « Mentorat » du menu staff s’appuie sur **`GET /api/mentorship/sessions/`** + CRUD associé. **Masquer** l’entrée menu ou afficher un panneau d’explication pour les rôles non **admin / mentor** (le backend renverra **403** sinon).

**Participations (`/mentorship/attendees/`) :** même permission **admin + mentor** ; le mentor ne voit que les participants des **ses** sessions.

---

## 2. Contrat API — préfixe `/api/mentorship/`

Source de vérité : **`swagger.json`**, groupe **Mentorat**.

### 2.1 Sessions staff (`SessionViewSet`)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/sessions/` | Liste sessions ; ordre serveur **`-scheduled_at`** (plus récent en premier). **Mentor** : filtre **`mentor_id = moi`**. **Pas de pagination** DRF par défaut sur ce viewset (liste complète). |
| `POST` | `/sessions/` | Création. Voir **§2.3** (comportement **`mentor`** à la création). |
| `GET` | `/sessions/{id}/` | Détail. |
| `PUT` / `PATCH` | `/sessions/{id}/` | Mise à jour (admin : tout ; mentor : uniquement **ses** sessions — **`has_object_permission`**). |
| `DELETE` | `/sessions/{id}/` | Suppression (mêmes règles d’objet). |
| `GET` | `/sessions/{id}/calendar/` | Téléchargement **ICS** ; vérifie **`session_readable_by_user`** (étudiant / mentor / admin / concepteur selon règles accès) — utile aussi pour **copier lien calendrier** depuis le backoffice. |

**Serialisation (`SessionSerializer`) :** champs modèle **`Session`** + lecture **`program_details`** (objet programme imbriqué via `ProgramSerializer` sur `program`).

Champs **session** utiles UI : `id`, `program` (FK), `mentor` (FK), `title`, `description`, `scheduled_at`, `duration_minutes`, `url` (lien visio), `recording_url` (replay), `created_at`, `updated_at`.  
**Important :** les colonnes « Début / Fin » ne sont **pas** deux champs distincts dans l’API : afficher **`scheduled_at`** (début) et **fin** = `scheduled_at + duration_minutes` (calcul client, fuseau **local**).

### 2.2 Portail « mes accès » (hors écran staff principal)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/sessions/for-my-accessible-programs/` | Sessions groupées par programme (étudiant / concepteur / mentor). **Admin : 403** avec message renvoyant vers `GET /sessions/`. |

Ne **pas** utiliser cet endpoint comme source principale de la **page backoffice staff** pour un admin.

### 2.3 Création `POST /sessions/` — piège **mentor**

`perform_create` force **`mentor = request.user`**.

- Lorsqu’un **admin** crée une session, le **mentor** enregistré est **l’admin** lui-même sauf si le flux application contournait ce comportement — en pratique il faudra souvent un **`PATCH`** suivant pour définir **`mentor`** sur l’ID du mentor réel (champ présent sur le modèle / serializer).
- Un **mentor** créateur est correctement assigné comme animateur.

Documenter cette étape dans le formulaire (ex. étape 2 « Assigner le mentor » pour admin).

### 2.4 Participants (`SessionAttendeesViewSet`)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/attendees/` | Liste des **`SessionAttendees`** ; mentor : filtré sur sessions dont il est **`mentor`**. |
| `POST` | `/attendees/` | Ajout participant (`session` + `user`). **`perform_create`** refuse si non admin et la session n’est pas à ce mentor. |
| `GET` / `PUT` / `PATCH` / `DELETE` | `/attendees/{id}/` | CRUD unitaire (permissions objet alignées). |

**Serializer** : `fields = '__all__'` → `id`, `session`, `user`, `attended`, `joined_at`.

**Limite front actuelle :** aucun filtre query `?session=` côté backend sur la liste. Pour afficher les participants d’**une** session, **filtrer côté client** la liste `GET /attendees/` par `session === id` **ou** proposer une évolution API `?session=<id>` (hors périmètre immédiat).

### 2.5 Ressources connexes (formulaires)

- **Choix du programme** : `GET /programs/programs/` (selon permissions rôle — admin voit les programmes pertinent Swagger).
- **Choix du mentor** (assignation admin) : `GET /users/auth/users/` filtré côté client sur `role === "mentor"` **ou** liste dédiée si vous en exposez une — aligner avec les IDs utilisateur du modèle `mentor`.

---

## 3. Synthèse design — page « pro » et riche

Objectif : remplacer le tableau minimal + sous-titre avec **URL API** par une **console mentorat** lisible.

### 3.1 En-tête de page

- Titre **Mentorat** (ou **Sessions de mentorat**).
- Sous-titre **métier** (*« Planification des sessions live et suivi des participants »*) — **pas** d’URL d’endpoint en prod.
- **Pills KPI** (calcul client depuis `GET /sessions/` une fois chargé) :  
  **Total** | **À venir** (`scheduled_at` > maintenant) | **Passées** | **Cette semaine** (optionnel).

### 3.2 Barre d’outils

- **Recherche** plein texte sur titre (et éventuellement nom programme via `program_details.title`).
- **Filtres** (client ou ré-fetch selon volumétrie) :  
  - **Programme** (select alimenté par agrégation des `program` / `program_details` présents dans la liste, ou `GET /programs/programs/`).  
  - **Mentor** (select — **admin uniquement** ; liste des mentors distincts dans les données ou depuis users).  
  - **Période** : à venir / passées / toutes.  
- **Bouton primaire** **« Nouvelle session »** → drawer ou page `POST /sessions/` (avec flux admin **mentor** — **§2.3**).

### 3.3 Liste principale

- Préférer **cartes** ou **tableau dense** avec :  
  - **Titre** + **badge** programme (texte court).  
  - **Mentor** : nom depuis FK (résolution via objet imbriqué si l’API enrichit — sinon `GET users` cache ; souvent le detail session inclut `mentor` id seulement — **charger noms** via map id→user si nécessaire).  
  - **Début** : `scheduled_at` formaté (timezone locale).  
  - **Fin** : calcul `+ duration_minutes`.  
  - **Lien visio** : icône lien externe vers `url` (ouverture nouvel onglet).  
  - **Replay** : si `recording_url`, chip cliquable.  
  - **Statut temporel** : badge *À venir* / *En cours* / *Terminée* (en cours = entre début et fin).

### 3.4 Actions par ligne

- **Calendrier** : `GET /sessions/{id}/calendar/` avec **`fetch` + blob** ou navigation vers URL avec **Authorization** — pour ICS, le navigateur ouvre souvent le fichier ; utiliser **`window.open` + blob** ou lien temporaire créé côté client après fetch avec Bearer (même principe que pièces jointes messagerie si applicable).
- **Modifier** / **Supprimer** : `PATCH` / `DELETE` selon droits (mentor : ses lignes uniquement).
- **Participants** : ouvrir **drawer** listant les enregistrements filtrés depuis `GET /attendees/` pour `session_id` ; actions **ajouter / retirer** participant selon `POST` / `DELETE` attendees.

### 3.5 Formulaire création / édition

- Champs alignés Swagger : `program`, `title`, `description`, `scheduled_at` (datetime-local), `duration_minutes`, `url`, `recording_url`, et **`mentor`** (select, surtout **admin** après création ou dans le même form en `PATCH`).
- Validation client : `scheduled_at` requis ; `url` URL valide ; durée > 0.
- Messages d’erreur **400** Django affichés proprement.

### 3.6 États UX

- **Skeleton** chargement, **vide** engageant, **erreur** avec retry.
- **403** : page dédiée « accès réservé aux équipes mentorat » si l’utilisateur ouvre l’URL sans rôle.

---

## 4. Écarts backend optionnels (hors scope front immédiat)

1. **Pagination / tri serveur** sur `GET /sessions/` si volumétrie forte.  
2. **Query `?session=`** sur `GET /attendees/` pour éviter de ramener toute la table participants.  
3. **Inclure `mentor` et `program` nested** noms dans `SessionSerializer` pour éviter N+1 requêtes users (évolution serializer).

---

## 5. Références code (ce dépôt)

| Sujet | Fichier |
|--------|---------|
| Vues sessions + ICS + portail | `apps/mentorship/views.py` |
| Participants | `apps/mentorship/views.py` (`SessionAttendeesViewSet`) |
| Serializers | `apps/mentorship/serializers.py` |
| Permissions staff | `apps/mentorship/permissions.py` (`IsAdminOrMentorStaffOnly`) |
| Règles lecture ICS / portail | `apps/mentorship/session_access.py` |
| Modèles | `apps/mentorship/models.py` |
| Routes | `apps/mentorship/urls.py` |

---

## PROMPT POUR L’AGENT

Tu es un·e développeur·se front senior (**Next.js App Router**, **TypeScript**, **Tailwind**), charte **`BACKOFFICE_NEXTJS.md`**.

### Mission

Refondre la **page Mentorat** du backoffice : remplacer l’UI actuelle (tableau minimal, sous-titre technique) par une **console riche** décrite en **§3** de ce fichier, en t’appuyant **exclusivement** sur les endpoints **§1–2** et **`swagger.json`**.

### Règles métier à respecter

1. Source liste staff : **`GET /api/mentorship/sessions/`** — pas `for-my-accessible-programs` pour l’admin.  
2. Afficher **début** = `scheduled_at`, **fin** = début + `duration_minutes`.  
3. **`POST` création** : si l’utilisateur est **admin**, prévoir assignation **mentor** réelle via **`PATCH`** si le backend fixe le mentor au créateur (**§2.3**).  
4. Participants : consommer **`GET /api/mentorship/attendees/`** et filtrer par `session` côté client tant qu’il n’y a pas de filtre serveur.  
5. ICS : **`GET /api/mentorship/sessions/{id}/calendar/`** avec auth — pas d’URL publique sans jeton.

### Interdits

- Ne pas inventer de routes CRUD hors Swagger.  
- Ne pas afficher les chemins API bruts comme sous-titre utilisateur.

### Livrables

- Page + sous-composants (KPI, filtres, liste, formulaire, drawer participants).  
- Types TS alignés sur **`Session`**, **`SessionAttendees`**, réponses listes.  
- README : variables d’env, matrice rôle (qui voit quoi).

---

*Complément de **`BACKOFFICE_NEXTJS.md`**. Voir aussi `Backoffice_dashboard.md`, `Backoffice_users.md`, `Backoffice_notifications.md`, `message_backoffice.md`.*
