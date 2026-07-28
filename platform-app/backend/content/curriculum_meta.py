"""Curated metadata layered on top of the notebooks.

The notebooks carry the pedagogical content; this file carries what a learning
platform needs but a notebook does not express: level grouping, icons, tags,
difficulty and reading order. Keys are notebook filenames.
"""

TRACKS = [
    {
        "slug": "debutant",
        "title": "Niveau 1 — Débutant",
        "subtitle": "Fondations & premiers pipelines",
        "description": (
            "Construire des bases solides en Python, SQL et découvrir l'écosystème Big Data. "
            "Aucun prérequis technique : la curiosité suffit."
        ),
        "order": 1,
        "color": "#38bdf8",
        "accent": "#0284c7",
        "icon": "🟦",
        "estimated_weeks": 10,
        "prerequisites": "Aucun prérequis technique.",
        "objectives": [
            "Écrire des scripts Python professionnels",
            "Manipuler des données avec SQL et PySpark",
            "Comprendre les architectures Big Data",
            "Versionner son code avec Git",
        ],
        "outcomes": ["Construire un pipeline data de bout en bout"],
    },
    {
        "slug": "intermediaire",
        "title": "Niveau 2 — Intermédiaire",
        "subtitle": "Industrialisation & Lakehouse",
        "description": (
            "Maîtriser les technologies d'entreprise : Docker, Kubernetes, Spark avancé, "
            "Lakehouse, Streaming et qualité de données."
        ),
        "order": 2,
        "color": "#34d399",
        "accent": "#059669",
        "icon": "🟩",
        "estimated_weeks": 12,
        "prerequisites": "Niveau 1 complété ou équivalent (Python, SQL, bases Spark).",
        "objectives": [
            "Containeriser et déployer avec Docker/Kubernetes",
            "Construire un Lakehouse avec Delta Lake ou Iceberg",
            "Implémenter des pipelines streaming avec Kafka",
            "Garantir la qualité des données avec dbt",
        ],
        "outcomes": ["Livrer un pipeline Lakehouse production-ready"],
    },
    {
        "slug": "avance",
        "title": "Niveau 3 — Avancé",
        "subtitle": "Architecture, optimisation & leadership",
        "description": (
            "Atteindre le niveau Senior Data Engineer / Architecte Data : systèmes distribués, "
            "gouvernance, design reviews et leadership technique."
        ),
        "order": 3,
        "color": "#f87171",
        "accent": "#dc2626",
        "icon": "🟥",
        "estimated_weeks": 10,
        "prerequisites": "Niveau 2 complété ou expérience équivalente en entreprise.",
        "objectives": [
            "Concevoir et défendre une architecture Data complète",
            "Optimiser les performances à grande échelle",
            "Rédiger des ADR/RFC et mener des design reviews",
            "Mentorer une équipe technique",
        ],
        "outcomes": ["Être Senior Ready"],
    },
]

TRACK_BY_FOLDER = {
    "beginner": "debutant",
    "intermediate": "intermediaire",
    "advanced": "avance",
}

