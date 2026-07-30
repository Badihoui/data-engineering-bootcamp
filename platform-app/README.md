# Plateforme d'apprentissage — Bootcamp Data Engineering

Application web complète construite **à partir du contenu du dépôt**. Les 36 notebooks
`notebooks/**/*.ipynb` restent la source de vérité : une commande les importe dans une base
relationnelle, une API REST les sert, une application React les rend vivants.

```
platform-app/
├── backend/      Django 5 + DRF + JWT   → API, import de contenu, progression, révision
├── frontend/     React 19 + Vite + TS   → interface apprenant et ateliers interactifs
├── docker/       Dockerfile et entrypoint du conteneur
├── deploy/       Caddyfile, unité systemd, scripts de déploiement et de sauvegarde
└── docs/         guides Docker et déploiement
```

**Lancement immédiat** : [docs/docker.md](docs/docker.md) — `docker compose up --build` depuis
la racine du dépôt, rien d'autre à installer.

**Mise en ligne** : [docs/deploiement.md](docs/deploiement.md) — un VPS à ≈ 4,20 $/mois suffit,
les ateliers s'exécutant dans le navigateur des apprenants.

---

## Ce que la plateforme ajoute au site Quarto

| | Site Quarto | Plateforme |
|---|---|---|
| Contenu | pages HTML statiques | 3 parcours · 36 modules · 723 leçons en base |
| Schémas | art ASCII dans des blocs `code` | **254/281 rendus en images** (90 %) |
| Pratique | lecture seule | **terminal bash, base SQL et interpréteur Python** dans le navigateur |
| Quiz | réponses cachées dans `<details>` | 20 quiz **corrigés côté serveur**, score, seuil, tentatives |
| Mémorisation | aucune | **flashcards à répétition espacée** (SM-2) sur les questions de quiz |
| Progression | aucune | leçons terminées, XP, série quotidienne, badges, certificats |
| Recherche | index statique | **palette ⌘K** sur modules et leçons |
| Personnel | aucun | notes par leçon, favoris, bibliothèque, glossaire |
| Comptes | aucun | inscription, JWT, profil, classement |

---

## Démarrage

### Docker — le plus simple

```bash
docker compose up --build      # depuis la racine du dépôt → http://localhost:8010
```

Une seule image : Django sert l'API *et* le frontend construit, donc un seul port et aucun
reverse proxy. 221 Mo, un processus, base SQLite dans un volume nommé.

### Backend

```bash
cd platform-app/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

.venv/bin/python manage.py migrate
.venv/bin/python manage.py import_content     # lit ../../notebooks/
.venv/bin/python manage.py createsuperuser    # optionnel → /admin/
.venv/bin/python manage.py runserver 8000
```

### Frontend

```bash
cd platform-app/frontend
npm install                # copie aussi sql-wasm.wasm dans public/
npm run dev                # http://localhost:5173 (proxy /api → :8000)
```

### Vérifier l'installation

```bash
cd platform-app/backend  && .venv/bin/python manage.py test          # 109 tests
cd platform-app/frontend && npx vitest run                           # 59 tests
cd platform-app/backend  && .venv/bin/python scripts/smoke_test.py   # 40 vérifications live
cd platform-app/frontend && npm run test:e2e                         # 13 vérifications navigateur
```

---

## Les ateliers — la pratique dans le navigateur

Tout s'exécute côté client. Rien n'est envoyé au serveur, l'apprenant peut tout casser.

### Terminal bash

Un interpréteur écrit pour l'occasion ([`shell.ts`](frontend/src/lib/playground/shell.ts)),
branché sur un système de fichiers en mémoire ([`vfs.ts`](frontend/src/lib/playground/vfs.ts))
pré-rempli d'un espace de travail réaliste : CSV de ventes et de clients, journal de pipeline
avec de vraies erreurs, script ETL, `/etc`, `/var/log`.

