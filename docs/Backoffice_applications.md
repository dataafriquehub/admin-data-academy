# Prompt ultime — Page **Candidatures** backoffice (Next.js)

**Usage :** colle ce document (ou la section « PROMPT POUR L’AGENT ») pour refondre l’écran **Candidatures** en interface **dense, moderne et alignée** sur **`BACKOFFICE_NEXTJS.md`** (Sidebar + TopBar, tokens `primary-*` / `neutral-*`, Poppins, Iconify Solar, thème clair/sombre).

**Prérequis UI :** même coque globale ; ce document ne définit que le **contenu** de `<main>`.

---

## 1. Rôles et permissions (réel backend)

| Rôle | `GET /admissions/applications/` (liste) | `PATCH …/review/<id>/` (statut) | Remarque |
|------|----------------------------------------|-----------------------------------|----------|
| **student** | Ses candidatures uniquement | **403** (`IsReviewerOnly`) | Portail apprenant. |
| **admin** | Toutes | **Oui** | Revue = changement de statut. |
| **mentor** | Toutes | **403** | Peut **voir / filtrer** mais **pas** approuver/rejeter via API actuelle. |
| **program_creator** | **403** (`IsStudentOrReviewer`) | **403** | **Pas d’accès** aux endpoints liste/revue dans ce dépôt — masquer le menu ou prévoir évolution API (voir **`BACKOFFICE_API_BACKLOG.md`**). |

---

## 2. Contrat API — préfixe **`/api/admissions/`**

Source de vérité : **`swagger.json`**, groupe **Admissions**.

### 2.1 Liste principale (backoffice staff)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/applications/` | Liste ; **`ApplicationListSerializer`** ; **pas de pagination** DRF par défaut (réponse tableau complet). |

**Query params** (tous optionnels sauf usage) :

| Param | Type | Effet |
|-------|------|--------|
| `status` | string | Un des statuts **`pending`**, **`under_review`**, **`approved`**, **`rejected`**. |
| `program` | integer | ID programme (`program_id`). |
| `student` | integer | ID étudiant (`student_id`). |
| `reviewed_by` | integer | ID du reviewer enregistré. |
| `search` | string | Recherche **OR** sur `student.username`, `student.email`, `program.title` (icontains). |
| `ordering` | string | Défaut **`-applied_at`** ; autres champs ordonnables Django si exposés (ex. `applied_at`, `status`). |

**Redondance :** `GET /applications/by-status/?status=…` et `GET /applications/by-program/?program_id=…` reproduisent des cas particuliers — la liste avec **`status`** et **`program`** suffit en général ; **`by-program`** attend le param **`program_id`** (pas `program`).

### 2.2 Détail candidature — **limitation API actuelle**

| Méthode | Chemin | Comportement |
|---------|--------|----------------|
| `GET` | `/applications/<id>/` | **`get_object_or_404(Application, pk=pk, student=request.user)`** → réservé au **candidat**. Un **admin / mentor** qui appelle pour une candidature d’un **autre** utilisateur reçoit **404**. |

**Stratégie front backoffice tant que l’API n’est pas étendue :**

1. **Vue liste / ligne** : les champs **`ApplicationListSerializer`** sont déjà **riches** (étudiant `UserSerializer`, programme, motivation, historique emploi, financement, paiement, statuts, dates, `reviewed_by`). Utiliser la **ligne sélectionnée** comme source « détail » dans un **drawer** ou panneau latéral.
2. **Données pédagogiques** : **`GET /applications/<id>/progress/`** utilise **`get_application_for_student_or_staff`** — **admin et mentor** peuvent charger la progression pour **n’importe quel id** de candidature (onglet « Parcours » / lien externe).
3. Après **`PATCH …/review/<id>/`**, la réponse contient déjà un **`ApplicationDetailSerializer`** — utile pour rafraîchir l’état après action admin.

**Évolution backend souhaitée :** exposer **`GET /applications/<id>/`** pour staff avec la même logique que `get_application_for_student_or_staff` — entrée **`BACKOFFICE_API_BACKLOG.md`**.

### 2.3 Revue (changement de statut) — **admin uniquement**

| Méthode | Chemin | Corps | Réponse |
|---------|--------|--------|---------|
| `PATCH` | `/applications/review/<id>/` | `{ "status": "pending" \| "under_review" \| "approved" \| "rejected" }` | **`ApplicationDetailSerializer`** ; notifications étudiant + emails selon **`filter_recipients_for_notification`**. |

**Mentor :** pas d’accès — masquer les actions de revue ou afficher **403** explicite si contournement UI.

### 2.4 Création candidature

| Méthode | Chemin | Qui |
|---------|--------|-----|
| `POST` | `/applications/` | **Étudiant** (corps **`ApplicationCreateSerializer`**) — hors périmètre page backoffice « staff » sauf tests.

### 2.5 Suppression

| Méthode | Chemin | Qui |
|---------|--------|-----|
| `DELETE` | `/applications/<id>/` | **Étudiant** propriétaire uniquement — pas pour admin nettoyer une ligne via cette route dans l’état actuel.

