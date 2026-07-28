/**
 * Glossaire du Data Engineering.
 *
 * Chaque entrée renvoie vers le module où la notion est travaillée, pour que le
 * glossaire serve de porte d'entrée dans le parcours et pas seulement de
 * définition isolée.
 */

export interface GlossaryEntry {
  term: string
  category: Category
  definition: string
  /** Piège fréquent ou nuance qu'on ne trouve pas dans une définition courte. */
  nuance?: string
  aliases?: string[]
  moduleNumber?: number
}

export type Category =
  | 'architecture'
  | 'stockage'
  | 'traitement'
  | 'streaming'
  | 'qualité'
  | 'infrastructure'
  | 'gouvernance'
  | 'modélisation'

export const CATEGORY_LABELS: Record<Category, string> = {
  architecture: 'Architecture',
  stockage: 'Stockage',
  traitement: 'Traitement',
  streaming: 'Streaming',
  qualité: 'Qualité',
  infrastructure: 'Infrastructure',
  gouvernance: 'Gouvernance',
  modélisation: 'Modélisation',
}

export const CATEGORY_COLORS: Record<Category, string> = {
  architecture: '#38bdf8',
  stockage: '#34d399',
  traitement: '#a78bfa',
  streaming: '#f472b6',
  qualité: '#facc15',
  infrastructure: '#fb923c',
  gouvernance: '#94a3b8',
  modélisation: '#22d3ee',
}

