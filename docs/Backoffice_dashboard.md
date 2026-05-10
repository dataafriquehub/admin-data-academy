# Prompt ultime — Implémentation du tableau de bord backoffice (Next.js)

**Usage :** colle ce document (ou la section « PROMPT POUR L’AGENT ») dans la consigne d’un agent IA chargé de développer ou refondre **uniquement la page Dashboard** du backoffice Data Academy.

**Prérequis backend :** l’API expose `GET /api/users/admin/dashboard/` (agrégats + listes récentes). Ce fichier est la spécification front ; le contrat exact est aussi dans `swagger.json` sous *Utilisateurs* → *Dashboard admin — statistiques agregees*.

**Prérequis UI :** la page doit s’afficher dans la **même coque** que le port étudiant (sidebar, TopBar, thème, tokens) décrite comme non négociable dans **`BACKOFFICE_NEXTJS.md`** ; le présent document ne définit que le **contenu** de la zone centrale `<main>` (pas un layout plein écran distinct).

---

## PROMPT POUR L’AGENT

Tu es un développeur front senior (Next.js App Router, TypeScript, Tailwind si le projet l’utilise). Ta mission : **refondre la page « Tableau de bord »** du backoffice admin pour qu’elle soit **dense, professionnelle et moderne**, en t’appuyant **exclusivement** sur l’endpoint agrégé suivant (pas de multiplier les appels pour les gros chiffres sauf si indispensable pour le détail d’une ligne).

### 1. Données — source de vérité

- **URL (relative à la base API, avec préfixe `/api`) :**  
  `GET /users/admin/dashboard/`
- **Authentification obligatoire :** header `Authorization: Bearer <access_token>`.
- **Rôle :** réservé aux comptes avec droit admin (permission serveur). En cas de **403**, affiche un message clair (« Accès réservé aux administrateurs ») sans casser la layout.
- **Réponse JSON — structure à respecter côté typage TypeScript :**

```ts
interface AdminDashboardResponse {
  generated_at: string; // ISO datetime

  counts: {
    users: {
      total: number;
      by_role: Record<string, number>; // ex. student, mentor, program_creator, admin
      new_last_7_days: number;
    };
    programs: {
      total: number;
      pending_validation: number;
      approved: number;
      rejected: number;
    };
    modules: { total: number };
    applications: {
      total: number;
      pending: number;
      under_review: number;
      approved: number;
      rejected: number;
      new_last_7_days: number;
    };
    certificates: { total: number };
    mentorship: {
      sessions_total: number;
      sessions_upcoming: number;
      sessions_in_past_30_days: number;
    };
    messaging: { conversations_total: number };
    notifications: { unread_total: number };
    uploads: { files_total: number };
  };

  recent: {
    applications: Array<{
      id: number;
      status: string;
      applied_at: string | null;
      program_title: string;
      student_email: string;
    }>;
    programs_pending_validation: Array<{
      id: number;
      title: string;
      updated_at: string | null;
      creator_email: string | null;
    }>;
    sessions_upcoming: Array<{
      id: number;
      title: string;
      scheduled_at: string | null;
      program_title: string;
      mentor_email: string | null;
    }>;
  };
}
```

- **Une seule requête** pour charger tout le tableau de bord (KPI + graphiques + listes récentes), sauf actions utilisateur ponctuelles (refresh bouton qui relance ce même GET).

### 2. États UX obligatoires

- **Loading :** skeletons ou placeholders cohérents avec la grille (pas un écran vide).
- **Erreur réseau / 401 :** message + redirection login si applicable selon les patterns du projet.
- **403 :** carte ou bandeau d’erreur explicite.
- **Succès :** afficher discrètement l’horodatage **`generated_at`** (ex. « Données à 14:32 » ou format localisé français).

### 3. Composition visuelle minimale à livrer

Implémente une mise en page **dashboard SaaS** (pas trois cartes seules avec du vide dessous).

1. **Rangée « Vue d’ensemble »** — cartes KPI (chiffres + libellés courts + lien « Voir la liste » ou équivalent là où une route existe déjà dans le backoffice) :
   - Programmes (`counts.programs.*` + lien vers liste programmes ; mettre en avant `pending_validation` si > 0).
   - Candidatures (`counts.applications.*` + lien liste candidatures).
   - Sessions mentorat (`counts.mentorship.sessions_total`, `sessions_upcoming` ; lien vers liste sessions si route existe).