### 2.6 Liens utiles depuis une candidature **approved**

| Usage | Endpoint indicatif |
|--------|---------------------|
| Progression | `GET /applications/<id>/progress/` |
| Agenda | `GET /applications/<id>/agenda/` |
| Certificats | `GET /admissions/certificates/` (filtrage côté client par `application.id` selon serializer) |

Voir Swagger pour chemins exacts et permissions.

---

## 3. Champs liste (`ApplicationListSerializer`) — à exploiter dans l’UI

Au-delà de ID / programme / email : **`applied_at`**, **`motivation`** (extrait), **`status`**, **`funding_type`**, **`payment_status`**, **`review_at`**, **`approved_at`**, **`reviewed_by`**, **`student`** (objet complet autorisé `UserSerializer`), **`program`** (`ProgramSerializer` ou équivalent selon rôle).

Afficher **badges** pour statut et paiement ; **date relative** pour `applied_at`.

---

## 4. Spec design — console « pro »

### 4.1 En-tête

- Titre **Candidatures** ; sous-titre **métier** (*« Dossiers, revue et suivi des admissions »*) — **pas** de phrase « voir Swagger » en prod.
- **KPI** calculés client après `GET /applications/` : total, par statut (4 compteurs ou mini barres), éventuellement « en attente de revue » (`pending` + `under_review`).

### 4.2 Barre d’outils

- **Recherche** : branchée sur **`search=`** (une seule requête, pas triple champ si backend suffit).
- **Filtres** : **statut** (select ou chips), **programme** (select alimenté par `GET /programs/programs/` ou valeurs distinctes dans les données), **étudiant** (select / autocomplete avec **`student=`** si IDs connus).
- **Tri** : exposer **`ordering`** (ex. plus récent d’abord = défaut API).
- Pas de sous-titre technique listant les query params.

### 4.3 Liste / tableau dense

- Colonnes recommandées : **candidat** (nom si disponible dans `student`, sinon email), **programme**, **statut** (badge couleur thème), **soumis le** (`applied_at`), **paiement** (`payment_status` / `funding_type`), **reviewer** (`reviewed_by`).
- **Actions** : **Voir dossier** → drawer avec données ligne + onglet **Progression** (`GET …/progress/`). **Changer statut** → modal ou drawer réservé **admin** → `PATCH …/review/<id>/`.

### 4.4 Drawer détail (sans `GET` détail staff)

- Sections : résumé, motivation (scroll), parcours pro (`employment_history`), financement, bloc paiement.
- Admin : sélecteur de statut + **Enregistrer** → `PATCH review`.

### 4.5 États UX

- Skeleton, vide, erreur + retry ; **403** pour program_creator → page ou carte « accès non configuré pour votre rôle ».

---

## 5. PROMPT POUR L’AGENT

Tu es un·e développeur·se front senior (**Next.js App Router**, **TypeScript**, **Tailwind**), charte **`BACKOFFICE_NEXTJS.md`**.

### Mission

Refondre la **page Candidatures** du backoffice : remplacer liste minimaliste + filtres bruts par une **console admissions** décrite en **§4**, en t’appuyant sur **`GET /api/admissions/applications/`** avec les query params du **§2.1**, et sur **`PATCH /api/admissions/review/<id>/`** pour les **admin** uniquement.

### Règles strictes

1. Utiliser **`search`**, **`status`**, **`program`**, **`student`** côté API plutôt que tout filtrer en mémoire si possible.  
2. **Ne pas** compter sur **`GET /applications/<id>/`** pour le staff : détail = **données liste** + **`GET …/progress/`** pour l’onglet parcours jusqu’à évolution backend.  
3. **Mentor** : lecture + filtres ; **pas** de bouton revue (403).  
4. **Admin** : revue avec feedback sur erreurs **400** Django.  
5. Aucune URL d’API en sous-titre utilisateur.

### Livrables

- Page + composants (KPI, filtres, tableau/cartes, drawer, modal revue admin).  
- Types TS alignés sur **`ApplicationListSerializer`** / réponses review.  
- README : matrice rôle.

---

## 6. Références code (ce dépôt)

| Sujet | Fichier |
|--------|---------|
| Liste + filtres | `apps/admissions/views.py` (`ApplicationListCreateView`, `APPLICATION_LIST_PARAMETERS`) |
| Détail / delete étudiant | `apps/admissions/views.py` (`ApplicationDetailView`) |
| Revue | `apps/admissions/views.py` (`ReviewApplicationView`) |
| Permissions | `apps/admissions/permissions.py` (`IsStudentOrReviewer`, `IsReviewerOnly`) |
| Serializers | `apps/admissions/serializers.py` |
| Progression staff | `apps/admissions/progression.py` (`get_application_for_student_or_staff`) |

---

*Complément de **`BACKOFFICE_NEXTJS.md`**. Voir aussi **`BACKOFFICE_API_BACKLOG.md`** pour les évolutions API post-front.*
