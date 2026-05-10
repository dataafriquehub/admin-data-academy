# Messagerie backoffice — alignement sur le portail étudiant

Document + **prompt maître** pour implémenter l’écran messagerie du **backoffice Next.js** avec la **même expérience** que chez l’étudiant (layout, flux, pièces jointes, comportements responsive). **Dans la sidebar backoffice**, l’entrée de navigation doit s’appeler **« Communauté »** — pas **« Messages »** (libellé réservé au sens strict au TopBar / notifications si le produit le garde ailleurs).

Référence à dupliquer côté logique et UX : projet **`front-data-academy-student`**.

---

## Fichiers de référence (à lire avant d’encoder)

| Fichier | Contenu pertinent |
|---------|-------------------|
| `src/pages/MessagingPage.jsx` | Page complète : grille 2 colonnes (liste + fil de discussion), filtres, recherche conversations, polling, composer, fichier joint **multipart**, modal « nouvelle conversation », états vide/erreur/chargement, mobile (liste ↔ fil). |
| `src/components/MessageAttachmentCard.jsx` | Affichage pièces jointes : **pas** de lien brut vers `/api/messaging/attachments/{id}/download/` ; téléchargement **blob** avec jeton Bearer ; aperçu image/vidéo/PDF comme l’étudiant. |
| `src/services/messagingService.js` | `listConversations`, `listConversationMessages`, `sendConversationMessage` (JSON ou **FormData** avec `files`), `markConversationRead`, `getOrCreateDirectConversation`, `listMessagingContacts`, `downloadMessagingAttachmentBlob`, URLs dans `src/api/routes.js`. |
| `src/utils/parseContentDisposition.js` | Nom de fichier depuis en-tête `Content-Disposition` (téléchargement pièce jointe). |
| `src/locales/*/translation.json` | Clés `messaging.*` et textes connexes (`help.browsePrograms` pour CTA liste vide étudiant — **adapter le texte** côté admin si vous ne renvoyez pas vers `/programs`). |

---

## Exigences UI — équivalent fonctionnel étudiant

0. **Sidebar backoffice — libellé du menu**  
   - Entrée menant vers la route messagerie : texte visible **« Communauté »** (FR ; équivalent EN ex. *Community* si vous internationalisez).  
   - **Ne pas** nommer cette ligne « Messages » dans la sidebar (éviter doublon sémantique avec le bouton **Messages** de la TopBar).  
   - La **route**, l’**icône** et le **filtrage par rôle** restent ceux du backoffice ; seul le **label** sidebar est ainsi différencié du portail étudiant si celui-ci affiche « Messages ».

1. **Même gabarit de page sous la coque** (Sidebar + TopBar déjà décrites dans `BACKOFFICE_NEXTJS.md`) :
   - En-tête : titre (`messaging.title` équivalent ou libellé admin), sous-titre, **note rétention pièces jointes** (`messaging.attachmentsRetentionNote` ou équivalent).
   - Zone principale `bg-neutral-2`, padding comme la ref (`px-4 lg:px-8`).
   - **Grille** : `lg:grid-cols-[340px_1fr]`, gap, hauteur `h-[calc(100vh-220px)] min-h-[500px]` (ajuster si la hauteur des bandeaux Layout diffère).

2. **Colonne gauche — liste des conversations**
   - Carte `rounded-2xl border border-neutral-4 bg-neutral-1`.
   - **Recherche** : champ arrondi `rounded-full`, icône `solar:magnifer-linear`.
   - **Bouton** nouvelle conversation : rond `bg-primary-1`, icône `solar:pen-new-square-bold`.
   - **Filtres pills** : `all` | `direct` | `program` (même logique de style actif/inactif).
   - Liste : lignes avec avatar (initiales), titre conversation, dernier extrait (`getLastMessageContent` équivalent avec pièces jointes dans l’aperçu), heure courte, badge non lus bleu groupe `program` avec petite icône groupe.
   - Sélection ligne : fond `bg-primary-5`; sur **mobile**, masquer la liste quand un fil est ouvert (**comme `showThreadOnMobile`** étudiant) + bouton retour dans l’entête du fil.

