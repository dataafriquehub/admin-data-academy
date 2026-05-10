# Prompt ultime — Page **Paramètres** backoffice (Next.js)

**Usage :** colle ce document (ou la section « PROMPT POUR L’AGENT ») pour refondre l’écran **Paramètres** (profil staff connecté) en interface **moderne, structurée et alignée** sur **`BACKOFFICE_NEXTJS.md`** (Sidebar + TopBar, tokens `primary-*` / `neutral-*`, Poppins, Iconify Solar, thème clair/sombre — inchangé).

**Prérequis UI :** même coque globale ; ce document ne définit que le **contenu** de `<main>`.

**Pas de nouvelle API obligatoire** pour une V1 riche : tout est couvert par **`GET/PATCH /users/auth/me/`**, **`POST /users/auth/password/change/`**, **`POST /uploads/`** (puis mise à jour **`profile_picture_url`**). Les évolutions optionnelles (locale, endpoint avatar dédié) sont listées dans **`BACKOFFICE_API_BACKLOG.md`**.

---

## 1. Contrat API — groupe Utilisateurs (`/api/users/`)

### 1.1 Profil connecté

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/auth/me/` | Profil complet (**`UserSerializer`**). |
| `PATCH` | `/auth/me/` | Mise à jour partielle (**`CurrentUserUpdateSerializer`** — voir **§2**). |

### 1.2 Sécurité — mot de passe

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `POST` | `/auth/password/change/` | Utilisateur connecté : ancien mot de passe + nouveau (voir **`ChangePasswordSerializer`** / Swagger). |

Les flux **mot de passe oublié** (`/auth/password/reset/`, confirm) existent pour les parcours hors session ; un lien secondaire « problème de connexion » peut renvoyer vers le flux portail si le produit le prévoit.

### 1.3 Photo de profil (URL après upload)

| Étape | Endpoint | Rôle |
|--------|-----------|------|
| 1 | `POST /uploads/` | **multipart** — champ fichier selon Swagger ; réponse avec **`url`** absolue. |
| 2 | `PATCH /auth/me/` | Corps **`{ "profile_picture_url": "<url>" }`**. |

Pas d’upload multipart direct sur **`/auth/me/`** dans le serializer actuel — le duo **uploads + PATCH** est le flux officiel documenté dans la vue **`CurrentUserView`**.

---

## 2. Champs lecture (`GET …/auth/me/` — `UserSerializer`)

Utiliser ces données pour un écran complet sans placeholders vides injustifiés :

| Champ | Usage UI |
|--------|-----------|
| `id`, `email`, `username` | **Email** affiché en **lecture seule** (non modifiable via **`PATCH me`**). |
| `first_name`, `last_name` | Champs éditables. |
| `role` | Badge ou ligne « Type de compte » (non éditable ici — réservé admin ailleurs). |
| `country`, `phone_number` | Champs éditables. |
| `profile_picture`, `profile_picture_url` | Aperçu avatar ; persistance via **`profile_picture_url`** après upload. |
| `notify_email_modules`, `notify_email_quiz_deadlines`, `notify_email_live_sessions`, `notify_push_important_updates` | Quatre **interrupteurs** (sections Notifications). |

---

## 3. Champs écriture (`PATCH …/auth/me/` — `CurrentUserUpdateSerializer`)

Champs autorisés uniquement :

- `first_name`, `last_name`
- `profile_picture_url`
- `country`, `phone_number`
- Les quatre booléens **`notify_*`** ci-dessus.

**Interdit côté API actuelle :** `email`, `role`, mots de passe via ce **`PATCH`**.

---

## 4. Spec design — page « pro »

### 4.1 Structure générale

Découper en **sections** (cartes `rounded-2xl`, `border-neutral-4`, `bg-neutral-1`), pas un seul bloc formulaire :

1. **Profil** — avatar + nom + email lecture seule + pays + téléphone.
2. **Notifications** — 4 toggles avec libellés FR clairs (alignés sur la matière métier : modules, quiz / deadlines, sessions live, alertes importantes).
3. **Sécurité** — formulaire **changer le mot de passe** (appel **`POST …/password/change/`**), messages d’erreur champs Django (**400**).
4. **Compte** (optionnel) — rôle affiché, éventuel lien « Déconnexion » si vous dupliquez l’action hors TopBar (sinon ignorer).

### 4.2 En-tête page

- Titre **Paramètres** ; sous-titre métier (*« Profil et préférences du compte »*) — **pas** de ligne technique « PATCH /users/auth… » en production pour les utilisateurs finaux.

### 4.3 Avatar

- Cercle avec image **`profile_picture_url`** ou initiales depuis prénom/nom/email.
- Bouton **Changer la photo** → sélection fichier → **`POST /uploads/`** avec Bearer → puis **`PATCH`** avec l’URL ; états loading / erreur / succès (toast).

### 4.4 Accessibilité & états

- Labels visibles, messagerie d’erreur sous les champs.
- **Skeleton** au chargement initial **`GET me`** ; désactivation du bouton Enregistrer pendant **`PATCH`** ; conflit **409** improbable — gérer **401** (session expirée).

### 4.5 Thème / langue

- **Thème clair/sombre** : rester aligné sur **`useTheme`** / TopBar (**pas de champ API** requis).
- **Langue UI** : si i18n Next uniquement, **pas d’API**. Une préférence **persistée serveur** nécessiterait un champ **`locale`** — voir backlog.

---

## 5. PROMPT POUR L’AGENT

Tu es un·e développeur·se front senior (**Next.js App Router**, **TypeScript**, **Tailwind**), charte **`BACKOFFICE_NEXTJS.md`**.

### Mission

Refondre la **page Paramètres** du backoffice : remplacer le formulaire minimal et la mention technique Swagger par une **page à sections** (**§4**), en consommant **`GET` / `PATCH /api/users/auth/me/`**, **`POST /api/users/auth/password/change/`**, et **`POST /api/uploads/`** pour la photo (**§1**).

### Contraintes

1. Charger le profil avec **`GET …/auth/me/`** au montage ; préremplir tous les champs exposés (**§2**).  
2. **Sauvegarder** le profil avec **`PATCH`** (une section ou bouton global selon UX, mais champs limités à **§3**).  
3. **Notifications** : les quatre booléens doivent être présents et fonctionnels.  
4. **Mot de passe** : flux dédié avec ancien / nouveau ; erreurs **400** affichées.  
5. Aucune URL d’API brute dans le sous-titre principal.

### Livrables

- Page avec sous-composants (Profil, Notifications, Sécurité).  
- Types TS alignés sur **`UserSerializer`** et **`CurrentUserUpdateSerializer`**.  
- README court : flux upload avatar (deux étapes).

---

## 6. Références code (ce dépôt)

| Sujet | Fichier |
|--------|---------|
| Vue profil | `apps/users/views.py` (`CurrentUserView`) |
| Serializers | `apps/users/serializers.py` (`UserSerializer`, `CurrentUserUpdateSerializer`, `ChangePasswordSerializer`) |
| Changement MDP | `apps/users/views.py` (`ChangePasswordView`) |
| Uploads | `apps/uploads/` (voir Swagger **`POST /uploads/`**) |

---

*Complément de **`BACKOFFICE_NEXTJS.md`** (§ Authentification). Évolutions API optionnelles : **`BACKOFFICE_API_BACKLOG.md**.*
