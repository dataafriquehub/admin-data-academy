# Prompt ultime — Page **Notifications** backoffice (Next.js)

**Usage :** colle ce document (ou la section « PROMPT POUR L’AGENT ») pour **refondre** l’écran Notifications en une **interface admin dense, moderne et riche**, tout en restant **alignée sur le design system** du portail étudiant / `BACKOFFICE_NEXTJS.md` (`primary-*`, `neutral-*`, Poppins, Iconify Solar, thème clair/sombre).

**Prérequis UI :** même **coque** sidebar + TopBar ; ce document ne définit que le **contenu** de `<main>`.

---

## 1. Synthèse backend — contrat API (source de vérité : `swagger.json`)

Préfixe **`/api/notifications/`** (URL complète selon `NEXT_PUBLIC_API_BASE_URL`).

### 1.1 Tous les utilisateurs authentifiés

| Usage | Méthode | Chemin | Query / corps | Réponse indicative |
|--------|---------|--------|---------------|-------------------|
| **Lister mes notifications** | `GET` | `/notifications/` | `is_read` (bool optionnel), `type` (string optionnel — voir **§1.4**) | Tableau **`Notification`** (ordre serveur : **plus récent en premier**, `ordering = -created_at` sur le modèle). |
| **Compteur non lus** | `GET` | `/notifications/unread-count/` | — | `{ "unread_count": number }` — utile pour **badge TopBar** (souvent déjà consommé ailleurs). |
| **Marquer une notification lue** | `PATCH` | `/notifications/{id}/read/` | — | Objet notification mise à jour (**`NotificationSerializer`**). **404** si pas ma notif. |
| **Tout marquer comme lu** | `PATCH` | `/notifications/read-all/` | — | `{ "updated": number }` — nombre de lignes passées en lu. |

### 1.2 Réservé **admin** (`role === "admin"`) **ou** superutilisateur Django

Permission backend **`IsAdminOrSuperuser`** — **pas** les comptes « élargis » type `IsAdminUserCustom` seuls.

| Usage | Méthode | Chemin | Corps | Réponse indicative |
|--------|---------|--------|--------|---------------------|
| **Envoi ciblé in-app (+ emails selon préférences)** | `POST` | `/notifications/send/` | **`SendNotificationSerializer`** — **§2** | **201** : `{ created, email_sent, target_roles, target_user_ids }` — **`created`** = notifications **réellement créées** après filtrage préférences utilisateurs (**§3**). |
| **Prévisualiser destinataires rappel quiz** | `POST` | `/notifications/quiz-deadlines/preview/` | **`SendQuizDeadlineNotificationSerializer`** — **§4** | **200** : `quiz_id`, `target_application_ids`, `recipient_count`, `recipients: [{id, email}]` — **aucune** notification créée. |
| **Envoyer rappel deadline quiz** | `POST` | `/notifications/quiz-deadlines/send/` | Même schéma que preview | **201** : `{ created, email_sent, quiz_id, target_application_ids }`. **404** si `quiz_id` inconnu. |

**Important affichage backoffice :** un **program_creator** ou **mentor** qui voit le menu Notifications a toujours le **`GET` boîte de réception** ; les blocs **envoi ciblé** et **quiz** doivent être **masqués** (ou remplacés par un encart discret) s’il n’est pas admin + le **`POST` renverra 403** de toute façon.

---

## 2. Corps `POST /notifications/send/` (`SendNotificationSerializer`)

Champs **obligatoires** : **`title`**, **`message`**.

| Champ | Type | Détail |
|--------|------|--------|
| `title` | string | max 255 |
| `message` | string | corps texte (affichage + email texte simple côté serveur) |
| `type` | enum | Défaut **`general`**. Valeurs **`Notification.NotificationType`** : `general`, `application`, `program`, `quiz`, `mentorship`, `message`, `payment`, `system`. |
| `priority` | enum | Défaut **`medium`** : `low`, `medium`, `high`. |
| `metadata` | objet JSON | Optionnel, `{}` par défaut — clés utiles pour deep links front (`conversation_id`, `quiz_id`, etc. selon ce que le backend ou d’autres flows écrivent déjà). |
| `roles` | liste de strings | Chaque valeur ∈ **`User.ROLE_CHOICES`** : `student`, `mentor`, `program_creator`, `admin`. Peut être vide si `user_ids` présent. |
| `user_ids` | liste d’entiers | IDs utilisateurs. Peut être vide si `roles` présent. |