3. **Colonne droite — fil de discussion**
   - Carte même style ; en-tête fil : avatar titre, sous-titre type direct / groupe.
   - Liste messages : séparateurs **jour** (Aujourd’hui / Hier / date).
   - Bulles : alignement gauche/droite (`isMine`), couleurs `bg-primary-1 text-white` / `bg-neutral-2`, `rounded-2xl`, timestamps discrets.
   - **Pas de bulle vide** si seulement fichier : même condition que `{content && …}` avant les pièces jointes.

4. **Pièces jointes**
   - Composant type **`MessageAttachmentCard`** (porter le code ou l’adapter en Next) :
     - `GET` authentifié → `blob`, bouton télécharger ; aperçu image/vidéo ; PDF expandable.
   - **Envoi** : `POST …/conversations/{id}/messages/` en **multipart** avec champ(s) fichier + éventuellement `content`, `metadata` en string JSON selon Swagger (voir implémentation actuelle `sendConversationMessage` étudiante).

5. **Composer**
   - Ligne basse : bouton trombone `paperclip`, `textarea` `rounded-2xl`, bouton Envoyer **primary** avec icône avion / spinner ; **Enter** envoie, **Shift+Enter** nouvelle ligne.
   - Fichier en attente : chip avec nom + retirer + indicateur upload % si applicable.
   - Limites pièces jointes backend (variables d’env, défauts dans `config/settings/base.py`) : **10&nbsp;MiB par fichier** (`MESSAGING_ATTACHMENT_MAX_BYTES`), **jusqu’à 5 fichiers** par message (`MESSAGING_ATTACHMENT_MAX_COUNT`), **rétention** des fichiers **7 jours** (`MESSAGING_ATTACHMENT_RETENTION_DAYS`) — après quoi le téléchargement peut répondre **410**. Refléter ces valeurs dans la note rétention i18n (alignée éventuellement sur les clés `messaging.*` du portail étudiant).

6. **Modal « Nouvelle conversation »**
   - Overlay `bg-black/40`, panneau `max-w-md rounded-2xl border-neutral-4`.
   - Chargement `GET /messaging/contacts/`, recherche locale, liste contacts avec **nom**, **email**, **badge rôle** (admin, mentor, program_creator, student — mêmes libellés i18n que `messaging.role*`).
   - Clic → `POST /messaging/conversations/direct/` avec **`recipient_id`** (entier utilisateur cible) ; le backend accepte aussi l’alias **`user_id`** (legacy). Réponse = conversation (serializer `ConversationSerializer`).

7. **Sync URL**
   - Query **`?c=<conversationId>`** pour ouvrir / partager le fil actif (même principe que `useSearchParams` étudiant).

8. **Polling**
   - Rafraîchissement périodique conversations et messages (ex. 30 s / 15 s comme la ref) pour se rapprocher du ressenti temps réel sans WebSocket.

9. **Différences acceptables côté admin**
   - Entrée sidebar **« Communauté »** (voir §0) à la place de « Messages ».
   - Libellés ou CTA (ex. liste vide : ne pas envoyer vers « parcourir les programmes » si non pertinent).
   - Le **backend** filtre **`GET /messaging/contacts/`** par rôle : **student** → admins + concepteurs ; **admin** ou **program_creator** → étudiants, et pour **admin** en plus admins / concepteurs / mentors ; **mentor** (et autres rôles hors cas précédents) → uniquement **admins**. Les conversations listées restent celles dont l’utilisateur est **participant**.
   - **L’UI reste la même** (mêmes composants, mêmes états vides/erreur).

---

## Endpoints API (préfixe `/api/messaging/`)

Chemins Django : les segments utilisent **`conversation_id`** et **`attachment_id`** dans le code ; les URL sont du type `/conversations/<id>/messages/` (l’`id` de chemin = id de conversation).

