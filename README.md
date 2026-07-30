# Bootcamp Data Engineering — plateforme d'apprentissage

Projet personnel : une plateforme web complète pour apprendre le Data Engineering,
du premier script Python jusqu'au niveau Senior.

**35 modules · 2 projets intégrateurs · 723 leçons · terminal, SQL et Python dans le navigateur.**

---

## Ce que c'est

Le contenu vit dans des notebooks Jupyter. Une commande les importe dans une base, une API
Django les sert, et une application React les rend praticables : on y lit, on s'entraîne dans
un vrai terminal, on répond à des quiz corrigés côté serveur, on révise par répétition espacée.

```
.
├── platform-app/          ★ L'application (Django + React)
│   ├── backend/           API, import du contenu, progression
│   ├── frontend/          Interface et ateliers interactifs
│   ├── docker/            Entrypoint du conteneur
│   ├── deploy/            Caddy, systemd, scripts de déploiement
│   └── docs/              Guides Docker et mise en ligne
│
├── docker-compose.yml     Lancement en une commande
│
├── notebooks/             Le contenu — source de vérité
│   ├── beginner/          Modules 01-13 + projet Video Games
│   ├── intermediate/      Modules 14-26 + projet Olist
│   └── advanced/          Modules 27-35
│
├── resources/             Pages annexes (installation, FAQ, liens)
├── assets/                Logos et images
└── *.qmd, _quarto.yml     Ancien site statique Quarto (conservé)
```

👉 **[Documentation de la plateforme](platform-app/README.md)** ·
**[Lancer avec Docker](platform-app/docs/docker.md)** ·
**[Déployer en ligne](platform-app/docs/deploiement.md)**

---

## Démarrage

### Avec Docker — recommandé

Aucune installation de Python ni de Node. Fonctionne sur Linux, macOS et Windows.

```bash
docker compose up --build      # puis http://localhost:8010
```

Premier lancement : deux à trois minutes (build du frontend, import des notebooks).
Les suivants : environ six secondes. Détails dans
**[platform-app/docs/docker.md](platform-app/docs/docker.md)**.

### Sans Docker

```bash
# API
cd platform-app/backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py import_content     # lit ../../notebooks/
.venv/bin/python manage.py runserver 8000

# Interface (dans un second terminal)
cd platform-app/frontend
npm install && npm run dev                    # http://localhost:5173
```

