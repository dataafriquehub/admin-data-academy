# Prompt — Page **Connexion** backoffice (Next.js)

**Usage :** colle ce document pour implémenter ou refondre l’écran **Connexion** du backoffice (route publique, hors shell Sidebar/TopBar — voir **`BACKOFFICE_NEXTJS.md`** § exception ci‑dessous).

**Inspiration layout :** reprendre la **structure visuelle** de la référence type « split screen » (fond en deux registres, carte centrée, utilitaires au‑dessus de la carte, pied de page marque) comme sur une landing moderne — **sans** reprendre la palette orange d’exemple : utiliser **exclusivement** les jetons **`primary-*`**, **`secondary-*`**, **`neutral-*`** du design system Data Academy (copiés depuis le portail étudiant, **`BACKOFFICE_NEXTJS.md`**).

**Pas de nouvelle API obligatoire :** la connexion utilise **`POST /users/login/`** (corps JSON email + mot de passe). Mot de passe oublié : flux existants **`/users/auth/password/reset/`** (voir Swagger).

---

## 0. Rapport avec la charte globale backoffice

| Règle habituelle | Page Connexion |
|------------------|----------------|
| Même **coque** Sidebar + TopBar que l’étudiant | **Non** — cette page est **full viewport**, sans sidebar ni topbar (écran d’accès). |
| Même palette **`primary-*` / `neutral-*`** | **Oui** — bouton principal, liens d’action, surfaces. |
| **Poppins** + **Iconify Solar** | **Oui**. |
| Toggle thème clair/sombre | **Oui** — même logique **`useTheme`** (classe sur `<html>`), mais le contrôle peut être **sur la page de login** (voir §3.3). |

Après authentification réussie, l’utilisateur entre dans la **coque backoffice** documentée dans **`BACKOFFICE_NEXTJS.md`**.

---

## 1. Contrat API

### 1.1 Connexion

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `POST` | `/users/login/` | Corps **`{ "email": "…", "password": "…" }`**. |

**Réponses typiques :**

| Code | Corps | Action UI |
|------|--------|-----------|
| **200** | **`access`**, **`refresh`**, **`user`** (`UserSerializer`) | Persister les tokens (cookies httpOnly ou stockage adopté par le projet), puis route métier (dashboard). |
| **401** | Ex. **`{ "error": "Identifiants invalides" }`** | Message d’erreur accessible sous le formulaire ou en toast ; ne pas vider le champ email sans intention UX. |

Implémentation backend : `CustomLoginView` (`apps/users/views.py`) — authentification par **email** + mot de passe.

### 1.2 Après login — contrôle d’accès backoffice

La réponse **`user`** contient au minimum **`role`** (cf. **`BACKOFFICE_NEXTJS.md`** § matrice rôle → périmètre).

- Si le compte **n’a pas** accès au backoffice (ex. étudiant seul selon produit), afficher un message clair (**« Ce compte n’a pas accès à l’administration »** ou équivalent), **ne pas** installer la session comme une session staff valide (logout / purge tokens), proposer un lien vers le portail si disponible.
- Si le compte est autorisé, redirection vers la **route d’accueil backoffice** (souvent dashboard).

*(Ajustement métier côté front uniquement — pas d’endpoint dédié requis pour une V1.)*

### 1.3 Mot de passe oublié (lien secondaire)

| Méthode | Chemin | Notes |
|---------|--------|------|
| `POST` | `/users/auth/password/reset/` | Flux « forgot password » — aligner les libellés et l’URL de retour avec le portail si le même backend sert les deux ; sinon page dédiée minimaliste qui posterait ce formulaire. |

Détails des champs : **Swagger** / **`postman_full_collection.json`**.

---

## 2. Spec design — inspirée du split layout (référence image 2)

### 2.1 Structure de page (viewport complet)

1. **Arrière-plan en deux zones** (transition lisible, moderne) :
   - **Zone supérieure (~45–55 % hauteur)** : fond **clair** en thème clair (`neutral-*` très clair / blanc cassé) ; en thème sombre, adapter avec **`neutral-*`** profonds pour garder le **contraste** entre les deux registres (pas deux aplats identiques).
   - **Zone inférieure** : fond **plus sombre** (`neutral-9` / équivalent dark). Optionnel : **motif discret** (grille ou points à **faible opacité**, couleur **`primary-*` ou `neutral-*`) pour éviter le plat cheap — rester subtil (cf. référence grille fine).

2. **Séparation** : ligne d’horizon **légèrement courbe** ou **dégradé doux** entre les deux zones (SVG ou CSS `clip-path` / `border-radius` sur un bloc pleine largeur) pour rapprocher l’esthétique « landing » sans surcharge.

3. **Carte de connexion** : rectangle centré (horizontal + vertical), **largeur max** ~420–480 px, **`rounded-2xl`**, **ombre portée** légère (`shadow-lg` équivalent), fond **carte** = surface **neutre élevée** (mode clair : blanc / `neutral-1` ; mode sombre : carte plus claire que la zone basse pour le relief).

4. **Superposition** : la carte **chevauche** la jonction des deux zones (comme la référence), pour ancrer visuellement le formulaire.