**Validation serveur :** au moins **un** des deux : **`roles`** non vide **ou** **`user_ids`** non vide — sinon **400**.

**Destinataires calculés :** union des utilisateurs matchant les **rôles** + utilisateurs dont les **id** sont listés → **`distinct`**, puis **`filter_recipients_for_notification`** (**§3**) avant création en base.

---

## 3. Filtrage métier (préférences utilisateur) — à expliquer dans l’UI admin

Fichier **`apps/notifications/utils.py`** : avant création (et pour les emails), le backend **exclut** certains utilisateurs selon **`type`**, **`priority`**, **`metadata`** et les champs profil **`notify_email_*` / `notify_push_important_updates`**.

Conséquences pour l’UI :

- Après **`POST /send/`**, **`created`** peut être **&lt;** nombre d’utilisateurs « ciblés » nominalement (rôles ∪ IDs).
- Afficher un **résumé** post-envoi du type : *« X notifications créées, Y e-mails partis »* (`email_sent`) et, si possible, encart **aide** : *« Certains comptes peuvent être exclus selon leurs préférences de notification. »*

Types **toujours acceptés** côté `user_accepts_notification` pour la majorité des cas non filtrés sur toggles : par ex. **`message`**, **`payment`** (voir code pour le détail exact).

---

## 4. Rappels quiz (`quiz-deadlines/*`)

**Serializer `SendQuizDeadlineNotificationSerializer` :**

| Champ | Obligatoire | Description |
|--------|-------------|-------------|
| `quiz_id` | oui | ID du **`Quiz`** (`apps/assessments`) |
| `application_ids` | non | Si fourni : restreindre aux **candidatures** approuvées dont l’ID est dans la liste. |
| `due_at` | non | Date/heure affichée dans le message par défaut si pas de `message` custom. |
| `title` | non | Surcharge du titre ; défaut serveur du type *Rappel quiz: …* |
| `message` | non | Surcharge du corps ; défaut serveur. |

Cible métier : étudiants avec **candidature `approved`** sur un programme qui **contient le module** du quiz (`program__programmodule__module_id=quiz.module_id`).

**Preview** : `POST .../preview/` — permet d’afficher **`recipient_count`** et liste **`recipients`** avant d’envoyer (bonne pratique UX).

**Sélection d’un `quiz_id` côté front :** pas de route « liste globale des quiz » dédiée ; récupérer les modules autorisés (**ex.** `GET /programs/modules/`) et **aplatir** les **`quizzes`** imbriqués (id + titre + module) pour un **combobox** searchable — tel que documenté dans **`swagger.json`** pour les sérialiseurs module.

---

## 5. Modèle exposé au client (liste / détail)

Champs **`NotificationSerializer`** :  
`id`, `title`, `message`, `type`, `priority`, `metadata`, `is_read`, `read_at`, `created_at`.

Utiliser **`metadata`** pour actions contextuelles (ex. ouvrir la messagerie si `conversation_id` présent — aligné avec les notifs **`message`** existantes).

---

## 6. Spécification design — page « pro » alignée produit existant

Objectif : quitter l’aspect **formulaire brut + liste plate**. Livrer une **vraie console notifications** : hiérarchie visuelle, hiérarchie d’information, états riches, **sans** inventer une nouvelle palette.

### 6.1 Structure générale (`<main>`)

1. **En-tête de page** (comme Dashboard / Utilisateurs)  
   - Titre **Notifications** (ou **Centre de notifications** si vous unifiez le naming).  
   - Sous-titre court orienté métier (*« Messages système, alertes et campagnes ciblées »* — à ajuster).  
   - **Pill** compteur **non lus** (depuis liste filtrée ou dernier `GET unread-count` si vous évitez un double calcul).  
   - Bouton primaire **« Tout marquer comme lu »** (`PATCH read-all/`) — désactivé si 0 non lu ; **confirm** optionnelle si le produit le souhaite.