Il gère les tubes, les redirections `>` et `>>`, l'enchaînement `;`, les variables `$VAR`, les
jokers `*.csv`, les guillemets simples et doubles avec leur sémantique d'expansion, et
**35 commandes** :

```
pwd ls cd tree find · cat head tail touch mkdir rm cp mv chmod stat file
grep sort uniq wc cut sed awk tr rev tac nl diff · echo date whoami env export
history clear which du df man help
```

Le terminal ([xterm.js](frontend/src/components/playground/ShellTerminal.tsx)) offre l'édition
de ligne réelle : historique aux flèches, complétion Tab sur commandes *et* chemins,
Ctrl-A/E/U/C/L, curseur en milieu de ligne.

**Douze défis guidés** valident l'*état du système de fichiers* ou la *sortie produite*, jamais
la chaîne de commande — toute approche correcte passe.

### SQL

SQLite compilé en WebAssembly, deux bases pédagogiques (e-commerce à 4 tables, observabilité à
3 tables), éditeur CodeMirror avec autocomplétion sur le schéma vivant, exécution en `⌘↵`,
chronométrage, et sept requêtes d'exemple du `SELECT *` aux window functions et CTE.

### Python

Pyodide chargé à la demande (~10 Mo, jamais dans le bundle). Les imports sont détectés pour
installer automatiquement numpy, pandas, matplotlib ou pyarrow. Les mêmes CSV que le terminal
sont montés dans l'espace de travail. Six exemples progressifs, jusqu'au contrôle qualité type
Great Expectations.

### Depuis les leçons

Chaque bloc de code Python, SQL ou Bash d'une leçon porte un bouton **« S'entraîner »** qui
ouvre l'atelier pré-rempli sur le bon onglet, avec un fil d'Ariane pour revenir.

---

## Des schémas, pas de l'art ASCII

Les notebooks contiennent 281 dessins en caractères de boîte.
[`ascii_diagram.py`](backend/content/ascii_diagram.py) les analyse et choisit un rendu :

| Format | Détection | Rendu |
|---|---|---|
| `mermaid` | rectangles reliés par des flèches | `flowchart` Mermaid → SVG zoomable, thème clair/sombre |
| `tree` | connecteurs `├──` / `└──` | arborescence indentée avec annotations |
| `stack` | cadre unique, lignes `│ a │ b │` | pile de couches |
| `callout` | cadre unique en prose | carte titrée avec puces et sous-titres |
| `panels` | plusieurs cadres non reliés | cartes comparatives côte à côte |
| `ascii` | rien de reconnu | figure légendée (repli) |

**Couverture : 254/281 (90 %).**

Deux pièges ont demandé un traitement spécifique :

- **Les lignes ne font pas toutes la même longueur.** Un cadre dessiné comme un rectangle
  parfait a des lignes de 78 ou 79 caractères selon la présence d'accents ou d'emoji. La
  détection tolère ce décalage, mais **uniquement quand la ligne s'arrête avant la colonne
  attendue** — sinon deux cadres voisins reconnaissent mutuellement leur bordure.
- **Un cadre qui en contient d'autres est de la décoration.** Ce sont les cadres *feuilles* qui
  portent le sens ; garder l'englobant aplatirait tout un pipeline en un rectangle opaque.

### Reprendre la main sur un schéma

Chaque schéma a une clé stable (hash de sa source). Pour en écrire un à la main, créer
`backend/content/diagrams/<clé>.mmd` :

```
%% title: Architecture d'une plateforme data moderne (médaillon)
%% caption: Des sources à l'exposition, en traversant Bronze / Silver / Gold.
flowchart LR
    SRC["📥 Sources"] --> ING["🔄 Ingestion"] --> BRONZE["🥉 Bronze"]
```

Le fichier écrase toujours la conversion automatique ; un `.svg` du même nom fonctionne aussi.
Neuf schémas emblématiques sont déjà écrits à la main, dont le modèle relationnel de la
boutique en vrai diagramme entité-association.