### 2.2 En-tête de la carte

- **Titre** : **« Se connecter »** (ou **« Connexion backoffice »** si vous préférez renforcer le contexte — un seul titre principal).
- **Sous-titre** : phrase courte institutionnelle, ex. **« Accès réservé à l’équipe Data Academy »** — **pas** de sous-titre technique du type « PATCH /api/… ».

### 2.3 Champs formulaire

| Champ | Comportement |
|--------|----------------|
| **Email** | Label **« Adresse email »** ; `type="email"` ; `autocomplete="email"` ; placeholder du type **`vous@organisation.org`** (neutre). |
| **Mot de passe** | Label **« Mot de passe »** ; `autocomplete="current-password"` ; **icône œil** (Solar) à droite pour **afficher / masquer** le texte (`type` dynamique text/password). |

Espacements généreux entre labels et champs ; bordures **`neutral-*`** ; état focus **anneau `primary-*`** cohérent avec le portail.

### 2.4 Bouton principal

- Libellé **« Se connecter »**.
- **Pleine largeur** dans la carte.
- Fond **`primary-5`** (ou jeton **primaire** défini dans votre **`@theme`** pour le CTA) ; texte **`primary-1`** ou blanc selon contraste du thème.
- États **loading** : spinner ou libellé **« Connexion… »** + **disabled** sur les champs pendant la requête.

Ne pas utiliser une couleur d’accent « orange » tierce : tout le **bleu / primaire** institutionnel passe par **`primary-*`**.

### 2.5 Lien sous le bouton

- **Pas** de « Créer un compte » sur le backoffice équipe (inscription publique hors périmètre sauf décision produit).
- À la place : lien texte **« Mot de passe oublié ? »** (`primary-5` ou style lien discret) vers la page ou modal de reset alignée sur **§1.3**.

### 2.6 Utilitaires au-dessus de la carte (centrés)

Petits contrôles **pill** ou **boutons carrés arrondis**, comme la référence :

1. **Langue** : si i18n FR/EN est déjà utilisée ailleurs — sélecteur **FR | EN** (globe + code langue).
2. **Thème** : bouton **lune / soleil** branché sur le **même `useTheme`** que le reste du produit pour que le choix survive après login.

Ordre suggéré : **[ Langue ] [ Thème ]** — espacement **`gap-2`**, au-dessus de la carte, **centrés horizontalement**.

### 2.7 Pied de page (sous la carte, zone basse sombre)

Centré dans la partie inférieure de l’écran :

- **Logo** Data Academy (même asset que la sidebar — ex. `academy-logo.svg`) + texte **DATA ACADEMY** / **ADMIN** selon votre nomenclature backoffice.
- **Baseline** courte en une ou deux lignes, ex. **« Formation et pilotage des parcours — espace équipe »** (adapter au wording marketing).

Texte en **`neutral-2`** ou blanc selon contraste sur le fond sombre ; éviter le gris illisible.

### 2.8 États d’erreur & accessibilité

- Message **401** / erreur réseau : bloc sous le bouton ou **`role="alert"`**.
- Touch targets ≥ 44 px pour langue, thème, œil mot de passe.
- Contraste WCAG sur tous les textes sur fond clair et fond sombre.

### 2.9 Responsive

- Sur **mobile** : carte **presque pleine largeur** avec marges latérales ; les deux zones de fond restent identifiables ; utilitaires langue/thème au-dessus ou dans un coin selon place disponible.

---

## 3. PROMPT POUR L’AGENT

Tu es un·e développeur·se front senior (**Next.js App Router**, **TypeScript**, **Tailwind**).

### Mission

Implémenter la **page Connexion backoffice** selon **§2**, avec **`POST /api/users/login/`** (**§1**), persistance des JWT et redirection ; alignement strict sur les **couleurs `primary-*` / `neutral-*`** du projet (**pas** de palette type « orange OwoDesk »).

### Contraintes

1. Page **sans** `Layout` sidebar/topbar — uniquement le contenu décrit.  
2. Bouton CTA et liens d’action en **`primary-*`**.  
3. Gestion **401** et **rôle** non autorisé (**§1.2**).  
4. Lien **mot de passe oublié** branché sur le flux existant (**§1.3**).  
5. Toggle **thème** et **langue** si le projet les supporte déjà.

### Livrables

- Composants dédiés (ex. `LoginSplitBackground`, `LoginCard`, `PasswordField`) si utile.  
- Types pour la réponse login alignés sur **`LoginResponse`** / **`UserSerializer`** (Swagger).

---

## 4. Références

| Sujet | Fichier / emplacement |
|--------|------------------------|
| Charte shell & tokens | **`BACKOFFICE_NEXTJS.md`** |
| Vue login | `apps/users/views.py` — `CustomLoginView` |
| URLs auth | `apps/users/urls.py` |
| Backlog API | **`BACKOFFICE_API_BACKLOG.md`** |

---

*Écran distinct de la **image 1** (carte sombre plein écran) : la cible produit est le **split layout + carte claire + footer marque** (image 2), recolorée avec **nos** jetons.*
