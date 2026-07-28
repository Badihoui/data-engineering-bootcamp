import { beforeEach, describe, expect, it } from 'vitest'

import { Shell } from './shell'
import { SHELL_CHALLENGES } from './shellExercises'

let shell: Shell

beforeEach(() => {
  shell = new Shell()
})

const run = async (command: string) => (await shell.run(command)).stdout

describe('navigation', () => {
  it('démarre dans le répertoire personnel', async () => {
    expect(await run('pwd')).toBe('/home/de\n')
  })

  it('suit les chemins relatifs, absolus et ~', async () => {
    await run('cd data/raw')
    expect(await run('pwd')).toBe('/home/de/data/raw\n')
    await run('cd ../..')
    expect(await run('pwd')).toBe('/home/de\n')
    await run('cd /var/log')
    expect(await run('pwd')).toBe('/var/log\n')
    await run('cd ~')
    expect(await run('pwd')).toBe('/home/de\n')
  })

  it('signale un dossier inexistant', async () => {
    const result = await shell.run('cd /nexiste/pas')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('introuvable')
  })

  it('revient au dossier précédent avec cd -', async () => {
    await run('cd /var/log')
    await run('cd -')
    expect(await run('pwd')).toBe('/home/de\n')
  })
})

describe('listing', () => {
  it('affiche le format long avec les permissions', async () => {
    const output = await run('ls -l data/raw')
    expect(output).toMatch(/-rw-r--r--/)
    expect(output).toContain('ventes.csv')
  })

  it('masque les fichiers cachés sans -a', async () => {
    await run('touch .cache')
    expect(await run('ls')).not.toContain('.cache')
    expect(await run('ls -a')).toContain('.cache')
  })

  it('développe les jokers', async () => {
    const output = await run('ls data/raw/*.csv')
    expect(output).toContain('ventes.csv')
    expect(output).toContain('clients.csv')
  })
})

describe('texte et pipes', () => {
  it('compte les lignes du CSV', async () => {
    expect(await run('wc -l data/raw/ventes.csv')).toContain('11')
  })

  it('filtre avec grep', async () => {
    const output = await run('grep ERROR /var/log/pipeline.log')
    const lines = output.trim().split('\n')
    expect(lines).toHaveLength(4)
    expect(lines.every((line) => line.includes('ERROR'))).toBe(true)
  })

  it('compte avec grep -c', async () => {
    expect(await run('grep -c ERROR /var/log/pipeline.log')).toBe('4\n')
  })

  it('inverse la sélection avec grep -v', async () => {
    const output = await run('grep -v ERROR /var/log/pipeline.log')
    expect(output).not.toContain('ERROR')
  })

  it('chaîne cut, sort et uniq à travers des pipes', async () => {
    const output = await run(
      'cut -d, -f7 data/raw/ventes.csv | tail -n 10 | sort | uniq -c | sort -rn',
    )
    const first = output.trim().split('\n')[0].replace(/\s+/g, ' ').trim()
    expect(first).toBe('5 France')
  })

  it('applique une substitution sed', async () => {
    const output = await run('sed s/ERROR/ALERTE/g /var/log/pipeline.log | grep -c ALERTE')
    expect(output).toBe('4\n')
  })

  it('sélectionne des colonnes avec awk', async () => {
    const output = await run("awk -F, '{print $3, $5}' data/raw/ventes.csv")
    expect(output).toContain('Clavier 2')
    expect(output.trim().split('\n')).toHaveLength(11)
  })

  it('numérote avec nl et inverse avec tac', async () => {
    expect(await run('head -n 2 data/raw/clients.csv | nl')).toMatch(/1\t/)
    const reversed = await run('head -n 3 data/raw/clients.csv | tac')
    expect(reversed.trim().split('\n')[0]).toContain('C002')
  })
})

describe('fichiers', () => {
  it('crée une arborescence avec mkdir -p', async () => {
    await run('mkdir -p data/clean/2026/01')
    expect(shell.fs.resolve('/home/de/data/clean/2026/01')?.kind).toBe('dir')
  })

  it('refuse de supprimer un dossier non vide sans -r', async () => {
    const result = await shell.run('rm data/raw')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('-r')
  })

  it('supprime récursivement avec rm -r', async () => {
    await run('mkdir -p tmp/a/b')
    await run('rm -r tmp')
    expect(shell.fs.resolve('/home/de/tmp')).toBeNull()
  })

  it('copie et déplace', async () => {
    await run('cp data/raw/ventes.csv sauvegarde.csv')
    expect(shell.fs.resolve('/home/de/sauvegarde.csv')?.content).toContain('Clavier')
    await run('mv sauvegarde.csv archive.csv')
    expect(shell.fs.resolve('/home/de/sauvegarde.csv')).toBeNull()
    expect(shell.fs.resolve('/home/de/archive.csv')).not.toBeNull()
  })

  it('change les permissions avec chmod', async () => {
    await run('chmod 755 projets/run.sh')
    expect(shell.fs.resolve('/home/de/projets/run.sh')?.mode).toBe(0o755)
  })

  it('trouve les fichiers par motif', async () => {
    const output = await run("find . -name '*.csv'")
    const lines = output.trim().split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(2)
    expect(lines.every((line) => line.endsWith('.csv'))).toBe(true)
  })
})

describe('redirections et variables', () => {
  it('écrit la sortie dans un fichier avec >', async () => {
    await run('grep ERROR /var/log/pipeline.log > erreurs.txt')
    const node = shell.fs.resolve('/home/de/erreurs.txt')
    expect(node?.content.split('ERROR').length ?? 0).toBe(5)
  })

  it('ajoute à la fin avec >>', async () => {
    await run('echo un > notes.txt')
    await run('echo deux >> notes.txt')
    expect(shell.fs.resolve('/home/de/notes.txt')?.content).toBe('un\ndeux\n')
  })

  it('développe les variables', async () => {
    await run('export PROJET=bootcamp')
    expect(await run('echo $PROJET')).toBe('bootcamp\n')
    expect(await run('echo "chemin: $HOME"')).toBe('chemin: /home/de\n')
  })

  it('enchaîne les commandes séparées par ;', async () => {
    await run('mkdir un ; mkdir deux')
    expect(shell.fs.resolve('/home/de/un')).not.toBeNull()
    expect(shell.fs.resolve('/home/de/deux')).not.toBeNull()
  })

  it('préserve les espaces entre guillemets', async () => {
    await run('echo "bonjour le monde" > salut.txt')
    expect(shell.fs.resolve('/home/de/salut.txt')?.content).toBe('bonjour le monde\n')
  })
})

describe('robustesse', () => {
  it('renvoie 127 pour une commande inconnue', async () => {
    const result = await shell.run('kubectl get pods')
    expect(result.code).toBe(127)
    expect(result.stderr).toContain('introuvable')
  })

  it('propose des complétions de commandes et de chemins', () => {
    expect(shell.completions('gr')).toContain('grep')
    expect(shell.completions('cat READ')).toContain('README.md')
  })

  it("conserve l'historique", async () => {
    await run('pwd')
    await run('ls')
    expect(shell.history).toEqual(['pwd', 'ls'])
  })
})

describe('défis guidés', () => {
  it.each(SHELL_CHALLENGES)('la solution de « $title » valide le défi', async (challenge) => {
    const fresh = new Shell()
    const result = await fresh.run(challenge.solution)
    const output = result.stdout + result.stderr
    expect(challenge.check(fresh, output)).toBe(true)
  })
})