Travailler les notebooks directement reste possible :

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
jupyter lab
```

---

## Ce que la plateforme apporte

| | Notebooks seuls | Plateforme |
|---|---|---|
| Schémas | art ASCII dans des blocs de code | **254/281 rendus en images** (flowcharts, arborescences, encadrés) |
| Pratique | lecture, exécution locale | **terminal bash, base SQL et Python** directement dans le navigateur |
| Quiz | réponses cachées dans le markdown | **corrigés côté serveur**, score, seuil, historique |
| Mémorisation | aucune | **flashcards à répétition espacée** (SM-2) |
| Progression | aucune | leçons terminées, XP, série, badges, certificats |
| Recherche | Ctrl+F | palette **⌘K** sur tout le catalogue |
| Personnel | aucun | notes par leçon, favoris, glossaire de 45 notions |

Les ateliers s'exécutent **entièrement côté client** — le serveur ne coûte donc presque rien,
et un VPS à environ 4 $/mois suffit à héberger l'ensemble.

---

## Le programme

### 🟦 Niveau 1 — Fondations (modules 01-13)

Construire des bases solides en Python, SQL et découvrir l'écosystème Big Data.
Aucun prérequis technique.

| # | Module | Thèmes |
|:--|:-------|:-------|
| 01 | Introduction au Data Engineering | rôle du DE, ETL/ELT, Lambda/Kappa/Lakehouse |
| 02 | Linux & Bash | commandes, scripting, cron, permissions |
| 03 | Git & versioning | branches, merge, rebase, workflows |
| 04 | Python fondamental | syntaxe, structures, fichiers, exceptions |
| 05 | Python data processing | POO, décorateurs, générateurs, context managers |
| 06 | Bases de données relationnelles | modélisation, normalisation, étoile |
| 07 | SQL pour Data Engineers | jointures, window functions, optimisation |
| 08 | Introduction Big Data | Hadoop, HDFS, MapReduce, systèmes distribués |
| 09 | MongoDB | NoSQL, CRUD, agrégations, indexation |
| 10 | Elasticsearch | recherche full-text, indexation, DSL |
| 11 | Introduction PySpark | RDD, DataFrame, transformations, actions |
| 12 | Orchestration de pipelines | scheduling, dépendances, DAG |
| 13 | FastAPI *(bonus)* | exposer ses données en API REST |

🎮 **Projet — Video Games Analytics** : Kaggle → scraping → DuckDB + Elasticsearch →
PySpark → FastAPI → Streamlit.

### 🟩 Niveau 2 — Industrialisation (modules 14-26)

Docker, Kubernetes, Spark avancé, Lakehouse, streaming, qualité de données.

| # | Module | Thèmes |
|:--|:-------|:-------|
| 14 | Docker | images, conteneurs, volumes, Compose |
| 15 | Kubernetes fondamentaux | pods, deployments, services, secrets |
| 16 | K8s pour workloads data | StatefulSets, Jobs, volumes persistants |
| 17 | Polars | API, lazy evaluation, comparaison Pandas/Spark |
| 18 | High performance Python | profiling, multiprocessing, async |
| 19 | PySpark avancé | partitioning, caching, broadcast, UDF |
| 20 | Spark SQL deep dive | Catalyst, plans d'exécution, AQE |
| 21 | Spark on Kubernetes | Spark Operator, scaling, monitoring |
| 22 | Cloud & object storage | S3, GCS, Azure Blob, MinIO, IAM |
| 23 | Table formats | Delta, Iceberg, ACID, time travel, MERGE |
| 24 | Kafka & streaming | topics, partitions, consumer groups, exactly-once |
| 25 | dbt & data quality | models, tests, documentation |

📦 **Projet — E-commerce Olist** : Kafka → Spark Streaming → Delta Lake → dbt → dashboard.

### 🟥 Niveau 3 — Architecture & leadership (modules 27-35)

| # | Module | Thèmes |
|:--|:-------|:-------|
| 27 | Kubernetes deep dive | operators, CRD, Helm, GitOps |
| 28 | Orchestration avancée | Airflow 2.x, DAGs dynamiques, Dagster |
| 29 | Messaging distribué | Kafka internals, Pulsar, CDC |
| 30 | Spark & Scala deep dive | Catalyst, Tungsten, optimisation bas niveau |
| 31 | Data Engineering pour le ML | feature stores, MLflow, model serving |
| 32 | Data Mesh & contracts | data products, ownership, contrats |
| 33 | Realtime OLAP | ClickHouse, Druid, Pinot |
| 34 | Patterns d'architecture | ADR, RFC, trade-offs, design reviews |
| 35 | Leadership & trade-offs | communication technique, mentoring |

---

## Stack couverte

| Domaine | Technologies |
|---------|--------------|
| **Traitement** | PySpark, Spark SQL, Scala, Polars, Pandas |
| **Lakehouse** | Delta Lake, Apache Iceberg, Hudi |
| **Streaming** | Kafka, Spark Streaming, Flink, Debezium |
| **Orchestration** | Airflow, Dagster, Prefect |
| **Conteneurs** | Docker, Kubernetes, Helm, ArgoCD |
| **Cloud** | AWS S3, GCP GCS, Azure Blob, MinIO |
| **Qualité** | dbt, Great Expectations, data contracts |
| **Observabilité** | Prometheus, Grafana |
| **OLAP** | ClickHouse, Apache Druid, Pinot |

---

## Progression conseillée

```
Semaines 1-10    🟦 Débutant      + projet Video Games
Semaines 11-22   🟩 Intermédiaire + projet Olist
Semaines 23-32   🟥 Avancé
                 ↓
             Senior Ready
```

Environ 6 à 8 mois à raison de 10-15 h par semaine.

---

## Prérequis techniques

- Python 3.10+ et Node 20+
- Docker à partir du niveau 2
- 8 Go de RAM minimum, 16 Go confortable

---

## Crédits

Ce dépôt est un fork de
[diakite-data/data-engineering-bootcamp](https://github.com/diakite-data/data-engineering-bootcamp),
le bootcamp *Data Engineering — From Zero to Hero* de **DIAKITE YOUSSOUF**, publié sous
licence MIT. Le contenu pédagogique des notebooks en provient.

La plateforme applicative (`platform-app/`), la conversion des schémas en images et les
ateliers interactifs sont propres à ce dépôt.
