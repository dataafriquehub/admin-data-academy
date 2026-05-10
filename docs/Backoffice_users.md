# Prompt ultime — Page « Utilisateurs » backoffice (Next.js)

**Usage :** colle ce document (ou la section « PROMPT POUR L’AGENT ») dans Cursor / un ticket pour refondre **uniquement l’écran Utilisateurs** du backoffice Data Academy.

**Prérequis backend actuels :** liste `GET /api/users/auth/users/` ; détail + changement de rôle `GET/PATCH /api/users/auth/users/{id}/` (Swagger *Utilisateurs*). Pas de `DELETE` liste utilisateurs par API publique.

**Prérequis UI :** même coque **sidebar + TopBar + thème** que le port étudiant (non négociable, voir **`BACKOFFICE_NEXTJS.md`**).

---

## Synthèse backend — ce qui est **possible aujourd’hui** sans nouvelle API

| Action | Méthode | Endpoint / note |
|--------|---------|----------------|
| Liste tous les utilisateurs | `GET` | `/users/auth/users/` — **`IsAdminUserCustom`** ; ordre **`date_joined` décroissant** côté serveur ; **pas de pagination Django REST par défaut** (réponse tableau complet). |
| Détail un utilisateur | `GET` | `/users/auth/users/{id}/` — même sérialiseur que la liste (`UserSerializer`). |
| Modifier le **rôle** d’un utilisateur | `PATCH` | `/users/auth/users/{id}/` — corps JSON **`{"role":"student"\|"mentor"\|"program_creator"\|"admin"}`** ; réponse **`UserSerializer`** complète. Refus si retrait du dernier rôle admin ; refus pour un compte **`is_superuser`** si l’appelant n’est pas superuser Django. |
| Champs disponibles dans chaque ligne / détail | — | Sérialiseur métier **`UserSerializer`** : `id`, `email`, `username`, `first_name`, `last_name`, `role`, `profile_picture`, `profile_picture_url`, `country`, `phone_number`, et les quatre booléens de préférences de notification (`notify_email_*`, `notify_push_*`). **`date_joined`**, **`last_login`**, **`is_active`**, **`is_staff`** **ne sont pas** exposés par ce sérialiseur. |
| Ouvrir / filtrer candidatures d’un utilisateur | `GET` | `/admissions/applications/?student=<id>` (+ éventuellement `search=` selon Swagger) — utile lien « dossiers » depuis une ligne utilisateur (**rôle admin / mentor selon périmètres existants**). |
| Conversation directe (admin) | `POST` | `/messaging/conversations/direct/` — corps typique **`{ "recipient_id": <id> }`** — règles métier côté API (admin ↔ apprenants, autres admins / concepteurs / mentors selon `DirectConversationCreateView`). |
| Envoyer notification ciblée | `POST` | `/notifications/send/` — corps **`user_ids`** et/ou **`roles`** (voir **`SendNotificationSerializer`**) ; permission **`IsAdminOrSuperuser`** (**`role === "admin"`** ou superuser Django) — **plus stricte** que la liste utilisateurs pour certains comptes « élargis ». |
| Déclencher email reset mot de passe | `POST` | `/users/auth/password/reset/` — **`AllowAny`** ; envoie l’email lié au compte. Utilisable depuis le backoffice comme action « aide utilisateur », **avec confirmation forte** dans l’UI (ne pas spammer ; ne pas exposer le lien renvoyé par l’API en prod si sensible — voir comportement Swagger). |

**Ce qui n’existe pas encore en REST backoffice** :

| Besoin métier habituel | Statut backend |
|------------------------|----------------|
| **Activer / désactiver** compte (`is_active`) | Non exposé (`PATCH` métier ne modifie pas `is_active` pour l’instant) |
| Supprimer utilisateur | Absent |
| Création compte réservée admin (`POST` sans inscription publique) | Absent |
| Pagination / recherche serveur liste utilisateurs | Non configurées sur `UserListView` (**filtrage côté client** ou évolution backend) |

**Note :** **`PATCH /users/auth/me/`** continue de servir le **profil connecté** (sans `role`) via `CurrentUserUpdateSerializer` ; le changement de rôle **d’un autre** utilisateur passe par **`PATCH …/auth/users/{id}/`**.

---

## Recommandations backend (suite)

