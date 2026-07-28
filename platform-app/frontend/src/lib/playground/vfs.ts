/**
 * In-memory POSIX-like filesystem backing the practice terminal.
 *
 * Everything runs in the browser: no server, no sandbox to escape, and the
 * learner can break whatever they want. The tree is seeded with a realistic
 * data-engineering workspace (CSV, logs, scripts) so the exercises of module 02
 * — and any `grep | sort | uniq -c` drill — work for real.
 */

export type NodeKind = 'file' | 'dir'

export interface FsNode {
  name: string
  kind: NodeKind
  content: string
  mode: number
  mtime: Date
  children: Map<string, FsNode>
  parent: FsNode | null
}

export function createNode(
  name: string,
  kind: NodeKind,
  options: { content?: string; mode?: number; parent?: FsNode | null } = {},
): FsNode {
  return {
    name,
    kind,
    content: options.content ?? '',
    mode: options.mode ?? (kind === 'dir' ? 0o755 : 0o644),
    mtime: new Date(),
    children: new Map(),
    parent: options.parent ?? null,
  }
}

export class FsError extends Error {}

export class VirtualFs {
  root: FsNode
  cwd: FsNode
  home: FsNode

  constructor() {
    this.root = createNode('/', 'dir')
    this.home = this.mkdirp('/home/de')
    this.cwd = this.home
    this.seed()
  }

  /* ------------------------------------------------------------- paths */

  /** Absolute, normalised path of a node. */
  pathOf(node: FsNode): string {
    const parts: string[] = []
    let current: FsNode | null = node
    while (current && current.parent) {
      parts.unshift(current.name)
      current = current.parent
    }
    return '/' + parts.join('/')
  }

  /** Path with `$HOME` collapsed to `~`, for the prompt. */
  displayPath(node: FsNode = this.cwd): string {
    const path = this.pathOf(node)
    const home = this.pathOf(this.home)
    if (path === home) return '~'
    if (path.startsWith(home + '/')) return '~' + path.slice(home.length)
    return path
  }

  private split(path: string): { segments: string[]; from: FsNode } {
    let from = this.cwd
    let rest = path
    if (path.startsWith('~')) {
      from = this.home
      rest = path.slice(1)
    } else if (path.startsWith('/')) {
      from = this.root
    }
    return { segments: rest.split('/').filter(Boolean), from }
  }

  resolve(path: string): FsNode | null {
    if (!path || path === '.') return this.cwd
    const { segments, from } = this.split(path)
    let node: FsNode = from
    for (const segment of segments) {
      if (segment === '.') continue
      if (segment === '..') {
        node = node.parent ?? this.root
        continue
      }
      if (node.kind !== 'dir') return null
      const child = node.children.get(segment)
      if (!child) return null
      node = child
    }
    return node
  }

  /** Resolves the parent directory of a path plus the final segment name. */
  resolveParent(path: string): { parent: FsNode; name: string } | null {
    const { segments, from } = this.split(path)
    if (segments.length === 0) return null
    const name = segments[segments.length - 1]
    let node: FsNode = from
    for (const segment of segments.slice(0, -1)) {
      if (segment === '.') continue
      if (segment === '..') {
        node = node.parent ?? this.root
        continue
      }
      const child = node.children.get(segment)
      if (!child || child.kind !== 'dir') return null
      node = child
    }
    return { parent: node, name }
  }

  /* ---------------------------------------------------------- mutations */

  mkdirp(path: string): FsNode {
    const { segments, from } = this.split(path)
    let node: FsNode = from
    for (const segment of segments) {
      if (segment === '.') continue
      if (segment === '..') {
        node = node.parent ?? this.root
        continue
      }
      let child = node.children.get(segment)
      if (!child) {
        child = createNode(segment, 'dir', { parent: node })
        node.children.set(segment, child)
      }
      node = child
    }
    return node
  }

  writeFile(path: string, content: string): FsNode {
    const target = this.resolveParent(path)
    if (!target) throw new FsError(`${path}: chemin invalide`)
    const { parent, name } = target
    if (parent.kind !== 'dir') throw new FsError(`${path}: n'est pas un dossier`)
    let node = parent.children.get(name)
    if (node && node.kind === 'dir') throw new FsError(`${path}: est un dossier`)
    if (!node) {
      node = createNode(name, 'file', { parent })
      parent.children.set(name, node)
    }
    node.content = content
    node.mtime = new Date()
    return node
  }

  remove(path: string, recursive: boolean): void {
    const node = this.resolve(path)
    if (!node) throw new FsError(`${path}: fichier ou dossier introuvable`)
    if (node === this.root) throw new FsError('impossible de supprimer /')
    if (node.kind === 'dir' && node.children.size > 0 && !recursive) {
      throw new FsError(`${path}: le dossier n'est pas vide (utilise -r)`)
    }
    node.parent?.children.delete(node.name)
  }

