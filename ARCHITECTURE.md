# Architecture — Travel Journal

> Analyse générée le 2026-03-23
> Stack : React 19 + Vite · Supabase · Vercel Serverless · Leaflet · OSRM · Claude API

---

## 1. Arbre des fonctionnalités

```
[CORE] Authentification
 ├── [FEATURE] AccessGate (écran d'entrée)                -> utilise serverLogin, detectTheme
 │    ├── [SUB] Saisie mot de passe                       -> déclenche serverLogin
 │    └── [HOOK] onLoginSuccess                           -> déclenche chargement journal, role state
 ├── [FEATURE] Login flow                                 -> dépend de api/auth.js
 │    ├── [SUB] serverLogin()                             -> POST /api/auth
 │    ├── [SUB] createToken()  [serveur]                  -> signe HMAC-SHA256, exp 7j
 │    └── [SUB] verifyToken()  [serveur]                  -> vérifie signature + expiration
 ├── [FEATURE] Gestion du token client                    -> utilise AUTH_TOKEN (var globale)
 │    ├── [SUB] setAuthToken(token)                       -> persiste token en mémoire
 │    ├── [SUB] getAuthHeaders()                          -> injecte Bearer token dans requêtes
 │    └── [SUB] proxyPhotoUrl(url)                        -> ajoute token aux URLs photos
 └── [FEATURE] Contrôle des rôles                        -> utilisé par toute écriture
      ├── [SUB] Admin (lecture + écriture + upload)
      │    └── [HOOK] isAdmin === true                    -> débloque DayCard édition, Settings, auto-save
      ├── [SUB] Visitor (lecture seule)
      │    └── [HOOK] isAdmin === false                   -> masque boutons d'édition
      └── [SUB] LoginBar                                  -> permet downgrade visitor / switch admin

[CORE] Persistance des données
 ├── [FEATURE] Chargement journal                         -> dépend de Supabase, token auth
 │    ├── [SUB] serverLoad()                              -> GET /api/storage?action=load
 │    └── [HOOK] useEffect au démarrage                   -> déclenche hydratation état React
 ├── [FEATURE] Sauvegarde automatique                     -> dépend de Supabase, rôle admin
 │    ├── [SUB] serverSave(data)                          -> POST /api/storage?action=save
 │    ├── [SUB] Debounce 2 000 ms                         -> déclenché par tout changement config/days
 │    ├── [SUB] Strip tokens URL photos                   -> nettoie avant persistance
 │    └── [HOOK] saveTimer (useRef)                       -> déclenche TripHeader status indicator
 └── [FEATURE] Base de données Supabase                   -> persiste dans table `journal`
      ├── [SUB] Table `journal` (id, data jsonb, updated_at)
      └── [SUB] Bucket `photos` (journal/<filename>.jpg)

[CORE] Gestion du voyage
 ├── [FEATURE] Settings (configuration du voyage)         -> admin only, persiste dans config
 │    ├── [SUB] Titre, dates départ/fin, destinations, participants
 │    └── [HOOK] onChange config                          -> déclenche auto-save, detectTheme, génération jours
 ├── [FEATURE] Génération automatique des jours           -> dépend de startDate, endDate
 │    ├── [SUB] makeDay(id, date)                         -> crée objet jour vide
 │    └── [HOOK] useEffect sur dates                      -> synchronise tableau days[]
 └── [FEATURE] CRUD des jours                             -> admin only
      ├── [SUB] Ajout jour (fin de liste)
      ├── [SUB] InsertDayBtn (insertion entre jours)      -> utilise addDaysToDate
      ├── [SUB] Suppression jour (DayCard)
      └── [HOOK] onChange days                            -> déclenche auto-save

[FEATURE] Cartes journalières (DayCard)                   -> utilise MiniMap, Lightbox, RouteBadge, AI
 ├── [SUB] En-tête pliable/dépliable                      -> affiche date, lieux, km, nb photos
 ├── [SUB] Saisie lieux (admin)                           -> tableau locations[], add/remove
 │    └── [HOOK] onChange locations                       -> déclenche geocode, MiniMap, KmCounter
 ├── [SUB] Notes / anecdotes (admin)                      -> textarea libre
 ├── [SUB] Gestion photos (admin)                         -> utilise resizeImage, serverUpload
 │    ├── [SUB] resizeImage(dataUrl, maxW)                -> canvas 800px full + 300px thumb
 │    ├── [SUB] serverUpload(base64, filename)            -> POST /api/storage?action=upload
 │    ├── [SUB] Suppression photo                         -> filtre photos[]
 │    └── [HOOK] onPhotoClick                             -> déclenche Lightbox
 ├── [SUB] Résumé IA                                      -> utilise api/summary.js (Claude)
 │    ├── [SUB] Étape 1 : vérification cohérence          -> Claude analyse photos vs lieux
 │    ├── [SUB] Étape 2 : génération résumé               -> Claude 50–80 mots, français
 │    └── [HOOK] onIncoherence                            -> affiche dialog confirmation
 └── [SUB] RouteBadge                                     -> affiche lieux + km + lien carte

[FEATURE] Cartographie & routage
 ├── [FEATURE] TripMap (carte plein écran)                -> onglet Map, utilise Leaflet, KmCounter
 │    ├── [SUB] Marqueurs numérotés (tous lieux du voyage)
 │    ├── [SUB] Polyline de l'itinéraire complet
 │    └── [SUB] Bouton rafraîchir                         -> redéclenche KmCounter
 ├── [FEATURE] MiniMap (carte par jour)                   -> utilisé par DayCard, FullSummary
 │    ├── [SUB] Marqueurs lieux du jour
 │    └── [SUB] Polyline locale
 ├── [FEATURE] KmCounter (calculateur d'itinéraire)       -> utilise OSRM API
 │    ├── [SUB] Géocodage de tous les lieux               -> utilise geocode() → Nominatim
 │    ├── [SUB] getRouteWithGeometry(a, b, scenic)        -> appelle OSRM router
 │    ├── [SUB] decodePolyline(str)                       -> décode format Google polyline
 │    ├── [SUB] Route Rapide / Touristique (toggle)
 │    └── [HOOK] onRouteCalculated                        -> met à jour days[].km + days[].kmTime
 └── [UTILITY] loadLeaflet()                              -> charge Leaflet.js + CSS depuis CDN
      └── [HOOK] useEffect map mount                      -> déclenche init carte Leaflet

[FEATURE] Galerie photos
 ├── [SUB] Grille auto-fill 150px                         -> utilise thumbs de tous les jours
 ├── [SUB] Overlay jour / lieu                            -> info contextuelle sur chaque vignette
 └── [HOOK] onPhotoClick                                  -> déclenche Lightbox

[FEATURE] Lightbox (visionneuse plein écran)
 ├── [SUB] Affichage plein écran + compteur (x/n)
 ├── [SUB] Navigation clavier (←, →, Escape)
 └── [SUB] Boutons précédent / suivant

[FEATURE] Résumé imprimable (FullSummary)                 -> utilise MiniMap, données days[]
 ├── [SUB] Tous les jours avec date, lieux, notes, résumé, photos (max 8)
 ├── [SUB] MiniMap par jour
 ├── [SUB] Bouton « Imprimer le carnet »                  -> window.print()
 └── [SUB] CSS print optimisé (breaks, no-print)

[FEATURE] Statistiques (StatsBar)
 ├── [SUB] Nombre de jours
 ├── [SUB] Nombre de photos                               -> compte photos[] de tous les jours
 ├── [SUB] Nombre d'étapes (lieux uniques)
 └── [SUB] Total kilomètres                               -> somme days[].km

[FEATURE] Navigation par onglets (TabBar)
 └── [SUB] Journal · Carte · Galerie · Résumé · Paramètres -> change état activeTab

[UTILITY] Système de thèmes
 ├── [SUB] 24 thèmes pays prédéfinis (couleurs, emoji, centre carte)
 ├── [SUB] detectTheme(destinations)                      -> regex sur mots-clés destination
 └── [HOOK] onChange destinations                         -> déclenche recalcul thème global

[UTILITY] Helpers divers
 ├── [SUB] geocode(loc)                                   -> Nominatim + cache GEO_CACHE
 ├── [SUB] addDaysToDate(ds, n)                           -> arithmétique de dates
 ├── [SUB] formatDuration(mins)                           -> "Xh YYmin"
 ├── [SUB] getAllLocations(days)                          -> extrait tous les lieux
 └── [SUB] makeDay(id, date)                              -> structure jour vide

[UTILITY] Proxy API Vercel (serveur)
 ├── [SUB] api/auth.js                                    -> login, createToken, verifyToken
 ├── [SUB] api/storage.js                                 -> load, save, upload, photo, geocode
 └── [SUB] api/summary.js                                 -> proxy Claude API (Anthropic)
```

