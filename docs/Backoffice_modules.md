# Prompt ultime — Page **Modules** backoffice (Next.js)

**Usage :** colle ce document (ou la section « PROMPT POUR L’AGENT ») pour refondre l’écran **Modules** (catalogue indépendant) en interface **dense, moderne et alignée** sur **`BACKOFFICE_NEXTJS.md`** (Sidebar + TopBar, tokens `primary-*` / `neutral-*`, Poppins, Iconify Solar, thème clair/sombre).

**Prérequis UI :** même coque globale ; ce document ne définit que le **contenu** de `<main>`.

---

## 1. Routes API — préfixe **`/api/programs/`**

Le routeur DRF enregistre la ressource **`modules`** sous le même préfixe que les programmes.

| Méthode | Chemin REST | Rôle |
|---------|-------------|------|
| `GET` | `/modules/` | Liste modules (`ModuleViewSet`). |
| `POST` | `/modules/` | Création — **`admin`** ou **`program_creator`** uniquement (`IsProgramCreatorOrAdmin.has_permission` écriture). |
| `GET` | `/modules/{id}/` | Détail (contenus + quiz imbriqués selon serializer). |
| `PUT` / `PATCH` | `/modules/{id}/` | Mise à jour — propriétaire (`created_by`) ou **admin**. |
| `DELETE` | `/modules/{id}/` | Suppression — même règle objet. |

Source de vérité : **`swagger.json`**, groupe **Modules**.

### 1.1 Périmètre des données selon le rôle (`get_queryset`)

| Rôle | Liste `/modules/` |
|------|-------------------|
| **program_creator** | **Uniquement** les modules où **`created_by` = utilisateur**. |
| **admin** (et tout autre rôle authentifié hors créateur sur cette branche) | **Tous** les modules (tri **`-updated_at`**). |

Les **`program_creator`** ne voient pas le catalogue global dans la liste — normal côté API.

### 1.2 Permissions objet (`IsProgramCreatorOrAdmin`)

- **Lecture** : tout utilisateur authentifié **passé `has_permission`** ; pour un **`program_creator`**, accès **objet par objet** au détail : uniquement modules **dont il est créateur** (**403** / **404** selon routing pour les autres).
- **Écriture** : **`admin`** tout pouvoir sur les modules ; **`program_creator`** seulement si **`created_by`** correspond.

**Conséquence backoffice :** si la sidebar « Modules » est ouverte à **admin + program_creator**, le **program_creator** verra une liste **plus courte** que l’admin — l’UI doit l’assumer (badge « Mes modules » ou équivalent).

### 1.3 Serializer exposé

Sauf **`student`** en **liste / retrieve** ( **`StudentModuleSerializer`** — quiz sans `is_correct`), le staff utilise **`ModuleSerializer`** :

| Champ | Lecture | Écriture |
|--------|---------|----------|
| `id`, `created_at`, `updated_at`, `created_by` | oui | `created_by` read-only (assigné au **`POST`** par `perform_create`) |
| `title`, `description`, `objectives` | oui | oui |
| `cover_url` | oui | indirect via **`cover_image_base64`** |
| **`cover_image_base64`** | — | write-only ; décodage serveur → fichier stocké → **`cover_url`** absolu |
| **`contents`** | oui (imbriqués) | liste imbriquée ; **`PATCH`/`PUT`** avec `contents` **remplace tout** le contenu existant (suppression puis recréation côté backend). |
| **`quizzes`** | oui (imbriqués) | idem — **remplacement complet** si fourni. |

**Attention perf :** un **`GET /modules/`** renvoie pour chaque ligne les **`contents`** et **`quizzes`** complets — payloads potentiellement **très lourds**. Stratégies front : virtualisation de liste, ou chargement **léger** liste + **`GET /modules/{id}/`** au clic ; évolution API possible (**`BACKOFFICE_API_BACKLOG.md`**).

### 1.4 Création / édition riches

- Création **`POST`** : peut inclure **`contents[]`**, **`quizzes[]`** avec **`questions[]`** / **`answers[]`** (voir Swagger / `ModuleSerializer`).
- Même **`cover_image_base64`** (data URL ou base64 brut) pour la couverture.
- Édition **`PATCH`** partielle possible sur métadonnées seules ; si **`contents`** ou **`quizzes`** envoyés, comportement **replace all** documenté dans `serializers.py`.

### 1.5 Lien avec les programmes

Les modules du **catalogue** sont reliés aux **programmes** via **`ProgramModule`** (many-to-many). La composition d’un parcours programme se fait surtout côté **`PUT/PATCH /programs/{id}/`** avec **`program_modules`** ou **`module_ids`** — hors écran « liste modules » pur, mais utile pour un lien **« Programmes utilisant ce module »** (nécessiterait requête ou endpoint agrégé ; optionnel, pas obligatoire dans l’API actuelle).

---

## 2. Spec design — console « pro »