2. **Layout en onglets ou sections** (responsive)  
   - **Onglet / zone A — Boîte de réception** (tous les rôles staff autorisés à l’écran).  
   - **Onglet / zone B — Diffusion** (visible **uniquement** si `GET …/auth/me/` → admin ou superuser) : sous-onglets internes **« Message ciblé »** et **« Rappels quiz »** *ou* deux cartes empilées bien séparées.

### 6.2 Zone boîte de réception (riche)

- **Barre d’outils** au-dessus de la liste :  
  - **Segments** : Tous | Non lues | Lues — mappez sur **`GET …/?is_read=true|false`** (ou filtre client si vous chargez tout — pour grosses volumétries, préférer requêtes filtrées).  
  - **Filtre type** : liste déroulante des **`NotificationType`** (**§1.1** / **§2**).  
  - **Tri** : par défaut déjà **chrono inverse** côté API ; si filtre client, respecter le même ordre.

- **Liste** : cartes (pas tableau HTML triste) avec :  
  - **Barre verticale** ou fond légèrement teinté pour **non lu** vs lu (`bg-primary-5` / `neutral-2` par ex.).  
  - **Icône** contextualisée par `type` (Solar : message → chat, quiz → document, mentorship → calendar, etc.).  
  - **Titre** + extrait **message** (2 lignes max, ellipsis).  
  - **Badges** : `priority` (high = accent visible, low = discret), `type` en petit tag `neutral-4`.  
  - **Temps** : relatif (*il y a 2 h*) + **tooltip** datetime ISO complet.  
  - **`metadata`** : zone **repliable** « Détails techniques » (JSON pretty) pour staff — ne pas polluer la ligne principale.  
  - **Actions** : **Marquer lu** (`PATCH …/{id}/read/`) si non lu ; clic sur carte optionnel → marquer lu + expand.

- **États** : skeletons en chargement, empty state illustratif (*« Aucune notification »* / *« Filtre trop strict »*), erreur avec **retry**.

- **Pagination** : l’API renvoie **tout** en une fois aujourd’hui — si liste longue, **virtualisation** ou **charge progressive** côté client après fetch (note technique README).

### 6.3 Zone envoi ciblé (admin uniquement)

- **Carte** avec titre **Diffusion ciblée** et texte d’aide sur **préférences** (**§3**).

- **Cible** :  
  - **Multi-sélection par rôle** : 4 cases ou toggles clairs (`student`, `mentor`, `program_creator`, `admin`).  
  - **Utilisateurs précis** : composant **chips** alimenté par recherche sur **`GET /users/auth/users/`** (emails / noms) avec ajout **`user_ids`** — ou saisie **IDs** avec validation (accessibilité : au moins une méthode « humaine »).  
  - Indicateur **« X utilisateurs concernés »** *nominal* (union roles + ids avant envoi) — le **retour serveur** reste la vérité pour **`created`**.

- **Contenu** :  
  - Champs **titre** et **message** avec **labels flottants** ou style équivalent au reste du backoffice.  
  - **`type`** et **`priority`** : **Select** stylés (pas `<select>` OS nu non stylé).  
  - **`metadata`** : **JSON** dans un éditeur repliable avec validation syntaxique avant submit ; placeholder d’exemple (`{"campaign":"spring_2026"}`).

- **Envoi** : bouton **Envoyer** plein largeur ou aligné à droite ; **loading** + toast succès avec **`created`** et **`email_sent`** ; afficher **400** avec détail champs (Django).

### 6.4 Zone rappels quiz (admin uniquement)

- **Workflow en 2 étapes** recommandé :  
  1. Choisir **quiz** (recherche dans liste dérivée des **modules** — **§4**).  
  2. Optionnel : `due_at` (datetime), `application_ids`, surcharge `title` / `message`.  
  3. Bouton **Prévisualiser** → `POST .../preview/` → afficher **`recipient_count`** + liste courte (emails masquables RGPD si besoin) ou au minimum le **nombre**.  
  4. Bouton **Envoyer le rappel** → `POST .../send/`.

- Même style carte / en-tête que la zone diffusion pour **cohérence visuelle**.

### 6.5 Cohérence avec le reste du backoffice

