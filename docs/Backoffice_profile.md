# Prompt — Page **Profil** backoffice (Next.js)

**Usage :** colle ce document lorsque la sidebar expose une entrée **Profil** (route dédiée, ex. `/settings/profile`) **en plus** de la page **Paramètres** déjà livrée — la page **Profil** sert de **carte d’identité** et de **hub** vers l’édition détaillée.

**Prérequis UI :** même coque globale que **`BACKOFFICE_NEXTJS.md`** (Sidebar, TopBar, tokens, typo, thème).

**Relation avec Paramètres :** le formulaire complet (prénom, nom, pays, téléphone, avatar, 4 notifications, mot de passe) reste documenté dans **`Backoffice_settings.md`**. Ici on ne redéfinit **pas** ces formulaires — on décrit uniquement l’écran **résumé Profil**.

**Pas de nouvelle API obligatoire :** tout repose sur **`GET /users/auth/me/`** (et les mêmes endpoints que les paramètres si vous autorisez une micro-édition sur cette page — optionnel).

---

## 1. Contrat API — lecture

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/users/auth/me/` | Profil complet (**`UserSerializer`**). |

Les champs utiles pour la carte identité sont les mêmes que dans **`Backoffice_settings.md` §2** : notamment `profile_picture_url`, `first_name`, `last_name`, `email`, `role`.

Pour **modifier** le profil, notifications ou mot de passe, réutiliser **`PATCH /users/auth/me/`**, **`POST /users/auth/password/change/`**, **`POST /uploads/`** — voir **`Backoffice_settings.md` §1–3**.

---

## 2. Spec design — page « Profil »

### 2.1 Objectif

Éviter l’écran **vide** (placeholder bleu, peu d’infos) : afficher les **vraies données** de **`GET …/auth/me/`**.

### 2.2 Contenu minimal

1. **Avatar** — cercle avec **`profile_picture_url`** si présent, sinon **initiales** dérivées de `first_name` / `last_name` / `email` (tokens `neutral-*`, pas un pictogramme générique figé).
2. **Identité** — nom affiché (`first_name` + `last_name`), **email** en sous-texte.
3. **Rôle** — badge ou ligne discrète avec libellé FR (ex. Administrateur, selon `role`).

### 2.3 Actions & navigation

Sans dupliquer tout le formulaire Paramètres :

- Bouton primaire **« Modifier mes informations »** → route vers la page **Paramètres** (ex. `/parametres` ou `/settings`) — éventuellement ancre **`#profil`** si votre layout le supporte.
- Liens secondaires : **« Mot de passe et sécurité »**, **« Notifications »** → même destination avec ancres ou sous-routes alignées sur **`Backoffice_settings.md` §4**.

### 2.4 Remplir l’espace (optionnel)

- Colonne ou carte **aperçu** : ligne du type « Notifications : préférences actives » (résumé basé sur les quatre booléens `notify_*`) + lien **« Gérer »** vers Paramètres.
- Éviter la redondance confuse : si le menu ne doit avoir **qu’une** entrée, retirer **Profil** du menu et tout centraliser sous **Paramètres** ; sinon garder **Profil** = résumé + **Paramètres** = édition complète.

### 2.5 États

- **Skeleton** pendant **`GET me`** ; gestion **401** (session expirée).
- Pas d’URL d’API brute dans le titre ou le sous-titre utilisateur.

---

## 3. PROMPT POUR L’AGENT

Tu es un·e développeur·se front senior (**Next.js App Router**, **TypeScript**, **Tailwind**), charte **`BACKOFFICE_NEXTJS.md`**.

### Mission

Implémenter ou peaufiner la **page Profil** (route dédiée) : **carte d’identité** alimentée par **`GET /api/users/auth/me/`**, avec **navigation claire** vers la page **Paramètres** déjà conforme à **`Backoffice_settings.md`**.

### Contraintes

1. Pas de placeholders statiques à la place de la photo si **`profile_picture_url`** est disponible.  
2. Libellés **role** cohérents avec le reste du backoffice (FR).  
3. Les formulaires d’édition complète restent sur **Paramètres** sauf décision produit explicite de tout fusionner sur une seule URL.

### Livrables

- Composants dédiés (ex. `ProfileHero`, `ProfileQuickLinks`) si utile.  
- Types TS alignés sur **`UserSerializer`** pour les champs affichés.

---

## 4. Références

| Sujet | Fichier |
|--------|---------|
| Formulaires complets (PATCH, notif, MDP, avatar) | **`Backoffice_settings.md`** |
| Charte shell backoffice | **`BACKOFFICE_NEXTJS.md`** |
| Vue profil API | `apps/users/views.py` (`CurrentUserView`) |

---

*Complément de **`BACKOFFICE_NEXTJS.md`**. Évolutions API optionnelles : **`BACKOFFICE_API_BACKLOG.md`**.*