2. **Rangée « Répartition »** — au minimum **deux visualisations** (bibliothèque au choix du projet : Recharts, Tremor, Chart.js, etc.) :
   - **Donut ou barres** : `counts.users.by_role` (avec légende lisible ; gérer rôles inconnus).
   - **Barres empilées ou multi-barres** : candidatures par statut (`pending`, `under_review`, `approved`, `rejected`).
   - Optionnel mais souhaitable : état des programmes (`pending_validation`, `approved`, `rejected`).

3. **Rangée « Activité récente »** — trois **tableaux compactes** ou **liste cliquables** avec en-tête et max 5 lignes (données = `recent.*`) :
   - **Dernières candidatures** → colonnes : étudiant, programme, statut, date → ligne cliquable vers détail `/admissions/applications/[id]` (ou équivalent du projet).
   - **Programmes en attente de validation** → titre, créateur, date → lien validation / édition programme.
   - **Prochaines sessions** → titre, programme, mentor, date/heure locale → lien session mentorat.

4. **Rangée secondaire KPI** — petites métriques (tuiles compactes ou ligne d’indicateurs) :
   - `users.new_last_7_days`, `applications.new_last_7_days`
   - `notifications.unread_total` (avec hint « centre de notifications »)
   - `messaging.conversations_total`, `certificates.total`, `uploads.files_total`
   - `mentorship.sessions_in_past_30_days`

### 4. Standards qualité

- **Chrome** : réutiliser le `Layout`/équivalent existant (**`BACKOFFICE_NEXTJS.md`**).
- **Responsive** : colonnes empilées sur mobile, grille 12 colonnes ou CSS grid sur desktop.
- **Contraste et hiérarchie** : titre de page clair sous-titre (« Vue d’ensemble des programmes, candidatures et sessions » peut être conservé ou affiné).
- **Pas de données sensibles exposées dans la console prod** au-delà du nécessaire.
- **Réutiliser** composants UI existants du backoffice (boutons, tableaux, cards) pour une cohérence visuelle.
- **Pas de valeur magique pour l’URL API** : utiliser la variable d’environnement du projet (ex. `NEXT_PUBLIC_API_BASE_URL`), en veillant à ce que les appels rejoignent bien `.../api/users/admin/dashboard/` (selon convention du repo : soit la base inclut déjà `/api`, soit elle est préfixée dans le client HTTP).

### 5. Ce qu’il ne faut pas faire

- Ne pas reconstruire les totaux en enchaînant cinq autres endpoints si ces totaux sont déjà dans **`counts`**.
- Ne pas laisser un grand bloc vide sous les KPI sans plan de remplissage (graphiques + récents obligatoires).
- Ne pas oublier l’état **403** pour les utilisateurs non admin.

### 6. Définition de « terminé » (acceptation)

La page Dashboard est jugée **livré** lorsque :

- Un admin authentifié voit loading → puis **données complètes** issues d’un seul `GET /users/admin/dashboard/`.
- Les ** trois zones** décrites (Vue d’ensemble, Répartition graphes, Activité récente + rangée KPI secondaire ) sont présentes et utiles sur desktop.
- Les liens depuis les listes récentes mènent vers les **routes existantes** du backoffice (corriger uniquement si les paths diffèrent légèrement selon votre router).
- Aucune régression évidente mobile (pas de overflow horizontal désordonné).

---

## Références rapides dans ce dépôt

| Ressource | Emplacement |
|-----------|--------------|
| Logique agrégation backend | `apps/users/dashboard_stats.py` |
| Vue + Swagger | `apps/users/views.py` (`AdminDashboardView`) |
| URL | `apps/users/urls.py` → `admin/dashboard/` |
| Doc backoffice générale | `BACKOFFICE_NEXTJS.md` |
| OpenAPI export | `swagger.json` |
| Collection tests | `postman_full_collection.json` |

À jour après régénération :  
`python manage.py generate_swagger swagger.json -o -f json`  
`python scripts/generate_postman_collection.py`

---

*Ce fichier peut être joint au ticket ou inclus tel quel comme instruction système pour l’agent en charge du front.*
