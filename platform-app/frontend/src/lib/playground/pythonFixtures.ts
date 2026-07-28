/** CSV fixtures mounted into the Pyodide filesystem at `/home/pyodide/data`. */

export const VENTES_CSV = `id,date,produit,categorie,quantite,prix_unitaire,pays
1,2026-01-03,Clavier,peripherique,2,49.90,France
2,2026-01-03,Ecran 27,affichage,1,289.00,Belgique
3,2026-01-04,Souris,peripherique,5,19.90,France
4,2026-01-04,Dock USB-C,peripherique,1,129.00,Suisse
5,2026-01-05,Ecran 27,affichage,3,289.00,France
6,2026-01-06,Casque,audio,2,89.90,Canada
7,2026-01-06,Clavier,peripherique,1,49.90,Belgique
8,2026-01-07,Webcam,video,4,69.00,France
9,2026-01-08,Casque,audio,1,89.90,France
10,2026-01-08,Souris,peripherique,7,19.90,Canada
`

export const CLIENTS_CSV = `client_id,nom,ville,pays,segment,inscrit_le
C001,Awa Diallo,Dakar,Senegal,pro,2025-03-14
C002,Marc Lefevre,Lyon,France,particulier,2025-06-02
C003,Sofia Rossi,Milan,Italie,pro,2024-11-20
C004,Kwame Mensah,Accra,Ghana,pro,2026-01-05
C005,Elena Petrova,Sofia,Bulgarie,particulier,2025-09-30
`

export const PYTHON_SNIPPETS: { title: string; description: string; code: string }[] = [
  {
    title: 'Premiers pas',
    description: 'Variables, boucles, f-strings.',
    code: `produits = ["Clavier", "Écran", "Souris"]
prix = [49.90, 289.00, 19.90]

for nom, tarif in zip(produits, prix):
    print(f"{nom:<10} {tarif:>8.2f} €")

total = sum(prix)
print(f"{'TOTAL':<10} {total:>8.2f} €")
`,
  },
  {
    title: 'Lire un CSV sans dépendance',
    description: 'Le module csv de la bibliothèque standard.',
    code: `import csv

with open("data/ventes.csv") as fichier:
    lignes = list(csv.DictReader(fichier))

print(f"{len(lignes)} lignes lues")
print("Colonnes :", ", ".join(lignes[0].keys()))

for ligne in lignes[:3]:
    montant = float(ligne["quantite"]) * float(ligne["prix_unitaire"])
    print(f'{ligne["produit"]:<12} → {montant:7.2f} €')
`,
  },
  {
    title: 'pandas : agrégations',
    description: 'GroupBy, tri, colonnes calculées.',
    code: `import pandas as pd

ventes = pd.read_csv("data/ventes.csv", parse_dates=["date"])
ventes["montant"] = ventes["quantite"] * ventes["prix_unitaire"]

par_pays = (
    ventes.groupby("pays")
    .agg(commandes=("id", "count"), chiffre_affaires=("montant", "sum"))
    .sort_values("chiffre_affaires", ascending=False)
    .round(2)
)

print(par_pays)
print()
print("CA total :", round(ventes["montant"].sum(), 2), "€")
`,
  },
  {
    title: 'pandas : jointure et pivot',
    description: 'Merge, pivot_table, remplissage des trous.',
    code: `import pandas as pd

ventes = pd.read_csv("data/ventes.csv", parse_dates=["date"])
ventes["montant"] = ventes["quantite"] * ventes["prix_unitaire"]

pivot = ventes.pivot_table(
    index="categorie",
    columns="pays",
    values="montant",
    aggfunc="sum",
    fill_value=0,
).round(2)

print(pivot)
`,
  },
  {
    title: 'Générateurs et pipeline paresseux',
    description: 'Traiter un flux sans tout charger en mémoire.',
    code: `import csv
from typing import Iterator


def lire(chemin: str) -> Iterator[dict]:
    with open(chemin) as fichier:
        yield from csv.DictReader(fichier)


def enrichir(lignes: Iterator[dict]) -> Iterator[dict]:
    for ligne in lignes:
        ligne["montant"] = float(ligne["quantite"]) * float(ligne["prix_unitaire"])
        yield ligne


def filtrer(lignes: Iterator[dict], seuil: float) -> Iterator[dict]:
    return (ligne for ligne in lignes if ligne["montant"] >= seuil)


pipeline = filtrer(enrichir(lire("data/ventes.csv")), seuil=200)

for ligne in pipeline:
    print(f'{ligne["produit"]:<12} {ligne["montant"]:8.2f} € ({ligne["pays"]})')
`,
  },
  {
    title: 'Qualité des données',
    description: 'Contrôles à la Great Expectations, en pur Python.',
    code: `import csv

REGLES = {
    "quantite": lambda v: v.isdigit() and int(v) > 0,
    "prix_unitaire": lambda v: float(v) > 0,
    "pays": lambda v: len(v) > 1,
}

with open("data/ventes.csv") as fichier:
    lignes = list(csv.DictReader(fichier))

echecs = []
for index, ligne in enumerate(lignes, start=2):
    for colonne, regle in REGLES.items():
        if not regle(ligne[colonne]):
            echecs.append((index, colonne, ligne[colonne]))

print(f"{len(lignes)} lignes contrôlées, {len(echecs)} anomalie(s)")
for ligne, colonne, valeur in echecs:
    print(f"  ligne {ligne} · {colonne} = {valeur!r}")

if not echecs:
    print("✅ Toutes les attentes sont satisfaites")
`,
  },
]