1. **`UserAdminSerializer`** (liste + détail) : ajouter en **lecture** `date_joined`, `last_login`, `is_active` pour un tableau admin plus riche.
2. **`UserListView`** : `Pagination` (+ `ordering`, `search`, filtre `?role=`).
3. **`PATCH`** complémentaire : **`is_active`** (avec les mêmes garde-fous métier « dernier admin actif », etc.).
4. **Aligner les permissions** : `IsAdminUserCustom` vs `IsAdminOrSuperuser`.

---

## PROMPT POUR L’AGENT

Tu es un développeur front senior (Next.js App Router, TypeScript, Tailwind v4 aligné projet). Ta mission : **refondre entièrement la page « Utilisateurs »** du backoffice : finir l’aspect « tableau de démo » avec sous-titre qui affiche une URL brute, et livrer une **vue admin moderne, dense et actionnable**, **sans nouvelle DA** hors design system **`BACKOFFICE_NEXTJS.md`**.

### 1. Données & auth

- **Source unique liste :**  
  `GET /users/auth/users/`  
  **`Authorization: Bearer <access_token>`**
- Si **403** ou **401** : message clair, pas de tableau vide trompeur.
- Réponse typée (ajuster aux champs Swagger réels) :

```ts
type Role = 'student' | 'mentor' | 'program_creator' | 'admin';

interface AdminUserRow {
  id: number;
  email: string;
  username: string | null;
  first_name: string;
  last_name: string;
  role: Role;
  profile_picture: string | null;
  profile_picture_url: string | null;
  country: string | null;
  phone_number: string | null;
  notify_email_modules: boolean;
  notify_email_quiz_deadlines: boolean;
  notify_email_live_sessions: boolean;
  notify_push_important_updates: boolean;
}
```

- **Détail ligne :** **`GET /users/auth/users/{id}/`** après clic (ou données cache liste si même payload) pour un **drawer** / fiche utilisateur fraîche.  
- **Changement de rôle :** après choix dans un sélecteur (ou dialogue), **`PATCH`** avec **`{"role": "…"}`** ; afficher les erreurs **400** Django (ex. dernier admin) dans le même style que vos autres formulaires.

### 2. Principes UX & visuels (« designer »)

Le produit doit ressembler au **dashboard** déjà livré : cartes lisibles, ombres légères, arrondis cohérents, **`bg-neutral-*`**, typo **Poppins**, icônes **Solar / Iconify** comme le portail étudiant.

Implemente au minimum :

1. **Barre page** sous le TopBar (dans `<main>`)  
   - Titre « **Utilisateurs** » avec **badge ou pill** résumé (ex. nombre total après chargement).  
   - **Sous-titre métier** du type « *Gestion des comptes et préférences — accès réservé admin* » (**ne plus** afficher l’endpoint brut dans l’interface ; éventuellement lien « Documentation API » réservé dev en mode debug seulement).  
   - Côté droit : **zone d’outil** avec  
     - Champ **recherche** (filtre client sur nom, prénom, email, username, pays si présents),  
     - **Filtres chips / multi-select** par **rôle** (tous les rôles présents dans `Role`),  
     - **bouton télécharger CSV** ou **Exporter** *(export depuis les lignes déjà chargées)* — facultatif mais valeur « admin » forte.  

2. **Résumé KPI (option mais recommandée)** une rangée compacte au-dessus du tableau calculée **sur la liste mémoire** : total utilisateurs ; répartition par rôle en petites **donut badges** ou pills numériques (`student`, `program_creator`, `mentor`, `admin`). Pas d’endpoint dédié requis pour cette rangée tant que tout vient du même GET.

3. **Table moderne desktop**  
   Colonnes conseillées (réordonnage possible si surcharge) :
   - **Utilisateur :** avatar (image `profile_picture_url` sinon initiales depuis prénom/nom/email), ligne 1 nom complet (`trim` des parties vides sinon email), ligne 2 email en `text-sm` **`neutral-*`**.  
   - **Rôle :** badge coloré (même palette thème ; libellés FR : Apprenant, Mentor, Créateur de programme, Admin) — **avec action « Modifier le rôle »** qui appelle **`PATCH`** (select + confirmation si passage vers hors-admin).  
   - **Coordonnées :** téléphone (`—` si vide), pays.  
   - **Notifications (résumé) :** 4 indicateurs minimalistes (**icône + tooltip** ou picto email/push avec état ON/OFF) pour les quatre booléens — évite quatre colonnes de texte brut.  
   - **Actions :** colonne **`…` menu contextuel** (ou boutons ion secondaires compact).  