# filename -> (icon, difficulty 1-5, tags)
MODULE_META = {
    "01_intro_data_engineering.ipynb": ("🧭", 1, ["fondamentaux", "architecture", "etl", "elt"]),
    "02_bash_for_data_engineers.ipynb": ("🐧", 1, ["linux", "bash", "cli", "cron"]),
    "03_git_for_data_engineers.ipynb": ("🌿", 1, ["git", "versioning", "collaboration"]),
    "04_python_basics_for_data_engineers.ipynb": ("🐍", 1, ["python", "syntaxe", "structures"]),
    "05_python_data_processing_for_data_engineers.ipynb": ("⚙️", 2, ["python", "poo", "générateurs"]),
    "06_intro_relational_databases.ipynb": ("🗄️", 1, ["sgbd", "modélisation", "normalisation"]),
    "07_sql_for_data_engineers.ipynb": ("🔍", 2, ["sql", "jointures", "window functions"]),
    "08_intro_big_data_distributed.ipynb": ("🌐", 2, ["hadoop", "hdfs", "mapreduce"]),
    "09_mongodb_for_data_engineers.ipynb": ("🍃", 2, ["nosql", "mongodb", "agrégations"]),
    "10_elasticsearch_for_data_engineers.ipynb": ("🔎", 2, ["elasticsearch", "recherche", "dsl"]),
    "11_pyspark_for_data_engineering.ipynb": ("⚡", 2, ["pyspark", "rdd", "dataframe"]),
    "12_orchestration_pipelines.ipynb": ("🎼", 2, ["airflow", "orchestration", "dag"]),
    "13_fastapi_for_data_engineers.ipynb": ("🚀", 2, ["fastapi", "api", "rest"]),
    "projet_debutant.ipynb": ("🎮", 3, ["projet", "duckdb", "elasticsearch", "streamlit"]),
    "14_docker_for_data_engineers.ipynb": ("🐳", 2, ["docker", "conteneurs", "compose"]),
    "15_kubernetes_fundamentals.ipynb": ("☸️", 3, ["kubernetes", "pods", "services"]),
    "16_k8s_for_data_workloads.ipynb": ("📦", 3, ["kubernetes", "statefulset", "jobs"]),
    "17_polars_for_data_engineering.ipynb": ("🐻‍❄️", 2, ["polars", "lazy", "performance"]),
    "18_high_performance_python.ipynb": ("🏎️", 3, ["profiling", "async", "multiprocessing"]),
    "19_pyspark_advanced.ipynb": ("⚡", 3, ["spark", "partitioning", "tuning"]),
    "20_spark_sql_deep_dive.ipynb": ("🧠", 4, ["spark sql", "catalyst", "aqe"]),
    "21_spark_on_kubernetes.ipynb": ("☸️", 4, ["spark", "kubernetes", "operator"]),
    "22_cloud_and_object_storage.ipynb": ("☁️", 3, ["s3", "gcs", "minio", "iam"]),
    "23_table_formats_delta_iceberg.ipynb": ("🧊", 3, ["delta", "iceberg", "acid"]),
    "24_kafka_streaming.ipynb": ("🌊", 4, ["kafka", "streaming", "exactly-once"]),
    "25_dbt_data_quality.ipynb": ("✅", 3, ["dbt", "tests", "data quality"]),
    "26_projet_integrateur.ipynb": ("📦", 4, ["projet", "kafka", "delta", "dbt"]),
    "27_kubernetes_deep_dive.ipynb": ("☸️", 5, ["operators", "crd", "gitops"]),
    "28_advanced_orchestration.ipynb": ("🎛️", 4, ["airflow", "dagster", "dags dynamiques"]),
    "29_distributed_messaging.ipynb": ("📡", 5, ["kafka internals", "pulsar", "rabbitmq"]),
    "30_spark_scala_deep_dive.ipynb": ("🔥", 5, ["scala", "tungsten", "internals"]),
    "31_data_engineering_for_ml.ipynb": ("🤖", 4, ["feature store", "mlflow", "mlops"]),
    "32_data_mesh_contracts.ipynb": ("🕸️", 5, ["data mesh", "data contracts", "ownership"]),
    "33_realtime_olap_dashboards.ipynb": ("📊", 4, ["clickhouse", "druid", "pinot"]),
    "34_architecture_patterns_decisions.ipynb": ("🏛️", 5, ["adr", "rfc", "trade-offs"]),
    "35_leadership_tradeoffs.ipynb": ("🧑‍✈️", 5, ["leadership", "mentoring", "communication"]),
}

PROJECT_FILES = {
    "projet_debutant.ipynb",
    "26_projet_integrateur.ipynb",
}

# Explicit titles where the notebook H1 is too terse or missing.
TITLE_OVERRIDES = {
    "projet_debutant.ipynb": "Projet intégrateur — Video Games Analytics",
    "26_projet_integrateur.ipynb": "Projet intégrateur — E-commerce Olist",
}

BADGES = [
    {
        "slug": "premier-pas",
        "name": "Premier pas",
        "description": "Terminer son premier module.",
        "icon": "🌱",
        "color": "#34d399",
        "rule": "modules_completed",
        "threshold": 1,
    },
    {
        "slug": "en-cadence",
        "name": "En cadence",
        "description": "Cinq modules bouclés.",
        "icon": "🚴",
        "color": "#38bdf8",
        "rule": "modules_completed",
        "threshold": 5,
    },
    {
        "slug": "mi-parcours",
        "name": "Mi-parcours",
        "description": "Quinze modules bouclés.",
        "icon": "⛰️",
        "color": "#a78bfa",
        "rule": "modules_completed",
        "threshold": 15,
    },
    {
        "slug": "fondations",
        "name": "Fondations solides",
        "description": "Parcours Débutant terminé.",
        "icon": "🟦",
        "color": "#0284c7",
        "rule": "track_completed",
        "rule_scope": "debutant",
        "threshold": 1,
    },
    {
        "slug": "industrialisation",
        "name": "Industrialisation",
        "description": "Parcours Intermédiaire terminé.",
        "icon": "🟩",
        "color": "#059669",
        "rule": "track_completed",
        "rule_scope": "intermediaire",
        "threshold": 1,
    },
    {
        "slug": "senior-ready",
        "name": "Senior Ready",
        "description": "Parcours Avancé terminé.",
        "icon": "🏆",
        "color": "#dc2626",
        "rule": "track_completed",
        "rule_scope": "avance",
        "threshold": 1,
    },
    {
        "slug": "sans-faute",
        "name": "Sans faute",
        "description": "Trois quiz réussis à 100 %.",
        "icon": "🎯",
        "color": "#fbbf24",
        "rule": "quiz_perfect",
        "threshold": 3,
    },
    {
        "slug": "regularite",
        "name": "Régularité",
        "description": "Sept jours d'affilée.",
        "icon": "🔥",
        "color": "#f97316",
        "rule": "streak_days",
        "threshold": 7,
    },
]

GITHUB_REPO = "diakite-data/data-engineering-bootcamp"


def colab_url(notebook_path: str) -> str:
    return f"https://colab.research.google.com/github/{GITHUB_REPO}/blob/main/{notebook_path}"