export const GLOSSARY: GlossaryEntry[] = [
  /* ------------------------------------------------------- architecture */
  {
    term: 'ETL',
    category: 'architecture',
    definition:
      "Extract, Transform, Load : on extrait les données, on les transforme en dehors du système cible, puis on charge le résultat.",
    nuance:
      "Historiquement imposé par le coût du stockage et de calcul dans l'entrepôt. Aujourd'hui réservé aux cas où la transformation doit précéder l'arrivée (anonymisation, conformité).",
    moduleNumber: 1,
  },
  {
    term: 'ELT',
    category: 'architecture',
    definition:
      "Extract, Load, Transform : on charge les données brutes dans l'entrepôt, puis on transforme avec sa puissance de calcul.",
    nuance:
      "Le mode par défaut du cloud moderne. Il rend les transformations rejouables, puisque la donnée brute reste disponible.",
    moduleNumber: 1,
  },
  {
    term: 'Architecture médaillon',
    category: 'architecture',
    aliases: ['Bronze Silver Gold', 'Medallion'],
    definition:
      "Organisation d'un lakehouse en trois couches : Bronze (brut, tel qu'ingéré), Silver (nettoyé, typé, dédupliqué), Gold (agrégé, prêt pour le métier).",
    nuance:
      "Ce ne sont pas trois copies successives des mêmes données : chaque couche a un contrat et un public différents. Le Gold sert la BI, jamais le Bronze.",
    moduleNumber: 23,
  },
  {
    term: 'Architecture Lambda',
    category: 'architecture',
    definition:
      "Deux chemins parallèles : une couche batch qui recalcule tout périodiquement, une couche temps réel qui donne une vue approchée immédiate.",
    nuance:
      "Le défaut structurel est la double implémentation de la même logique métier, source de divergences. C'est ce que Kappa cherche à éliminer.",
    moduleNumber: 24,
  },
  {
    term: 'Architecture Kappa',
    category: 'architecture',
    definition:
      "Un seul chemin, en streaming. Le rejeu de l'historique se fait en relisant le log depuis le début plutôt qu'avec une couche batch séparée.",
    nuance:
      "Suppose un log durable et suffisamment long (Kafka avec rétention étendue, ou un topic compacté).",
    moduleNumber: 24,
  },
  {
    term: 'Data Mesh',
    category: 'architecture',
    definition:
      "Approche organisationnelle : chaque domaine métier détient et publie ses données comme un produit, avec un contrat et un niveau de service.",
    nuance:
      "C'est d'abord un changement d'organisation, pas un achat d'outil. Sans plateforme en libre-service, le mesh devient un silo de plus.",
    moduleNumber: 32,
  },

  /* ----------------------------------------------------------- stockage */
  {
    term: 'Data Lake',
    category: 'stockage',
    definition:
      "Dépôt de fichiers bruts, à plat, dans un stockage objet (S3, GCS, ADLS), sans schéma imposé à l'écriture.",
    nuance:
      "Sans catalogue ni gouvernance, un data lake devient un « data swamp » : les données sont là mais plus personne ne sait ce qu'elles valent.",
    moduleNumber: 22,
  },
  {
    term: 'Lakehouse',
    category: 'stockage',
    definition:
      "Data lake augmenté d'une couche transactionnelle (Delta, Iceberg, Hudi) qui apporte l'ACID, le time travel et l'évolution de schéma.",
    moduleNumber: 23,
  },
  {
    term: 'Parquet',
    category: 'stockage',
    definition:
      "Format de fichier colonnaire compressé, standard de fait pour l'analytique. Permet de ne lire que les colonnes utiles.",
    nuance:
      "Le gain vient du prédicat pushdown et du column pruning : `SELECT une_colonne` sur du Parquet lit une fraction de ce que lirait du CSV.",
    moduleNumber: 22,
  },
  {
    term: 'Time travel',
    category: 'stockage',
    definition:
      "Capacité à interroger l'état d'une table à un instant ou une version passée, grâce au journal des transactions du format de table.",
    nuance:
      "Précieux pour l'audit et le débogage, mais la rétention a un coût de stockage : les fichiers anciens ne sont supprimés qu'au VACUUM.",
    moduleNumber: 23,
  },
  {
    term: 'Partitionnement',
    category: 'stockage',
    definition:
      "Découpage physique d'une table en sous-dossiers selon les valeurs d'une colonne (souvent une date), pour ne lire que ce qui est nécessaire.",
    nuance:
      "Trop de partitions tue la performance : des milliers de petits fichiers coûtent plus cher en métadonnées qu'ils ne font gagner en lecture.",
    moduleNumber: 19,
  },

  /* --------------------------------------------------------- traitement */
  {
    term: 'Shuffle',
    category: 'traitement',
    definition:
      "Redistribution des données entre exécuteurs Spark, déclenchée par un `groupBy`, une jointure ou un `repartition`.",
    nuance:
      "C'est l'opération la plus coûteuse d'un job Spark : elle écrit sur disque et traverse le réseau. Réduire les shuffles est le premier levier d'optimisation.",
    moduleNumber: 19,
  },
  {
    term: 'Broadcast join',
    category: 'traitement',
    definition:
      "Jointure où la petite table est envoyée en entier à chaque exécuteur, évitant le shuffle de la grande table.",
    nuance:
      "Efficace tant que la petite table tient en mémoire ; au-delà, le driver sature. Le seuil se règle via `spark.sql.autoBroadcastJoinThreshold`.",
    moduleNumber: 19,
  },
  {
    term: 'Évaluation paresseuse',
    category: 'traitement',
    aliases: ['Lazy evaluation'],
    definition:
      "Les transformations ne s'exécutent pas immédiatement : elles construisent un plan, exécuté seulement lors d'une action (`count`, `collect`, `write`).",
    nuance:
      "C'est ce qui permet au moteur d'optimiser globalement — mais aussi ce qui fait qu'une erreur n'apparaît qu'à l'action, loin de la ligne fautive.",
    moduleNumber: 11,
  },
  {
    term: 'Catalyst',
    category: 'traitement',
    definition:
      "L'optimiseur de requêtes de Spark SQL : il réécrit le plan logique (pushdown des filtres, élagage des colonnes) avant de choisir un plan physique.",
    moduleNumber: 20,
  },
  {
    term: 'AQE',
    category: 'traitement',
    aliases: ['Adaptive Query Execution'],
    definition:
      "Optimisation à l'exécution : Spark ajuste le nombre de partitions et la stratégie de jointure d'après les statistiques réelles observées en cours de job.",
    nuance:
      "Répond aux cas où les statistiques a priori sont fausses, typiquement après un filtre très sélectif.",
    moduleNumber: 20,
  },
  {
    term: 'Idempotence',
    category: 'traitement',
    definition:
      "Propriété d'un traitement qui, rejoué avec les mêmes entrées, produit le même état final — sans doublon ni effet cumulé.",
    nuance:
      "Condition indispensable pour pouvoir relancer un pipeline en échec sans nettoyer à la main. En pratique : `MERGE INTO` plutôt que `INSERT`.",
    moduleNumber: 12,
  },

  /* ---------------------------------------------------------- streaming */
  {
    term: 'Topic',
    category: 'streaming',
    definition:
      "Flux nommé de messages dans Kafka, découpé en partitions. C'est un journal en ajout seul, pas une file qui se vide à la lecture.",
    moduleNumber: 24,
  },
  {
    term: 'Consumer group',
    category: 'streaming',
    definition:
      "Ensemble de consommateurs qui se répartissent les partitions d'un topic. Chaque partition n'est lue que par un membre du groupe à la fois.",
    nuance:
      "Le parallélisme maximal d'un groupe est donc borné par le nombre de partitions : ajouter un consommateur au-delà ne sert à rien.",
    moduleNumber: 24,
  },
  {
    term: 'Offset',
    category: 'streaming',
    definition:
      "Position d'un message dans une partition. Le consommateur mémorise l'offset atteint pour reprendre au bon endroit après un redémarrage.",
    moduleNumber: 24,
  },
  {
    term: 'Exactly-once',
    category: 'streaming',
    definition:
      "Garantie qu'un message produit un effet et un seul, même en cas de panne et de rejeu.",
    nuance:
      "Ne s'obtient jamais par magie : il faut des écritures transactionnelles ou idempotentes de bout en bout. Un maillon « at-least-once » suffit à tout casser.",
    moduleNumber: 24,
  },
  {
    term: 'Watermark',
    category: 'streaming',
    definition:
      "Seuil de tolérance au retard : au-delà, les événements en retard sont ignorés et l'état associé aux fenêtres anciennes peut être libéré.",
    nuance:
      "Sans watermark, l'état d'un job streaming croît indéfiniment jusqu'à saturer la mémoire.",
    moduleNumber: 24,
  },
  {
    term: 'CDC',
    category: 'streaming',
    aliases: ['Change Data Capture'],
    definition:
      "Capture des changements d'une base en lisant son journal de transactions, pour les publier comme un flux d'événements.",
    nuance:
      "Bien moins intrusif qu'un polling par `updated_at` : capture aussi les suppressions, et n'ajoute pas de charge de lecture à la base source.",
    moduleNumber: 29,
  },
  {
    term: 'Backpressure',
    category: 'streaming',
    definition:
      "Mécanisme par lequel un consommateur trop lent freine le producteur, au lieu de laisser les files gonfler jusqu'à la rupture.",
    moduleNumber: 29,
  },

  /* ------------------------------------------------------------ qualité */
  {
    term: 'Data contract',
    category: 'qualité',
    definition:
      "Engagement explicite entre producteur et consommateur : schéma, sémantique, fraîcheur, disponibilité, et procédure en cas de changement.",
    nuance:
      "Ce qui le distingue d'un simple schéma, c'est l'engagement de service et le processus de dépréciation.",
    moduleNumber: 32,
  },
  {
    term: 'Schema evolution',
    category: 'qualité',
    definition:
      "Capacité à faire évoluer le schéma d'une table sans réécrire l'historique ni casser les lecteurs existants.",
    nuance:
      "Ajouter une colonne optionnelle est rétrocompatible ; renommer ou changer un type ne l'est pas.",
    moduleNumber: 23,
  },
  {
    term: 'Test dbt',
    category: 'qualité',
    definition:
      "Assertion déclarative sur un modèle (`unique`, `not_null`, `accepted_values`, `relationships`) exécutée à chaque build.",
    nuance:
      "Un test dbt est une requête qui doit renvoyer zéro ligne : tout résultat est une violation.",
    moduleNumber: 25,
  },
  {
    term: 'Fraîcheur',
    category: 'qualité',
    aliases: ['Freshness'],
    definition:
      "Écart entre l'instant où un fait se produit et celui où il devient interrogeable. Se mesure, se contractualise et s'alerte.",
    moduleNumber: 25,
  },

  /* ------------------------------------------------------ infrastructure */
  {
    term: 'Conteneur',
    category: 'infrastructure',
    definition:
      "Processus isolé embarquant ses dépendances, lancé depuis une image immuable. Partage le noyau de l'hôte, contrairement à une VM.",
    moduleNumber: 14,
  },
  {
    term: 'Pod',
    category: 'infrastructure',
    definition:
      "Plus petite unité déployable de Kubernetes : un ou plusieurs conteneurs partageant réseau et volumes, ordonnancés ensemble.",
    moduleNumber: 15,
  },
  {
    term: 'StatefulSet',
    category: 'infrastructure',
    definition:
      "Contrôleur Kubernetes pour les charges à état : identité réseau stable, volume persistant attaché à chaque réplique, démarrage ordonné.",
    nuance:
      "À utiliser pour Kafka, PostgreSQL ou Zookeeper — un Deployment classique ne garantit ni l'identité ni la persistance.",
    moduleNumber: 16,
  },
  {
    term: 'Opérateur',
    category: 'infrastructure',
    definition:
      "Contrôleur qui étend Kubernetes avec une ressource personnalisée (CRD) et encode le savoir-faire d'exploitation d'un composant.",
    nuance:
      "Le Spark Operator transforme un `SparkApplication` en pods driver/executor et gère leur cycle de vie.",
    moduleNumber: 27,
  },
  {
    term: 'GitOps',
    category: 'infrastructure',
    definition:
      "L'état désiré du cluster est décrit dans Git ; un agent (ArgoCD, Flux) réconcilie en continu le cluster avec ce dépôt.",
    nuance: "Le déploiement n'est plus une action mais une conséquence d'un merge.",
    moduleNumber: 27,
  },
  {
    term: 'DAG',
    category: 'infrastructure',
    definition:
      "Graphe orienté acyclique décrivant des tâches et leurs dépendances. C'est l'unité d'ordonnancement d'Airflow.",
    nuance:
      "L'absence de cycle est ce qui rend l'ordre d'exécution calculable et le rejeu déterministe.",
    moduleNumber: 12,
  },
  {
    term: 'Backfill',
    category: 'infrastructure',
    definition:
      "Rejeu d'un pipeline sur une période passée, pour combler un trou ou appliquer une logique corrigée à l'historique.",
    nuance:
      "Ne fonctionne proprement que si les tâches sont idempotentes et paramétrées par la date logique, pas par « aujourd'hui ».",
    moduleNumber: 28,
  },

  /* -------------------------------------------------------- gouvernance */
  {
    term: 'Lineage',
    category: 'gouvernance',
    aliases: ['Traçabilité'],
    definition:
      "Graphe des dépendances entre jeux de données : d'où vient une colonne, quels traitements l'ont produite, qui la consomme en aval.",
    nuance:
      "C'est l'outil qui répond en minutes à « qui casse-t-on si on supprime cette colonne ? ».",
    moduleNumber: 28,
  },
  {
    term: 'Catalogue de données',
    category: 'gouvernance',
    definition:
      "Inventaire des jeux de données avec leur schéma, leur propriétaire, leur fraîcheur et leur documentation.",
    moduleNumber: 32,
  },
  {
    term: 'RLS',
    category: 'gouvernance',
    aliases: ['Row-Level Security'],
    definition:
      "Filtrage des lignes visibles selon l'identité de l'utilisateur, appliqué par le moteur et non par l'application.",
    nuance:
      "Filtrer côté application est une fuite en puissance : la donnée a déjà quitté la base.",
    moduleNumber: 22,
  },
  {
    term: 'ADR',
    category: 'gouvernance',
    aliases: ['Architecture Decision Record'],
    definition:
      "Note courte figeant une décision d'architecture : le contexte, les options envisagées, le choix retenu et ses conséquences.",
    nuance:
      "Sa valeur tient au contexte consigné : dans deux ans, on saura pourquoi le choix était raisonnable à l'époque.",
    moduleNumber: 34,
  },

  /* ------------------------------------------------------- modélisation */
  {
    term: 'Schéma en étoile',
    category: 'modélisation',
    aliases: ['Star schema'],
    definition:
      "Une table de faits centrale (les mesures) entourée de tables de dimensions dénormalisées (le contexte).",
    nuance:
      "La dénormalisation est volontaire : elle réduit le nombre de jointures au moment de la lecture, qui est ce qu'on optimise en analytique.",
    moduleNumber: 6,
  },
  {
    term: 'Table de faits',
    category: 'modélisation',
    definition:
      "Table qui porte les mesures numériques d'un événement métier et les clés étrangères vers les dimensions.",
    moduleNumber: 6,
  },
  {
    term: 'SCD type 2',
    category: 'modélisation',
    aliases: ['Slowly Changing Dimension'],
    definition:
      "Gestion d'historique d'une dimension : chaque changement crée une nouvelle ligne avec une période de validité, l'ancienne étant clôturée.",
    nuance:
      "Indispensable pour répondre à « quel était le segment de ce client au moment de la commande ? » plutôt qu'à « aujourd'hui ».",
    moduleNumber: 25,
  },
  {
    term: 'Normalisation',
    category: 'modélisation',
    definition:
      "Découpage d'un schéma pour éliminer les redondances et les anomalies de mise à jour, jusqu'à la 3ᵉ forme normale en pratique.",
    nuance:
      "Optimise l'écriture, donc l'OLTP. En analytique on dénormalise volontairement pour optimiser la lecture.",
    moduleNumber: 6,
  },
  {
    term: 'Window function',
    category: 'modélisation',
    aliases: ['Fonction fenêtre'],
    definition:
      "Fonction SQL qui calcule sur un ensemble de lignes liées à la ligne courante, sans les agréger : `RANK()`, `LAG()`, moyenne glissante.",
    nuance:
      "La différence avec `GROUP BY` : la fenêtre conserve toutes les lignes en sortie.",
    moduleNumber: 7,
  },
  {
    term: 'CTE',
    category: 'modélisation',
    aliases: ['Common Table Expression', 'WITH'],
    definition:
      "Sous-requête nommée introduite par `WITH`, qui rend une requête complexe lisible en la décomposant en étapes.",
    moduleNumber: 7,
  },
]

export function searchGlossary(entries: GlossaryEntry[], query: string): GlossaryEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return entries
  return entries.filter((entry) => {
    const haystack = [entry.term, entry.definition, entry.nuance ?? '', ...(entry.aliases ?? [])]
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
}
