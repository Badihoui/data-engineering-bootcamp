/**
 * Seed databases for the SQL playground.
 *
 * Two schemas, both small enough to grasp in one screen and rich enough for
 * joins, window functions, CTEs and aggregations — exactly what modules 06, 07
 * and 20 drill.
 */

export interface Dataset {
  id: string
  name: string
  description: string
  tables: { name: string; columns: string[]; rows: number }[]
  sql: string
  samples: { title: string; query: string }[]
}

const ECOMMERCE = `
CREATE TABLE clients (
  client_id   INTEGER PRIMARY KEY,
  nom         TEXT NOT NULL,
  ville       TEXT,
  pays        TEXT,
  segment     TEXT,
  inscrit_le  DATE
);

CREATE TABLE produits (
  produit_id  INTEGER PRIMARY KEY,
  libelle     TEXT NOT NULL,
  categorie   TEXT,
  prix        REAL,
  stock       INTEGER
);

CREATE TABLE commandes (
  commande_id INTEGER PRIMARY KEY,
  client_id   INTEGER REFERENCES clients(client_id),
  passee_le   DATE,
  statut      TEXT
);

CREATE TABLE lignes_commande (
  ligne_id    INTEGER PRIMARY KEY,
  commande_id INTEGER REFERENCES commandes(commande_id),
  produit_id  INTEGER REFERENCES produits(produit_id),
  quantite    INTEGER,
  prix_unitaire REAL
);

INSERT INTO clients VALUES
 (1,'Awa Diallo','Dakar','Sénégal','pro','2025-03-14'),
 (2,'Marc Lefèvre','Lyon','France','particulier','2025-06-02'),
 (3,'Sofia Rossi','Milan','Italie','pro','2024-11-20'),
 (4,'Kwame Mensah','Accra','Ghana','pro','2026-01-05'),
 (5,'Elena Petrova','Sofia','Bulgarie','particulier','2025-09-30'),
 (6,'Lina Haddad','Tunis','Tunisie','pro','2025-02-11'),
 (7,'Tom Bakker','Utrecht','Pays-Bas','particulier','2025-12-01'),
 (8,'Chen Wei','Lyon','France','pro','2025-07-19');

INSERT INTO produits VALUES
 (1,'Clavier mécanique','périphérique',49.90,120),
 (2,'Écran 27 pouces','affichage',289.00,35),
 (3,'Souris ergonomique','périphérique',19.90,340),
 (4,'Dock USB-C','périphérique',129.00,58),
 (5,'Casque à réduction de bruit','audio',89.90,74),
 (6,'Webcam 4K','vidéo',69.00,90),
 (7,'Support d''écran','mobilier',39.00,150),
 (8,'SSD NVMe 2 To','stockage',189.00,42);

INSERT INTO commandes VALUES
 (1001,1,'2026-01-03','livrée'),
 (1002,2,'2026-01-03','livrée'),
 (1003,1,'2026-01-04','livrée'),
 (1004,3,'2026-01-04','annulée'),
 (1005,4,'2026-01-05','livrée'),
 (1006,2,'2026-01-06','en cours'),
 (1007,5,'2026-01-06','livrée'),
 (1008,6,'2026-01-07','livrée'),
 (1009,1,'2026-01-08','en cours'),
 (1010,8,'2026-01-08','livrée'),
 (1011,7,'2026-01-09','livrée'),
 (1012,3,'2026-01-10','livrée');

INSERT INTO lignes_commande VALUES
 (1,1001,1,2,49.90),(2,1001,3,1,19.90),
 (3,1002,2,1,289.00),
 (4,1003,5,1,89.90),(5,1003,6,2,69.00),
 (6,1004,2,3,289.00),
 (7,1005,4,1,129.00),(8,1005,1,1,49.90),
 (9,1006,8,1,189.00),
 (10,1007,3,5,19.90),(11,1007,7,2,39.00),
 (12,1008,2,2,289.00),(13,1008,5,1,89.90),
 (14,1009,6,1,69.00),
 (15,1010,8,2,189.00),(16,1010,1,1,49.90),
 (17,1011,3,3,19.90),
 (18,1012,4,2,129.00),(19,1012,7,1,39.00);
`