- Réutiliser **même typographie**, **espacements**, **arrondis `rounded-2xl`**, **ombres légères**, **boutons primaires** que Dashboard / Communauté.  
- Pas de sous-titre avec **URL brute** d’API en production.  
- **i18n** : clés dédiées `notifications.*` ou équivalent, FR + EN si le projet est bilingue.

---

## 7. Pièges & erreurs fréquentes

| Piège | Correction |
|--------|------------|
| **403** sur `POST /send/` | Utilisateur non **admin** Django `role` / non superuser — masquer l’UI ou message explicite. |
| **`created` = 0** avec cibles pourtant choisies | Préférences (**§3**) — ne pas traiter comme bug sans vérifier `type` / `priority`. |
| Confondre **`GET /notifications/unread-count/`** (global) et filtre liste | Les deux peuvent coexister ; badge header page peut utiliser le compteur filtré « non lus » si vous filtrez côté client. |
| **`read-all`** irréversible côté UX | Pas d’undo API — confirmation légère si produit sensible. |

---

## 8. Références code backend (ce dépôt)

| Sujet | Fichier |
|--------|---------|
| Vues | `apps/notifications/views.py` |
| Serializers | `apps/notifications/serializers.py` |
| Modèle + enums `type` / `priority` | `apps/notifications/models.py` |
| Filtrage destinataires / email | `apps/notifications/utils.py` |
| Permission envoi | `apps/notifications/permissions.py` (`IsAdminOrSuperuser`) |
| Routes | `apps/notifications/urls.py` |

---

## PROMPT POUR L’AGENT

Tu es un·e développeur·se front senior (**Next.js App Router**, **TypeScript**, **Tailwind**, alignement **`BACKOFFICE_NEXTJS.md`**).

### Mission

Refondre la **page Notifications** du backoffice pour une **UI moderne, dense et cohérente** avec le reste de l’app (Dashboard, Utilisateurs, Communauté), en consommant **uniquement** les endpoints documentés dans **`swagger.json`** (groupe Notifications + Users pour le picklist) et le comportement décrit dans les **sections 1–5** du présent fichier `Backoffice_notifications.md`.

### Exigences fonctionnelles

1. **Boîte de réception** : `GET /notifications/` avec filtres **`is_read`** et **`type`** ; `PATCH` unitaire et **`PATCH …/read-all/`** ; affichage riche (**§6.2**).  
2. **Badge / compteur** : possible via `GET /notifications/unread-count/` ou dérivé de la liste.  
3. **Diffusion** : réservée **admin** ; `POST /notifications/send/` avec **rôles**, **user_ids**, **type**, **priority**, **metadata** ; afficher la réponse **`created`** / **`email_sent`** et l’aide **préférences** (**§3**).  
4. **Quiz** : workflow **preview** puis **send** (**§4**, **§6.4**) ; résolution des **`quiz_id`** via modules (`GET /programs/modules/` ou équivalent Swagger).

### Exigences UI / design

- **Pas** de formulaire minimal « deux champs + bouton » sur toute la largeur sans structure.  
- Cartes, segments, badges, icônes **Solar** via **Iconify**, **tokens** `primary` / `neutral` uniquement.  
- États : **loading skeleton**, **vide**, **erreur** avec retry.  
- **Accessibilité** : focus, labels, contrastes badges.

### Interdits

- Ne pas inventer d’endpoints (`POST` suppression globale, `PATCH` notification admin d’autrui, etc.).  
- Ne pas afficher des chemins API en dur dans le titre de page pour les utilisateurs finaux.

### Livrables

- Page + composants découplés (Inbox, Composer ciblé, Wizard quiz, filtres).  
- Types TS alignés sur **`NotificationSerializer`** + **`SendNotificationSerializer`**.  
- README court : variables d’env, qui voit quelle section (matrice rôle).

Commence par un **inventaire** des props / données actuelles vs ce contrat, puis implémente **section par section** (inbox d’abord, puis admin).

---

*Complément de **`BACKOFFICE_NEXTJS.md`** et des docs écran par écran (`Backoffice_dashboard.md`, `Backoffice_users.md`, `message_backoffice.md`).*