---

## 2. Table des relations

| De (from)                    | Relation          | Vers (to)                             |
|------------------------------|-------------------|---------------------------------------|
| AccessGate                   | utilise           | serverLogin, detectTheme              |
| AccessGate                   | déclenche         | chargement journal, role state        |
| serverLogin                  | dépend de         | api/auth.js                           |
| api/auth.js (createToken)    | persiste dans     | token mémoire client (AUTH_TOKEN)     |
| api/auth.js (verifyToken)    | utilisé par       | api/storage.js (toutes actions auth)  |
| getAuthHeaders               | utilisé par       | serverLoad, serverSave, serverUpload  |
| proxyPhotoUrl                | utilisé par       | DayCard (affichage photos), Gallery   |
| isAdmin === true             | débloque          | DayCard édition, Settings, auto-save  |
| LoginBar                     | déclenche         | switch rôle (admin ↔ visitor)         |
| serverLoad                   | dépend de         | Supabase table `journal`, token auth  |
| serverLoad                   | déclenche         | hydratation config + days[]           |
| auto-save (debounce 2s)      | déclenché par     | tout changement config ou days[]      |
| auto-save                    | utilise           | serverSave → api/storage?action=save  |
| auto-save                    | déclenche         | TripHeader status indicator           |
| serverSave                   | persiste dans     | Supabase table `journal`              |
| serverUpload                 | persiste dans     | Supabase bucket `photos`              |
| Settings (config)            | déclenche         | auto-save, detectTheme, génération jours |
| startDate/endDate            | déclenche         | génération automatique days[]         |
| days[] CRUD                  | déclenche         | auto-save                             |
| DayCard locations[]          | déclenche         | geocode(), MiniMap, KmCounter         |
| DayCard photos[]             | utilise           | resizeImage, serverUpload             |
| DayCard onPhotoClick         | déclenche         | Lightbox                              |
| DayCard résumé IA            | utilise           | api/summary.js → Anthropic Claude API |
| résumé IA étape 1            | déclenche         | dialog confirmation si incohérence    |
| résumé IA étape 2            | persiste dans     | days[n].summary                       |
| RouteBadge                   | utilisé par       | DayCard                               |
| RouteBadge                   | déclenche         | navigation onglet Map (clic)          |
| TripMap                      | utilise           | Leaflet, getAllLocations, KmCounter   |
| MiniMap                      | utilisé par       | DayCard, FullSummary                  |
| MiniMap                      | utilise           | loadLeaflet(), geocode()              |
| KmCounter                    | utilise           | geocode(), getRouteWithGeometry()     |
| KmCounter                    | déclenche         | màj days[].km + days[].kmTime         |
| getRouteWithGeometry         | dépend de         | OSRM API (public)                     |
| getRouteWithGeometry         | utilise           | decodePolyline()                      |
| geocode()                    | dépend de         | Nominatim API via api/storage?action=geocode |
| geocode()                    | persiste dans     | GEO_CACHE (cache mémoire)             |
| loadLeaflet()                | dépend de         | CDN jsDelivr (Leaflet.js + CSS)       |
| Gallery                      | utilise           | thumbs photos tous jours              |
| Gallery onPhotoClick         | déclenche         | Lightbox                              |
| FullSummary                  | utilise           | MiniMap, days[].summary, days[].photos |
| FullSummary                  | déclenche         | window.print()                        |
| StatsBar                     | dépend de         | days[], config                        |
| TabBar                       | déclenche         | changement activeTab                  |
| detectTheme()                | déclenché par     | onChange destinations (Settings)      |
| detectTheme()                | déclenche         | recalcul couleurs theme global        |
| TripHeader                   | utilise           | config, theme, rôle, saveStatus       |
| api/summary.js               | dépend de         | ANTHROPIC_API_KEY (env var Vercel)    |
| api/storage.js               | dépend de         | SUPABASE_URL + SUPABASE_SERVICE_KEY   |
| api/auth.js                  | dépend de         | ADMIN_PASSWORD, VISITOR_PASSWORD, SESSION_SECRET |