const LOGS = `
CREATE TABLE evenements (
  event_id    INTEGER PRIMARY KEY,
  horodatage  TEXT,
  service     TEXT,
  niveau      TEXT,
  duree_ms    INTEGER,
  message     TEXT
);

CREATE TABLE pipelines (
  pipeline_id INTEGER PRIMARY KEY,
  nom         TEXT,
  proprietaire TEXT,
  planification TEXT,
  actif       INTEGER
);

CREATE TABLE executions (
  run_id      INTEGER PRIMARY KEY,
  pipeline_id INTEGER REFERENCES pipelines(pipeline_id),
  demarre_le  TEXT,
  duree_s     INTEGER,
  statut      TEXT,
  lignes_traitees INTEGER
);

INSERT INTO pipelines VALUES
 (1,'ingest_ventes','equipe-data','0 3 * * *',1),
 (2,'ingest_clients','equipe-data','0 4 * * *',1),
 (3,'agg_kpi_journalier','equipe-bi','0 6 * * *',1),
 (4,'export_partenaires','equipe-bi','0 7 * * 1',0),
 (5,'cdc_catalogue','equipe-plateforme','*/15 * * * *',1);

INSERT INTO executions VALUES
 (1,1,'2026-01-06 03:00:00',47,'succès',10420),
 (2,1,'2026-01-07 03:00:00',52,'succès',11033),
 (3,1,'2026-01-08 03:00:00',301,'échec',0),
 (4,2,'2026-01-06 04:00:00',31,'succès',812),
 (5,2,'2026-01-07 04:00:00',29,'succès',844),
 (6,2,'2026-01-08 04:00:00',12,'échec',0),
 (7,3,'2026-01-06 06:00:00',118,'succès',52000),
 (8,3,'2026-01-07 06:00:00',124,'succès',53410),
 (9,3,'2026-01-08 06:00:00',611,'succès',53980),
 (10,5,'2026-01-08 03:15:00',8,'succès',134),
 (11,5,'2026-01-08 03:30:00',9,'succès',151),
 (12,5,'2026-01-08 03:45:00',7,'succès',98),
 (13,5,'2026-01-08 04:00:00',210,'échec',0);

INSERT INTO evenements VALUES
 (1,'2026-01-08 03:00:01','scheduler','INFO',4,'démarrage du DAG ingest_ventes'),
 (2,'2026-01-08 03:00:09','transform','WARN',12,'3 valeurs nulles dans la colonne pays'),
 (3,'2026-01-08 03:00:15','load','ERROR',15000,'connexion refusée sur warehouse:5439'),
 (4,'2026-01-08 03:00:31','load','ERROR',15000,'connexion refusée sur warehouse:5439'),
 (5,'2026-01-08 03:00:47','load','INFO',420,'écriture de 10 lignes dans public.ventes'),
 (6,'2026-01-08 04:00:06','extract','ERROR',80,'fichier clients.csv introuvable'),
 (7,'2026-01-08 06:00:00','scheduler','INFO',3,'démarrage du DAG agg_kpi_journalier'),
 (8,'2026-01-08 06:08:12','transform','WARN',600000,'exécution anormalement longue'),
 (9,'2026-01-08 06:10:11','scheduler','INFO',2,'DAG agg_kpi_journalier terminé'),
 (10,'2026-01-08 04:00:12','cdc','ERROR',210000,'lag Kafka supérieur au seuil');
`