```bash
python manage.py diagram_report              # couverture, par module
python manage.py diagram_report --pending    # clés restant à convertir
python manage.py diagram_report --scaffold   # génère les .mmd de départ
```

---

## Révision espacée

Les questions de quiz deviennent des cartes, tirées **uniquement des modules déjà ouverts**.
[`FlashcardReview`](backend/learning/models.py) implémente SM-2 : l'intervalle passe à 1 jour,
puis 6, puis se multiplie par le facteur de facilité, lequel dérive selon la qualité du rappel
sans jamais descendre sous 1,3 — sinon une carte difficile resterait programmée à un jour
d'intervalle pour toujours. Un échec remet l'intervalle à zéro et compte une rechute.

L'écran de révision se pilote au clavier : espace pour révéler, 1 à 4 pour se noter.

---

## Backend

### Applications

| App | Rôle |
|---|---|
| `catalog` | `Track` → `Module` → `Lesson` → blocs typés, plus `Diagram`, `Quiz`, `Question`, `Choice`, `Resource` |
| `learning` | `LessonProgress`, `QuizAttempt`, `FlashcardReview`, `Note`, `Bookmark`, `Enrollment` |
| `accounts` | utilisateur (email comme identifiant), XP, série, `Badge` / `UserBadge` |
| `content` | parseur de notebooks, convertisseur de schémas, commandes d'import |

### Modèle de contenu

Le corps d'une leçon n'est pas du markdown brut mais **une liste ordonnée de blocs typés**
(`markdown`, `code`, `diagram`, `solution`, `exercise`). Le frontend associe un composant dédié
à chaque type, sans re-parser du HTML côté client.

### Import

```bash
python manage.py import_content              # tout
python manage.py import_content --only 24    # un seul module
```

Idempotent : les modules sont mis à jour en place et leurs leçons remplacées. Ce que la
commande extrait de chaque notebook :

- titre, résumé, objectifs et prérequis (première cellule) ;
- sections `##` → leçons, avec estimation de durée et XP ;
- blocs `<details>` → solutions repliables — traités **avant** les blocs de code, sinon les
  balises ouvrante et fermante se retrouvent séparées et le repli disparaît ;
- sections `## Quiz` → QCM notés (`### ❓ Qn.` + options `a)`) et questions ouvertes
  (`**Qn.**` + `<details>`) ;
- sections `## Ressources` → liens externes ;
- tous les blocs de dessin ASCII → schémas.