---

## 3. Fichiers critiques par fonctionnalité

| Fonctionnalité                   | Fichiers critiques                                          |
|----------------------------------|-------------------------------------------------------------|
| **Authentification**             | `api/auth.js`, `src/App.jsx` (AccessGate, LoginBar, serverLogin, getAuthHeaders, AUTH_TOKEN) |
| **Persistance / Supabase**       | `api/storage.js`, `src/App.jsx` (serverLoad, serverSave, auto-save debounce) |
| **Gestion du voyage**            | `src/App.jsx` (Settings, makeDay, génération jours, days[] CRUD) |
| **DayCard**                      | `src/App.jsx` (DayCard component ~176 lignes, resizeImage, serverUpload) |
| **Cartographie & routage**       | `src/App.jsx` (TripMap, MiniMap, KmCounter, loadLeaflet, geocode, getRouteWithGeometry, decodePolyline) |
| **Résumé IA (Claude)**           | `api/summary.js`, `src/App.jsx` (logique 2 étapes dans DayCard) |
| **Galerie & Lightbox**           | `src/App.jsx` (Gallery, Lightbox)                           |
| **Résumé imprimable**            | `src/App.jsx` (FullSummary, MiniMap), `src/index.css` (print CSS) |
| **Statistiques**                 | `src/App.jsx` (StatsBar, getAllLocations)                   |
| **Système de thèmes**            | `src/App.jsx` (THEMES const, detectTheme)                   |
| **Navigation**                   | `src/App.jsx` (TabBar, TripHeader, activeTab state)         |
| **Helpers / utilitaires**        | `src/App.jsx` (geocode, addDaysToDate, formatDuration, makeDay, getAllLocations) |
| **Déploiement**                  | `vercel.json`, `vite.config.js`, `index.html`               |
| **Point d'entrée**               | `src/main.jsx`, `index.html`                                |