  /** Depth-first walk used by `find` and `tree`. */
  *walk(node: FsNode = this.cwd, depth = 0): Generator<{ node: FsNode; depth: number }> {
    yield { node, depth }
    if (node.kind !== 'dir') return
    for (const child of [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      yield* this.walk(child, depth + 1)
    }
  }

  /* -------------------------------------------------------------- seed */

  private seed(): void {
    const write = (path: string, content: string) => {
      const parts = path.split('/')
      this.mkdirp(parts.slice(0, -1).join('/'))
      this.writeFile(path, content)
    }

    this.mkdirp('/home/de/projets')
    this.mkdirp('/home/de/data/raw')
    this.mkdirp('/home/de/data/clean')
    this.mkdirp('/var/log')
    this.mkdirp('/etc')
    this.mkdirp('/tmp')

    write(
      '/home/de/data/raw/ventes.csv',
      [
        'id,date,produit,categorie,quantite,prix_unitaire,pays',
        '1,2026-01-03,Clavier,peripherique,2,49.90,France',
        '2,2026-01-03,Ecran 27,affichage,1,289.00,Belgique',
        '3,2026-01-04,Souris,peripherique,5,19.90,France',
        '4,2026-01-04,Dock USB-C,peripherique,1,129.00,Suisse',
        '5,2026-01-05,Ecran 27,affichage,3,289.00,France',
        '6,2026-01-06,Casque,audio,2,89.90,Canada',
        '7,2026-01-06,Clavier,peripherique,1,49.90,Belgique',
        '8,2026-01-07,Webcam,video,4,69.00,France',
        '9,2026-01-08,Casque,audio,1,89.90,France',
        '10,2026-01-08,Souris,peripherique,7,19.90,Canada',
        '',
      ].join('\n'),
    )

    write(
      '/home/de/data/raw/clients.csv',
      [
        'client_id,nom,ville,pays,segment,inscrit_le',
        'C001,Awa Diallo,Dakar,Senegal,pro,2025-03-14',
        'C002,Marc Lefevre,Lyon,France,particulier,2025-06-02',
        'C003,Sofia Rossi,Milan,Italie,pro,2024-11-20',
        'C004,Kwame Mensah,Accra,Ghana,pro,2026-01-05',
        'C005,Elena Petrova,Sofia,Bulgarie,particulier,2025-09-30',
        '',
      ].join('\n'),
    )

    write(
      '/var/log/pipeline.log',
      [
        '2026-01-08 03:00:01 INFO  scheduler  démarrage du DAG ingest_ventes',
        '2026-01-08 03:00:04 INFO  extract    lecture de s3://raw/ventes.csv (10 lignes)',
        '2026-01-08 03:00:09 WARN  transform  3 valeurs nulles dans la colonne pays',
        '2026-01-08 03:00:11 INFO  transform  déduplication : 0 doublon',
        '2026-01-08 03:00:15 ERROR load       connexion refusée sur warehouse:5439',
        '2026-01-08 03:00:16 INFO  scheduler  nouvelle tentative 1/3',
        '2026-01-08 03:00:31 ERROR load       connexion refusée sur warehouse:5439',
        '2026-01-08 03:00:32 INFO  scheduler  nouvelle tentative 2/3',
        '2026-01-08 03:00:47 INFO  load       écriture de 10 lignes dans public.ventes',
        '2026-01-08 03:00:48 INFO  scheduler  DAG ingest_ventes terminé en 47s',
        '2026-01-08 04:00:01 INFO  scheduler  démarrage du DAG ingest_clients',
        '2026-01-08 04:00:06 ERROR extract    fichier clients.csv introuvable',
        '2026-01-08 04:00:07 ERROR scheduler  DAG ingest_clients en échec',
        '',
      ].join('\n'),
    )

    write(
      '/home/de/projets/etl.py',
      [
        '"""Mini pipeline ETL — à compléter pendant les exercices."""',
        'import csv',
        'from pathlib import Path',
        '',
        'SOURCE = Path("data/raw/ventes.csv")',
        'CIBLE = Path("data/clean/ventes.csv")',
        '',
        '',
        'def extraire(chemin):',
        '    with chemin.open() as fichier:',
        '        return list(csv.DictReader(fichier))',
        '',
        '',
        'def transformer(lignes):',
        '    for ligne in lignes:',
        '        ligne["montant"] = float(ligne["quantite"]) * float(ligne["prix_unitaire"])',
        '    return lignes',
        '',
        '',
        'if __name__ == "__main__":',
        '    print(len(transformer(extraire(SOURCE))), "lignes traitées")',
        '',
      ].join('\n'),
    )

    write(
      '/home/de/projets/run.sh',
      ['#!/usr/bin/env bash', 'set -euo pipefail', '', 'python3 etl.py', ''].join('\n'),
    )
    const runSh = this.resolve('/home/de/projets/run.sh')
    if (runSh) runSh.mode = 0o755

    write(
      '/home/de/README.md',
      [
        '# Espace de travail',
        '',
        'Bienvenue dans le terminal du bootcamp. Tout tourne dans ton navigateur.',
        '',
        '- `data/raw/`   fichiers source (CSV)',
        '- `data/clean/` sortie du pipeline',
        '- `projets/`    scripts Python et Bash',
        '- `/var/log/`   journaux à explorer avec grep',
        '',
        'Tape `help` pour la liste des commandes, `exercices` pour les défis guidés.',
        '',
      ].join('\n'),
    )

    write('/etc/hostname', 'bootcamp-de\n')
    write(
      '/etc/passwd',
      [
        'root:x:0:0:root:/root:/bin/bash',
        'de:x:1000:1000:Data Engineer:/home/de:/bin/bash',
        '',
      ].join('\n'),
    )
  }
}
