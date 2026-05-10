# Prompt ultime — Page **Programmes** backoffice (Next.js)

**Usage :** colle ce document (ou la section « PROMPT POUR L’AGENT ») pour refondre l’écran **Programmes** en interface **dense, moderne et alignée** sur **`BACKOFFICE_NEXTJS.md`** (Sidebar + TopBar, tokens `primary-*` / `neutral-*`, Poppins, Iconify Solar, thème clair/sombre).

**Prérequis UI :** même coque globale ; ce document ne définit que le **contenu** de `<main>`.

---

## 1. Routes API — préfixe **`/api/programs/`**

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/programs/` | Liste programmes (`ProgramViewSet`). |
| `POST` | `/programs/` | Création — **`admin`** ou **`program_creator`** (`IsProgramCreatorOrAdmin`). |
| `GET` | `/programs/{id}/` | Détail (modules via liaison **`programmodule_set`** sérialisée en **`modules`**). |
| `PUT` / `PATCH` | `/programs/{id}/` | Mise à jour — propriétaire (`created_by`) ou **admin**. |
| `DELETE` | `/programs/{id}/` | Suppression — même règle objet. |

Swagger : groupe **Programmes**, serializer **`ProgramSerializer`** (sauf **`student`** en lecture liste/détail → **`StudentProgramSerializer`**).

### 1.1 Périmètre liste (`get_queryset`)

| Rôle | `GET /programs/` |
|------|------------------|
| **program_creator** | **Uniquement** les programmes où **`created_by` = moi** (tous **`validation_status`**). |
| **admin** | **Tous** les programmes (`order_by -updated_at`). |
| **student** / **mentor** | Programmes **`validation_status = approved`** uniquement. |

**Backoffice staff :** en pratique **admin** (vue catalogue complète) et **program_creator** (vue « mes brouillons / mes programmes »). **Mentor** ne voit que l’**approved** dans l’API — adapter menu ou message si vous exposez la même route.

### 1.2 Création (`perform_create`)

| Créateur | `validation_status` initial | `validated_by` / `validated_at` |
|----------|-------------------------------|--------------------------------|
| **admin** | **`approved`** | Renseignés (créateur admin comme valideur). |
| **program_creator** | **`pending`** | Vides. |

### 1.3 Champs métier (`Program` — exposés via `fields = '__all__'`)

Champs usuels : **`title`**, **`description`**, **`cover_url`**, **`tag`**, **`length_in_weeks`**, **`start_date`**, **`end_date`**, **`price`**, **`currency`**, **`validation_status`**, **`validation_comment`**, **`created_by`** (read-only côté serializer habits), dates **`created_at`**, **`updated_at`**.

**Couverture programme :** le modèle expose **`cover_url`** ; il n’y a **pas** de champ **`cover_image_base64`** dans **`ProgramSerializer`** (contrairement aux **modules**). En pratique : **`POST /uploads/`** puis renseigner **`cover_url`**, ou saisie URL absolue.

### 1.4 Validation admin (`PATCH` / `PUT`)

- Seul un utilisateur **`role === admin`** peut envoyer **`validation_status`**, **`validation_comment`** dans le corps — le serializer **retire** ces champs pour les autres rôles (`validate()`).
- **`validated_by`** / **`validated_at`** sont gérés par le backend lors des transitions (**`approved`** / **`rejected`** / **`pending`**) dans **`ProgramSerializer.update()`** — ne pas les poster manuellement.

**Comportement concepteur :** si un **`program_creator`** modifie un programme déjà **`approved`** ou **`rejected`**, le backend repasse le statut en **`pending`** (re-soumission implicite).

### 1.5 Rattachement modules (corp **`POST` / `PATCH` / `PUT`)

Deux modes **mutuellement exclusifs** dans une même requête :

| Mode | Champ | Règle |
|------|--------|--------|
| **Recommandé** | **`program_modules`** | Liste `{ module_id, order, start_date?, end_date?, length_in_weeks? }` — **`order`** unique ; **`module_id`** unique ; dates **`start_date`** cohérentes avec l’ordre ; pas les deux modes ensemble. |
| Legacy | **`module_ids`** | Liste d’IDs dans l’ordre → ordre = position 1..n, **`length_in_weeks`** = 1 par défaut. |

À la mise à jour, si **`program_modules`** ou **`module_ids`** est fourni, la synchronisation **remplace** les lignes **`ProgramModule`** (delete + recreate pour `program_modules`).

**Restriction concepteur :** chaque **`module_id`** doit être un module **`created_by`** le concepteur (sinon **400**).

### 1.6 Lecture détail — enrichissements admin

Pour **`role === admin`**, la représentation JSON ajoute **`creator`** et **`validated_by_user`** (**`UserSerializer`**) en plus des champs modèle.

### 1.7 Perf

Pas de **pagination** sur la liste programmes dans l’état actuel ; prévoir filtres **client** ou évolution API (**`BACKOFFICE_API_BACKLOG.md`**).

---

## 2. Spec design — console « pro »

### 2.1 En-tête

- Titre **Programmes** ; sous-titre métier (*« Offre de formation et validation catalogue »*) — **pas** « voir Swagger » en prod.
- Bouton **« Nouveau programme »** → flux **`POST /programs/`** (masquer ou désactiver si le rôle n’a pas le droit d’écriture).

### 2.2 KPI (après `GET /programs/`)

- Totaux par **`validation_status`** (**pending** / **approved** / **rejected**) — utiles surtout pour **admin**.
- **program_creator** : mettre en avant **« En attente de validation »**.

### 2.3 Filtres & recherche

- **Client** : recherche sur titre, tag, extrait description (pas de paramètre **`search=`** API programmes).
- **Segments** ou select : **Tous** | **En ligne (approved)** | **En attente** | **Rejetés** — mapping sur **`validation_status`** (filtrage client ou sous-ensembles dédiés).

### 2.4 Liste / tableau ou grille

- Colonnes : **titre**, **tag**, **badge statut** (couleurs thème : pending = accent, approved = succès, rejected = neutre/erreur), **prix** + **currency**, **dates** (`start_date`–`end_date` ou `length_in_weeks`).
- **Couverture** : vignette **`cover_url`** si présent, sinon placeholder.
- **Admin** : colonne **créateur** (`creator` si présent dans le détail — pour la liste, peut nécessiter **`GET`** détail ou colonne vide sans évolution API).
- **Action** : **Ouvrir** (drawer ou route **`/programs/[id]`**) avec **`GET /programs/{id}/`**.

### 2.5 Page ou drawer détail / édition

- Sections : infos générales, **visuel** (`cover_url`), **validation** (admin : statut + commentaire ; lecture seule pour les autres selon règles).
- **Bloc modules du parcours** : tableau **`modules`** (lecture) avec ordre, dates cohorte, lien vers fiche module catalogue **`/programs/modules/{id}/`**.
- **Édition parcours** : builder **`program_modules`** (drag-and-drop ordre + dates) ou formulaire aligné Swagger ; rappel **ne pas** mixer avec **`module_ids`**.

### 2.6 États UX

- Skeleton, vide, erreur + retry ; affichage clair des erreurs **400** (ex. modules non autorisés, dates incohérentes).

---

## 3. PROMPT POUR L’AGENT

Tu es un·e développeur·se front senior (**Next.js App Router**, **TypeScript**, **Tailwind**), charte **`BACKOFFICE_NEXTJS.md`**.

### Mission

Refondre la **page Programmes** du backoffice selon **§2**, en consommant **`GET/POST/PATCH/DELETE /api/programs/programs/`** (chemins exacts **`/programs/`** sous le préfixe API — vérifier **`NEXT_PUBLIC_API_BASE_URL`**) et **`ProgramSerializer`** / Swagger.

### Règles

1. Respecter la **matrice rôle** (**§1.1**) — un concepteur ne doit pas s’attendre à voir le catalogue global complet.  
2. **Validation** : boutons / champs admin pour **`validation_status`** + **`validation_comment`** via **`PATCH`**.  
3. **Rattachement modules** : uniquement **`program_modules`** *ou* **`module_ids`**, jamais les deux.  
4. Pas de sous-titre utilisateur avec URL brute d’API.

### Livrables

- Liste + vue détail/édition + création ; types TS alignés sur la réponse Swagger.  
- README : flux admin vs program_creator, comportement re-passage en **pending**.

---

## 4. Références code (ce dépôt)

| Sujet | Fichier |
|--------|---------|
| ViewSet | `apps/programs/views.py` (`ProgramViewSet`) |
| Serializer | `apps/programs/serializers.py` (`ProgramSerializer`, `StudentProgramSerializer`) |
| Permissions | `apps/programs/permissions.py` |
| Modèle | `apps/programs/models.py` (`Program`, `ProgramModule`) |

---

*Complément de **`BACKOFFICE_NEXTJS.md`** et de **`Backoffice_modules.md`**. Évolutions API : **`BACKOFFICE_API_BACKLOG.md`**.*
