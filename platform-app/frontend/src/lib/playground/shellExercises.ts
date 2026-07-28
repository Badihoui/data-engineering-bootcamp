/**
 * Guided drills for the terminal.
 *
 * Each challenge is validated against the *state* of the virtual filesystem or
 * the *output* the learner produced — never against the exact command string,
 * so any correct approach passes.
 */

import type { Shell } from './shell'

export interface ShellChallenge {
  id: string
  title: string
  brief: string
  hint: string
  solution: string
  /** Returns true when the challenge is satisfied. */
  check: (shell: Shell, lastOutput: string) => boolean
}

const normalise = (text: string) =>
  text
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

export const SHELL_CHALLENGES: ShellChallenge[] = [
  {
    id: 'nav-01',
    title: 'Se repérer',
    brief: 'Affiche le chemin absolu du dossier courant.',
    hint: 'Une seule commande de trois lettres.',
    solution: 'pwd',
    check: (_shell, output) => normalise(output).some((line) => line === '/home/de'),
  },
  {
    id: 'nav-02',
    title: 'Explorer en détail',
    brief: 'Liste le contenu de `data/raw` au format long, tailles lisibles.',
    hint: 'Combine les options -l et -h.',
    solution: 'ls -lh data/raw',
    check: (_shell, output) =>
      /ventes\.csv/.test(output) && /^-rw/m.test(output.replace(/\x1b\[[0-9;]*m/g, '')),
  },
  {
    id: 'txt-01',
    title: "Compter les lignes d'un CSV",
    brief: 'Affiche le nombre de lignes de `data/raw/ventes.csv`.',
    hint: 'wc a une option pour ne garder que les lignes.',
    solution: 'wc -l data/raw/ventes.csv',
    check: (_shell, output) => /\b11\b/.test(output),
  },
  {
    id: 'txt-02',
    title: 'Chercher les erreurs',
    brief: 'Extrais uniquement les lignes ERROR de `/var/log/pipeline.log`.',
    hint: 'grep MOTIF FICHIER',
    solution: 'grep ERROR /var/log/pipeline.log',
    check: (_shell, output) => {
      const rows = normalise(output)
      return rows.length >= 4 && rows.every((line) => line.includes('ERROR'))
    },
  },
  {
    id: 'txt-03',
    title: 'Compter les erreurs',
    brief: 'Affiche uniquement le NOMBRE de lignes ERROR du journal.',
    hint: 'grep -c, ou un pipe vers wc -l.',
    solution: 'grep -c ERROR /var/log/pipeline.log',
    check: (_shell, output) => normalise(output).some((line) => line === '4'),
  },
  {
    id: 'pipe-01',
    title: 'Première colonne',
    brief: "Extrais la colonne `pays` (7ᵉ) de `data/raw/ventes.csv`, sans l'en-tête.",
    hint: 'cut -d, -f7 puis tail -n +2… ou un pipe vers tail.',
    solution: 'cut -d, -f7 data/raw/ventes.csv | tail -n 10',
    check: (_shell, output) => {
      const rows = normalise(output)
      return rows.length >= 10 && rows.includes('France') && !rows.includes('pays')
    },
  },
  {
    id: 'pipe-02',
    title: 'Top des pays',
    brief:
      'Compte les ventes par pays et trie du plus fréquent au moins fréquent. La France doit arriver en tête.',
    hint: 'cut … | tail -n 10 | sort | uniq -c | sort -rn',
    solution: 'cut -d, -f7 data/raw/ventes.csv | tail -n 10 | sort | uniq -c | sort -rn',
    check: (_shell, output) => {
      const rows = normalise(output)
      return rows.length >= 3 && /^5\s+France$/.test(rows[0].replace(/\s+/g, ' ').trim())
    },
  },
  {
    id: 'fs-01',
    title: 'Préparer la sortie',
    brief: 'Crée le dossier `data/clean/2026/01` en une seule commande.',
    hint: 'mkdir a une option pour créer les parents manquants.',
    solution: 'mkdir -p data/clean/2026/01',
    check: (shell) => shell.fs.resolve('/home/de/data/clean/2026/01')?.kind === 'dir',
  },
  {
    id: 'fs-02',
    title: 'Rediriger un résultat',
    brief: 'Écris les lignes ERROR du journal dans un fichier `~/erreurs.txt`.',
    hint: 'Utilise > pour rediriger la sortie.',
    solution: 'grep ERROR /var/log/pipeline.log > ~/erreurs.txt',
    check: (shell) => {
      const node = shell.fs.resolve('/home/de/erreurs.txt')
      return Boolean(node && node.kind === 'file' && node.content.split('ERROR').length - 1 >= 4)
    },
  },
  {
    id: 'fs-03',
    title: 'Rendre un script exécutable',
    brief: 'Donne les droits 755 à `projets/run.sh` puis vérifie avec `ls -l`.',
    hint: 'chmod 755 chemin',
    solution: 'chmod 755 projets/run.sh',
    check: (shell) => (shell.fs.resolve('/home/de/projets/run.sh')?.mode ?? 0) === 0o755,
  },
  {
    id: 'find-01',
    title: 'Retrouver tous les CSV',
    brief: 'Liste tous les fichiers `.csv` sous le dossier courant, récursivement.',
    hint: "find . -name '*.csv'",
    solution: "find . -name '*.csv'",
    check: (_shell, output) => {
      const rows = normalise(output)
      return rows.length >= 2 && rows.every((line) => line.endsWith('.csv'))
    },
  },
  {
    id: 'awk-01',
    title: 'Colonnes choisies',
    brief:
      'Avec awk, affiche le produit (3ᵉ colonne) et la quantité (5ᵉ) de `data/raw/ventes.csv`.',
    hint: "awk -F, '{print $3, $5}' fichier",
    solution: "awk -F, '{print $3, $5}' data/raw/ventes.csv",
    check: (_shell, output) => {
      const rows = normalise(output)
      return rows.some((line) => /^Clavier\s+2$/.test(line)) && rows.length >= 10
    },
  },
]