### API

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/api/auth/register/` · `/login/` · `/refresh/` | comptes et JWT |
| `GET/PATCH` | `/api/auth/me/` | profil |
| `GET` | `/api/tracks/` · `/api/tracks/<slug>/` | parcours |
| `GET` | `/api/modules/` · `/api/modules/<slug>/` | modules (filtres `track__slug`, `kind`, `search`) |
| `GET` | `/api/lessons/<slug>/?module=<slug>` | leçon complète + schémas + voisins |
| `GET` | `/api/diagrams/` | schémas (filtre `fmt`) |
| `GET` | `/api/search/?q=` | recherche modules + leçons |
| `GET` | `/api/stats/` | compteurs du catalogue |
| `GET` | `/api/leaderboard/` | classement par XP |
| `GET` | `/api/me/dashboard/` · `/me/progress/` · `/me/certificates/` | espace apprenant |
| `GET` | `/api/me/flashcards/` · `/me/flashcards/stats/` | session de révision |
| `POST` | `/api/me/flashcards/<id>/grade/` | notation SM-2 |
| `POST` | `/api/lessons/<slug>/track/` | marquer une leçon vue/terminée |
| `POST` | `/api/modules/<slug>/quiz/submit/` | **correction serveur** du quiz |
| `GET/POST/PATCH/DELETE` | `/api/notes/` · `/api/bookmarks/` | notes et favoris |

La clé de correction (`Choice.is_correct`) n'est **jamais** sérialisée vers le client. Les
questions ouvertes, elles, embarquent leur réponse : elles sont auto-évaluées.

---

## Frontend

- **React 19 + Vite + TypeScript**, découpage par route — entrée à **119 kB gzip** malgré
  Mermaid, Pyodide, SQLite et xterm.js, tous chargés à la demande.
- **TanStack Query** pour le cache serveur, **Zustand** pour l'auth, le thème et le pont vers
  l'atelier.
- **Tailwind v4** avec jetons CSS (`--surface`, `--accent`…) : thèmes clair et sombre.
- **Motion** pour les transitions de page, les révélations au défilement, les compteurs, les
  anneaux de progression et les confettis — tous respectent `prefers-reduced-motion`.
- Coloration syntaxique via `highlight.js/lib/core` avec les seuls langages du bootcamp.

### Écrans

| Route | Écran |
|---|---|
| `/` | accueil publique |
| `/connexion` · `/inscription` | authentification |
| `/app` | tableau de bord : reprise, XP, série, anneau de progression |
| `/app/curriculum` · `/app/curriculum/:track` | programme, détail d'un niveau |
| `/app/modules` | catalogue avec recherche et filtres |
| `/app/modules/:module` | plan du module, objectifs, ressources, favori |
| `/app/modules/:module/:lesson` | lecteur de leçon, sommaire latéral, notes |
| `/app/modules/:module/quiz` | quiz noté + questions ouvertes |
| `/app/atelier` | terminal, SQL, Python |
| `/app/revision` | flashcards à répétition espacée |
| `/app/bibliotheque` | toutes les notes et tous les favoris |
| `/app/glossaire` | 45 notions reliées à leur module |
| `/app/reussites` | certificats imprimables, badges, classement |
| `/app/profil` | profil et objectif hebdomadaire |

`⌘K` (ou `Ctrl-K`) ouvre la palette de recherche depuis n'importe quel écran.

---

## Tests

| Suite | Portée | Nombre |
|---|---|---|
| `manage.py test content` | parseur de notebooks, convertisseur ASCII | 47 |
| `manage.py test learning` | correction des quiz, progression, badges, SM-2, classement, certificats | 62 |
| `vitest` | interpréteur shell, défis guidés, glossaire, bases SQL | 59 |
| `scripts/smoke_test.py` | routes et permissions contre les serveurs en marche | 40 |

Les tests ont trouvé quatre bugs réels invisibles autrement : les guillemets simples
n'empêchaient pas l'expansion de `$3` (donc `awk '{print $3}'` renvoyait du vide), les
solutions repliables disparaissaient quand elles contenaient du code, le nettoyage des
explications mangeait la première lettre des réponses ouvertes, et la date des certificats
restait vide sur les lignes créées hors du flux normal.

---

## Configuration

| Variable | Défaut | Rôle |
|---|---|---|
| `DJANGO_SECRET_KEY` | clé de dev | **à changer en production** |
| `DJANGO_DEBUG` | `1` | mettre `0` en production |
| `DJANGO_ALLOWED_HOSTS` | `*` | hôtes autorisés |
| `POSTGRES_DB` … | — | bascule SQLite → PostgreSQL si défini |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | origines du frontend |

---

## Limites connues

- **Modules 27 à 35 sans quiz** : les notebooks source n'en contiennent pas. Ajouter une
  section `## Quiz` dans le notebook puis relancer `import_content` suffit à les créer — et à
  alimenter les flashcards de ces modules.
- **27 schémas encore en repli ASCII** : maquettes d'interface (Jupyter, D-Tale) et
  chronologies, pour lesquelles le convertisseur n'a pas de forme cible. Ils s'affichent en
  figure légendée et se convertissent un par un via le registre.
- **Le playground Python exige une connexion** au premier lancement : Pyodide est chargé depuis
  un CDN. Le terminal et le playground SQL fonctionnent hors ligne.
- Pas encore de conteneurisation ni de pipeline CI.