---

## 4. Diagramme de flux simplifié

```
Navigateur
  │
  ▼
[AccessGate]
  │  POST /api/auth (password)
  ▼
[api/auth.js] ── createToken() ──► AUTH_TOKEN (client)
  │
  ▼
[serverLoad()] GET /api/storage?action=load
  │  ◄── Supabase table `journal`
  ▼
[App state] config + days[]
  │
  ├──► [TripHeader]  titre, dates, participants, theme, saveStatus
  ├──► [TabBar]      Journal / Carte / Galerie / Résumé / Paramètres
  ├──► [StatsBar]    jours, photos, étapes, km
  │
  ├──► [Journal tab]
  │     └── DayCard × n
  │           ├── MiniMap ◄── loadLeaflet() + geocode() + Nominatim
  │           ├── Photos  ◄── resizeImage() + serverUpload() + Supabase
  │           ├── Résumé IA ◄── api/summary.js ◄── Anthropic Claude
  │           └── RouteBadge
  │
  ├──► [Carte tab]
  │     └── TripMap ◄── loadLeaflet()
  │           └── KmCounter ◄── geocode() + OSRM
  │
  ├──► [Galerie tab]
  │     └── Gallery ──► Lightbox
  │
  ├──► [Résumé tab]
  │     └── FullSummary ──► MiniMap + window.print()
  │
  └──► [Paramètres tab]
        └── Settings ──► onChange ──► detectTheme() + auto-save
                                          │
                                          ▼
                              serverSave() POST /api/storage?action=save
                                          │
                                          ▼
                                   Supabase table `journal`
```

---

## 5. Variables d'environnement requises

| Variable                | Utilisé dans    | Rôle                                     |
|-------------------------|-----------------|------------------------------------------|
| `ADMIN_PASSWORD`        | api/auth.js     | Mot de passe administrateur              |
| `VISITOR_PASSWORD`      | api/auth.js     | Mot de passe visiteur (lecture seule)    |
| `SESSION_SECRET`        | api/auth.js     | Clé HMAC-SHA256 pour signer les tokens   |
| `SUPABASE_URL`          | api/storage.js  | URL du projet Supabase                   |
| `SUPABASE_SERVICE_KEY`  | api/storage.js  | Clé service Supabase (jamais côté client)|
| `ANTHROPIC_API_KEY`     | api/summary.js  | Clé Claude pour génération de résumés    |