export const DATASETS: Dataset[] = [
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description:
      'Clients, produits, commandes et lignes de commande — le terrain de jeu classique pour les jointures et les agrégations.',
    tables: [
      {
        name: 'clients',
        columns: ['client_id', 'nom', 'ville', 'pays', 'segment', 'inscrit_le'],
        rows: 8,
      },
      {
        name: 'produits',
        columns: ['produit_id', 'libelle', 'categorie', 'prix', 'stock'],
        rows: 8,
      },
      { name: 'commandes', columns: ['commande_id', 'client_id', 'passee_le', 'statut'], rows: 12 },
      {
        name: 'lignes_commande',
        columns: ['ligne_id', 'commande_id', 'produit_id', 'quantite', 'prix_unitaire'],
        rows: 19,
      },
    ],
    sql: ECOMMERCE,
    samples: [
      { title: 'Tout voir', query: 'SELECT * FROM clients;' },
      {
        title: 'Chiffre d’affaires par client',
        query: `SELECT c.nom,
       ROUND(SUM(l.quantite * l.prix_unitaire), 2) AS ca
FROM clients c
JOIN commandes cmd ON cmd.client_id = c.client_id
JOIN lignes_commande l ON l.commande_id = cmd.commande_id
WHERE cmd.statut = 'livrée'
GROUP BY c.nom
ORDER BY ca DESC;`,
      },
      {
        title: 'Window function : rang des produits',
        query: `SELECT p.libelle,
       SUM(l.quantite) AS unites,
       RANK() OVER (ORDER BY SUM(l.quantite) DESC) AS rang
FROM produits p
JOIN lignes_commande l ON l.produit_id = p.produit_id
GROUP BY p.libelle
ORDER BY rang;`,
      },
      {
        title: 'CTE : panier moyen par pays',
        query: `WITH totaux AS (
  SELECT cmd.commande_id,
         c.pays,
         SUM(l.quantite * l.prix_unitaire) AS total
  FROM commandes cmd
  JOIN clients c ON c.client_id = cmd.client_id
  JOIN lignes_commande l ON l.commande_id = cmd.commande_id
  GROUP BY cmd.commande_id, c.pays
)
SELECT pays,
       COUNT(*)              AS commandes,
       ROUND(AVG(total), 2)  AS panier_moyen
FROM totaux
GROUP BY pays
ORDER BY panier_moyen DESC;`,
      },
    ],
  },
  {
    id: 'observabilite',
    name: 'Observabilité',
    description:
      'Pipelines, exécutions et journaux — pour s’entraîner sur des questions de fiabilité et de SLA.',
    tables: [
      {
        name: 'pipelines',
        columns: ['pipeline_id', 'nom', 'proprietaire', 'planification', 'actif'],
        rows: 5,
      },
      {
        name: 'executions',
        columns: ['run_id', 'pipeline_id', 'demarre_le', 'duree_s', 'statut', 'lignes_traitees'],
        rows: 13,
      },
      {
        name: 'evenements',
        columns: ['event_id', 'horodatage', 'service', 'niveau', 'duree_ms', 'message'],
        rows: 10,
      },
    ],
    sql: LOGS,
    samples: [
      {
        title: 'Toutes les exécutions',
        query: 'SELECT * FROM executions ORDER BY demarre_le DESC;',
      },
      {
        title: 'Taux de succès par pipeline',
        query: `SELECT p.nom,
       COUNT(*)                                              AS runs,
       SUM(CASE WHEN e.statut = 'succès' THEN 1 ELSE 0 END)  AS succes,
       ROUND(100.0 * SUM(CASE WHEN e.statut = 'succès' THEN 1 ELSE 0 END) / COUNT(*), 1) AS taux
FROM pipelines p
JOIN executions e ON e.pipeline_id = p.pipeline_id
GROUP BY p.nom
ORDER BY taux;`,
      },
      {
        title: 'Détection de dérive de durée',
        query: `SELECT p.nom,
       e.demarre_le,
       e.duree_s,
       ROUND(AVG(e.duree_s) OVER (PARTITION BY p.nom), 1) AS moyenne,
       CASE WHEN e.duree_s > 3 * AVG(e.duree_s) OVER (PARTITION BY p.nom)
            THEN 'ANOMALIE' ELSE 'ok' END AS verdict
FROM executions e
JOIN pipelines p ON p.pipeline_id = e.pipeline_id
ORDER BY p.nom, e.demarre_le;`,
      },
    ],
  },
]