### 2.1 En-tête

- Titre **Modules** ; sous-titre métier (*« Catalogue de modules de formation — contenus et évaluations »*) — **pas** de mention « schéma API » en prod.
- Si **`program_creator`** : sous-titre ou badge **« Vos modules »** pour éviter la confusion avec la vue admin globale.

### 2.2 KPI (calcul client après `GET /modules/`)

- **Nombre total** de lignes retournées.
- Optionnel : **nombre avec couverture** (`cover_url` non vide).
- Optionnel : **somme** `contents.length` / `quizzes.length` (attention charge si liste déjà lourde).

### 2.3 Barre d’outils

- **Recherche locale** sur **titre**, **description** (extrait), si les données sont déjà chargées — **pas de paramètre `search=`** sur l’API modules actuelle.
- **Tri client** : par titre, par `updated_at` (cohérent avec ordre serveur par défaut).
- Bouton **« Nouveau module »** → route formulaire ou drawer **`POST /modules/`** (réservé admin / program_creator ; sinon bouton masqué ou désactivé avec tooltip).

### 2.4 Liste / grille

- Colonnes ou cartes : **miniature** (`cover_url` ou placeholder neutre), **titre**, **extrait description** (1–2 lignes), **objectifs** en tooltip ou ligne secondaire.
- **Métadonnées** : `updated_at` formaté relatif + date complète au survol ; **créateur** (résolution **`created_by`** via objet imbriqué ou fetch users si seulement l’ID est présent — le serializer expose **`created_by`** comme FK, vérifier forme JSON Swagger).
- **Compteurs** : nombre de contenus / quiz (longueur tableaux) sans tout déplier dans la liste.
- **Actions** : **Voir** (drawer ou page détail avec `GET /modules/{id}/`), **Modifier**, **Supprimer** — selon **`has_object_permission`** (masquer édition/suppression si ni admin ni propriétaire).

### 2.5 Détail / édition

- Onglets ou sections : **Informations**, **Couverture** (upload → conversion **`cover_image_base64`** côté front ou upload fichier → base64), **Contenus**, **Quiz** — réutiliser les patterns de formulaires lourds décrits dans **`BACKOFFICE_NEXTJS.md`** (erreurs 400 Django).
- Avertissement UX clair avant sauvegarde si **`contents` / `quizzes`** complets renvoyés : **remplacement total** des blocs concernés.

### 2.6 États UX

- Skeleton, vide, erreur + retry.
- **403** sur écriture pour rôle non autorisé.

---

## 3. Pièges connus

| Piège | Détail |
|--------|--------|
| Liste énorme | `GET /modules/` inclut **tout** le nesting ; prévoir virtualisation ou détail lazy. |
| `program_creator` vs admin | Listes de tailles différentes — pas un bug. |
| Couverture vide | **`cover_url`** null jusqu’à envoi **`cover_image_base64`** ou valeur manuelle si autorisée par validation. |
| Étudiant sur cette page | Si route exposée, même API liste tout le catalogue — ce n’est pas le cas « portail étudiant » habituel ; restreindre la **route** backoffice par rôle côté Next. |

---

## 4. PROMPT POUR L’AGENT

Tu es un·e développeur·se front senior (**Next.js App Router**, **TypeScript**, **Tailwind**), charte **`BACKOFFICE_NEXTJS.md`**.

### Mission

Refondre la **page Modules** du backoffice : remplacer le tableau minimal + sous-titre technique par une **console catalogue** (**§2**), branchée sur **`GET /api/programs/modules/`**, **`GET/POST/PATCH/DELETE /api/programs/modules/{id}/`** selon Swagger.

### Règles

1. **`program_creator`** : afficher l’état « catalogue restreint à mes créations » sans comparer à tort avec la vue admin.  
2. **Création / édition** : respecter **`ModuleSerializer`** (dont **`cover_image_base64`**, **`contents`**, **`quizzes`**).  
3. Gestion des **réponses 400** validation (champs Django).  
4. Pas d’URL brute d’API dans le sous-titre.

### Livrables

- Page liste + vue détail/drawer + formulaire création/édition (peut être multi-étapes).  
- Types TS alignés sur **`ModuleSerializer`**.  
- README : matrice rôle (qui voit tout / qui crée / qui édite).

---

## 5. Références code (ce dépôt)

| Sujet | Fichier |
|--------|---------|
| ViewSet | `apps/programs/views.py` (`ModuleViewSet`) |
| Serializer | `apps/programs/serializers.py` (`ModuleSerializer`, `StudentModuleSerializer`) |
| Permissions | `apps/programs/permissions.py` (`IsProgramCreatorOrAdmin`) |
| Modèle | `apps/programs/models.py` (`Module`) |
| URLs | `apps/programs/urls.py` |

---

*Complément de **`BACKOFFICE_NEXTJS.md`**. Évolutions API listées dans **`BACKOFFICE_API_BACKLOG.md**.* 