| Usage | Méthode | Chemin typique |
|-------|---------|----------------|
| Liste conversations | GET | `/conversations/` |
| Messages paginés | GET | `/conversations/{conversation_id}/messages/?page=&page_size=` (défaut **page_size 30**) — réponse **`{ items, page, page_size, total, has_next, has_previous }`** |
| Envoi (texte + fichiers) | POST | `/conversations/{conversation_id}/messages/` — FormData : **`files`** et/ou **`file`** (multiples), `content`, `metadata` (souvent **chaîne JSON** en multipart) ; ou JSON `{ content, metadata }` sans fichiers |
| Marquer lu | PATCH | `/conversations/{conversation_id}/read/` |
| Non lus (badge) | GET | `/conversations/unread-count/` — réponse **`{ total_unread_count, conversations: [{ conversation_id, unread_count }] }`** |
| Nouvelle DM | POST | `/conversations/direct/` — corps **`{ "recipient_id": <int> }`** (ou `user_id`) |
| Contacts pour modal | GET | `/contacts/` — filtre serveur selon le rôle (voir §9) |
| Groupe programme (catalogue) | GET | `/conversations/programs/{program_id}/` — conversation groupe du programme (si participant) |
| Créer / synchroniser groupe programme | POST | `/conversations/programs/{program_id}/ensure/` — utile si l’étudiant/front ouvre un fil programme depuis un programme |
| Téléchargement pièce jointe | GET | `/attachments/{attachment_id}/download/` (**Bearer** + participant ; hors rétention → **410**) |

Contrat exact : **Swagger** / **`postman_full_collection.json`** du backend — toujours reloader après une mise à jour API.

---

## Piège connu

Ne **jamais** rendre un simple `<a href={urlApiDownload}>` vers la pièce jointe : le navigateur n’envoie pas le JWT → **401**. Toujours passer par un client HTTP avec `Authorization` et `responseType: 'blob'` (ou équivalent Next).

---

## Annexe — Prompt maître (copier-coller)

Collez le bloc suivant dans Cursor (avec le repo **étudiant** et le repo **backoffice** en contexte). Remplacez `[ROUTE_MESSAGES_ADMIN]` par le chemin de route Next choisi (ex. `/messages` ou `/admin/messages`).

```
## Tâche
Implémente (ou refond) l’écran **Messagerie** du backoffice Next.js pour qu’il soit **visuellement et fonctionnellement équivalent** à la page étudiante `front-data-academy-student` → `src/pages/MessagingPage.jsx`, **sans** changer la charte (tokens `primary-*`, `neutral-*`, `secondary-*`, Poppins, Iconify Solar, dark mode).

## Référence obligatoire
1. Lis et reproduis la structure, les classes Tailwind, les états (loading, error, empty), le responsive (grille 340px + fil, comportement mobile avec retour arrière), le polling, la query `?c=`.
2. Réutilise la même logique métier que :
   - `src/services/messagingService.js` (adaptation `fetch`/`axios` + `NEXT_PUBLIC_API_BASE_URL`)
   - `src/components/MessageAttachmentCard.jsx` + `downloadMessagingAttachmentBlob`
   - `src/utils/parseContentDisposition.js`
3. Garde : filtres All / Direct / Groupes (program), recherche liste, modal nouvelle conversation (`/messaging/contacts/` + `POST /messaging/conversations/direct/`), envoi multipart avec pièce jointe, marquage lu, avatars en initiales (pas d’URL avatar dans `MessagingUser`).

## Contraintes
- Route backoffice : `[ROUTE_MESSAGES_ADMIN]`.
- **Sidebar :** libellé du menu vers cet écran = **« Communauté »** (pas « Messages »).
- Shell : déjà le Layout admin aligné sur l’étudiant (sidebar + topbar) — n’invente pas une autre mise en page pour la messagerie.
- i18n : réutiliser les mêmes clés `messaging.*` que l’étudiant (copier namespaces ou fusionner) ; ajuste seulement les textes marketing si besoin (sous-titre, CTA liste vide).
- Pas de lien direct non authentifié vers `.../attachments/{id}/download/`.

## Livrables
- Composant(s) page + sous-composants (liste, fil, composer, modal, carte pièce jointe si extrait).
- Service API messagerie typé ou documenté.
- README : variables d’env, comment tester avec un compte admin.

Commence par un court inventaire des écarts entre ton implémentation actuelle et `MessagingPage.jsx`, puis applique les correctifs fichier par fichier.
```

---

*À utiliser en complément de `BACKOFFICE_NEXTJS.md` pour la coque globale ; ce fichier cible **uniquement** l’écran messagerie.*