4. **Comportements interactifs obligatoires**  
   - **Tri** alphabétique ou par email / rôle (client).  
   - **Hover ligne** léger sans casser WCAG contrast.  
   - **Responsive** : &lt; `md`, transforme en **liste de cartes** (pas de tableau horizontal forcé cassé).

5. **Menu actions par ligne** — **toujours** respecter Swagger / cas 403 :  
   - **« Messages » / « Converser »** : `POST /messaging/conversations/direct/` avec `recipient_id` ; après succès, **navigation** vers l’UI messagerie existante avec la conversation (ou comportement projet existant pour ouvrir le fil). Si **403** API : toast explicite (« politique messaging pour ce couple de rôles »).  
   - **« Candidatures »** : lien navigateur vers la route backoffice liste candidatures avec **query `student=`** égale **`id`** (aligner avec la route Router Next utilisée dans le projet, équivalent filtres Swagger). Masquer ou griser selon périmètre du compte admin connecté si la page n’est pas disponible pour ce staff.  
   - **« Notifier cet utilisateur »** : ouvre **dialog** titre + corps + prévisualisation puis `POST /notifications/send/` avec **`user_ids: [id]`** + type/priority/métadonnées par défaut raisonnables (éditables avant envoi). **Afficher cette action uniquement** si tu peux garantir **`role === "admin"`** ou superuser depuis `GET …/auth/me/` (aligné **`IsAdminOrSuperuser`**), sinon désactiver + tooltip (« réservé super admin »).  
   - **« Copier l’email »** : feedback « copié ».  
   - **« Réinitialisation mot de passe (email) »** : après double confirmation (« Un email sera envoyé à … »), `POST /users/auth/password/reset/` avec **`{ email }`**. UX prudente (rate-limit visuel ou cooldown).  

6. **Statut « désactivé / actif », date d’inscription** : tant que ces champs ne sont pas dans la réponse API, **afficher soit `—`** soit courte mention « données non disponibles » dans le drawer — **sans appeler Django Admin ni inventer des champs**.

7. **Ne pas faire**  
   - Pas de « Supprimer utilisateur », création **`POST`** dédiée, ni **impersonification** tant que non documentés Swagger (**boutons désactivés + tooltip roadmap** acceptable).  
   - Ne pas afficher une URL brute d’endpoint en sous-titre de page en prod (réserver à un mode dev éventuel).  

### 3. États système & qualité

- **Loading skeleton** grille + pulsation neutre.  
- **Erreur chargement liste** carte avec retry.  
- **Liste très longue** : si aucune pagination backend, implémenter au minimum **pagination / virtualisation purement client** après fetch (pour ne pas planter le DOM avec des milliers de lignes futurs). Mentionner limitation dans README si volumétrie > ~500 lignes jusque mise à niveau backend.  
- **Accessibilité** : focus traps sur modales, labels sur icônes, contrastes badges.  

### 4. Definition of done

La page Utilisateurs est **terminée** quand :

- Plus d’aspect « tableau SQL » ni de sous-titre technique visible en prod pour les admins.  
- Recherche + filtres rôle et tri fonctionnels côté client.  
- Actions **Messages**, **Notifier** (conditionnel), **Candidatures**, **Copier email**, **Reset mot de passe**, et **modification de rôle** via **`PATCH`** avec retour **`UserSerializer`** et gestion d’erreurs API.  
- Layout **toujours** dans la coque commune backoffice (**`BACKOFFICE_NEXTJS.md`**).  
- Aucune requête vers des endpoints **fantômes** (hors ceux listés Swagger).

---

## Références rapides (dépôt backend)

| Ressource | Emplacement indicatif |
|-----------|-----------------------|
| Liste + détail + PATCH rôle | `apps/users/views.py` (`UserListView`, `UserDetailAdminView`) |
| serializer liste / réponse | `apps/users/serializers.py` (`UserSerializer`, `AdminUserRoleUpdateSerializer`) |
| Conv. directe | `apps/messaging/views.py` (`DirectConversationCreateView`) |
| Envoi notifications | `apps/notifications/views.py` (`NotificationSendView`) |
| Forgot password | `apps/users/views.py` (`ForgotPasswordView`) |
| Permissions admin liste | `apps/users/permissions.py` (`IsAdminUserCustom`) |
| Notifications send perm | `apps/notifications/permissions.py` (`IsAdminOrSuperuser`) |

Swagger / Postman depuis la racine : `swagger.json`, `postman_full_collection.json`.
