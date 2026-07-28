/**
 * A bash-flavoured interpreter running entirely in the browser.
 *
 * Supports the subset a data engineer actually types all day: pipelines,
 * redirections, globs, variables, command substitution, and ~35 coreutils.
 * Every command is a pure function of (args, stdin, context) so they compose
 * through pipes exactly like the real thing.
 */

import { FsError, VirtualFs, createNode, type FsNode } from './vfs'

export interface ExecResult {
  stdout: string
  stderr: string
  code: number
}

interface Context {
  fs: VirtualFs
  env: Record<string, string>
  history: string[]
  stdin: string
  args: string[]
  shell: Shell
}

type CommandFn = (ctx: Context) => ExecResult | Promise<ExecResult>

const ok = (stdout = ''): ExecResult => ({ stdout, stderr: '', code: 0 })
const fail = (stderr: string, code = 1): ExecResult => ({ stdout: '', stderr, code })

/* ------------------------------------------------------------- tokenizer */

interface Token {
  value: string
  quoted: boolean
  /** Single-quoted: no variable expansion, exactly like bash. */
  raw: boolean
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let current = ''
  let quoted = false
  let raw = false
  let inSingle = false
  let inDouble = false

  const push = () => {
    if (current || quoted) tokens.push({ value: current, quoted, raw })
    current = ''
    quoted = false
    raw = false
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (char === '\\' && !inSingle && i + 1 < input.length) {
      current += input[++i]
      continue
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle
      quoted = true
      raw = true
      continue
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble
      quoted = true
      continue
    }
    if (!inSingle && !inDouble && /\s/.test(char)) {
      push()
      continue
    }
    if (!inSingle && !inDouble && (char === '|' || char === '>' || char === '<' || char === ';')) {
      push()
      // `>>` is a single operator.
      if (char === '>' && input[i + 1] === '>') {
        tokens.push({ value: '>>', quoted: false, raw: false })
        i++
      } else {
        tokens.push({ value: char, quoted: false, raw: false })
      }
      continue
    }
    current += char
  }
  push()
  return tokens
}

/* ------------------------------------------------------------- expansion */

function expandVariables(value: string, env: Record<string, string>): string {
  return value
    .replace(/\$\{(\w+)\}/g, (_, name) => env[name] ?? '')
    .replace(/\$(\w+)/g, (_, name) => env[name] ?? '')
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`)
}

function expandGlob(pattern: string, fs: VirtualFs): string[] {
  if (!/[*?]/.test(pattern)) return [pattern]
  const slash = pattern.lastIndexOf('/')
  const dirPath = slash >= 0 ? pattern.slice(0, slash) || '/' : '.'
  const namePattern = slash >= 0 ? pattern.slice(slash + 1) : pattern
  const dir = fs.resolve(dirPath)
  if (!dir || dir.kind !== 'dir') return [pattern]
  const regex = globToRegex(namePattern)
  const matches = [...dir.children.keys()]
    .filter((name) => regex.test(name) && !name.startsWith('.'))
    .sort()
    .map((name) => (slash >= 0 ? `${dirPath}/${name}` : name))
  return matches.length ? matches : [pattern]
}

/* -------------------------------------------------------------- helpers */

function readNode(fs: VirtualFs, path: string): string {
  const node = fs.resolve(path)
  if (!node) throw new FsError(`${path}: fichier introuvable`)
  if (node.kind === 'dir') throw new FsError(`${path}: est un dossier`)
  return node.content
}

function lines(text: string): string[] {
  return text.split('\n').filter((line, index, all) => index < all.length - 1 || line !== '')
}

function parseFlags(args: string[]): {
  flags: Set<string>
  values: Map<string, string>
  rest: string[]
} {
  const flags = new Set<string>()
  const values = new Map<string, string>()
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const [name, value] = arg.slice(2).split('=')
      if (value !== undefined) values.set(name, value)
      else flags.add(name)
    } else if (arg.startsWith('-') && arg.length > 1 && !/^-\d/.test(arg)) {
      for (const letter of arg.slice(1)) flags.add(letter)
    } else {
      rest.push(arg)
    }
  }
  return { flags, values, rest }
}

/** Takes the value that follows a flag, e.g. `-d ,` or `grep -m 3`. */
function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index >= 0 && index + 1 < args.length) return args[index + 1]
  const inline = args.find((a) => a.startsWith(flag) && a.length > flag.length)
  return inline?.slice(flag.length)
}

function stripFlagPairs(args: string[], flagsWithValue: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (flagsWithValue.includes(arg)) {
      i++
      continue
    }
    if (flagsWithValue.some((f) => arg.startsWith(f) && arg.length > f.length)) continue
    if (arg.startsWith('-') && arg.length > 1 && !/^-\d/.test(arg)) continue
    out.push(arg)
  }
  return out
}

function modeString(node: FsNode): string {
  const type = node.kind === 'dir' ? 'd' : '-'
  const bits = ['r', 'w', 'x']
  let out = ''
  for (let shift = 6; shift >= 0; shift -= 3) {
    const value = (node.mode >> shift) & 7
    out += bits.map((bit, index) => ((value >> (2 - index)) & 1 ? bit : '-')).join('')
  }
  return type + out
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / 1024 / 1024).toFixed(1)}M`
}

function nodeSize(node: FsNode): number {
  return node.kind === 'dir' ? 4096 : node.content.length
}

const MONTHS = [
  'jan',
  'fév',
  'mar',
  'avr',
  'mai',
  'juin',
  'juil',
  'aoû',
  'sep',
  'oct',
  'nov',
  'déc',
]

function shortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, ' ')
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${MONTHS[date.getMonth()]} ${day} ${time}`
}

/* ------------------------------------------------------------- commands */

const COMMANDS: Record<string, CommandFn> = {
  help: () =>
    ok(
      [
        'Commandes disponibles — tape `man <commande>` pour le détail.',
        '',
        '  Navigation   pwd  ls  cd  tree  find',
        '  Fichiers     cat  head  tail  touch  mkdir  rm  cp  mv  chmod  stat  file',
        '  Texte        grep  sort  uniq  wc  cut  sed  awk  tr  rev  tac  nl  diff',
        '  Système      echo  date  whoami  env  export  history  clear  which  du  df',
        '  Bootcamp     exercices  verifier  reset  aide',
        '',
        'Opérateurs    |  >  >>  ;   variables $VAR   jokers *.csv',
        '',
      ].join('\n'),
    ),

  aide: (ctx) => COMMANDS.help(ctx) as ExecResult,

  pwd: ({ fs }) => ok(fs.pathOf(fs.cwd) + '\n'),

  cd: ({ fs, args, env }) => {
    const target = args[0] ?? '~'
    const previous = fs.pathOf(fs.cwd)
    const node = fs.resolve(target === '-' ? (env.OLDPWD ?? '~') : target)
    if (!node) return fail(`cd: ${target}: dossier introuvable\n`)
    if (node.kind !== 'dir') return fail(`cd: ${target}: n'est pas un dossier\n`)
    fs.cwd = node
    env.OLDPWD = previous
    env.PWD = fs.pathOf(node)
    return ok()
  },

  ls: ({ fs, args }) => {
    const { flags, rest } = parseFlags(args)
    const targets = rest.length ? rest.flatMap((p) => expandGlob(p, fs)) : ['.']
    const blocks: string[] = []

    for (const target of targets) {
      const node = fs.resolve(target)
      if (!node) {
        blocks.push(`ls: ${target}: fichier ou dossier introuvable`)
        continue
      }
      const entries =
        node.kind === 'dir'
          ? [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name))
          : [node]
      const visible = flags.has('a') ? entries : entries.filter((e) => !e.name.startsWith('.'))
      const sorted = flags.has('t')
        ? [...visible].sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
        : visible
      const ordered = flags.has('r') ? [...sorted].reverse() : sorted

      if (flags.has('l')) {
        const rows = ordered.map((entry) => {
          const size = flags.has('h') ? humanSize(nodeSize(entry)) : String(nodeSize(entry))
          return [
            modeString(entry),
            '1',
            'de',
            'de',
            size.padStart(6),
            shortDate(entry.mtime),
            entry.name + (entry.kind === 'dir' ? '/' : ''),
          ].join(' ')
        })
        blocks.push([`total ${ordered.length}`, ...rows].join('\n'))
      } else {
        blocks.push(
          ordered.map((entry) => entry.name + (entry.kind === 'dir' ? '/' : '')).join('  '),
        )
      }
    }
    const body = blocks.filter(Boolean).join('\n')
    return ok(body ? body + '\n' : '')
  },

  tree: ({ fs, args }) => {
    const root = fs.resolve(args[0] ?? '.')
    if (!root) return fail(`tree: ${args[0]}: introuvable\n`)
    const out: string[] = [fs.displayPath(root)]
    let dirs = 0
    let files = 0

    const walk = (node: FsNode, prefix: string) => {
      const children = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name))
      children.forEach((child, index) => {
        const last = index === children.length - 1
        out.push(`${prefix}${last ? '└── ' : '├── '}${child.name}`)
        if (child.kind === 'dir') {
          dirs++
          walk(child, prefix + (last ? '    ' : '│   '))
        } else {
          files++
        }
      })
    }
    if (root.kind === 'dir') walk(root, '')
    out.push('', `${dirs} dossiers, ${files} fichiers`)
    return ok(out.join('\n') + '\n')
  },

  cat: ({ fs, args, stdin }) => {
    if (!args.length) return ok(stdin)
    const parts: string[] = []
    for (const path of args.flatMap((p) => expandGlob(p, fs))) {
      try {
        parts.push(readNode(fs, path))
      } catch (error) {
        return fail(`cat: ${(error as Error).message}\n`)
      }
    }
    return ok(parts.join(''))
  },

  head: ({ fs, args, stdin }) => {
    const count = Number(flagValue(args, '-n') ?? 10)
    const files = stripFlagPairs(args, ['-n'])
    const text = files.length ? readSafe(fs, files[0]) : stdin
    if (text === null) return fail(`head: ${files[0]}: introuvable\n`)
    return ok(lines(text).slice(0, count).join('\n') + '\n')
  },

  tail: ({ fs, args, stdin }) => {
    const count = Number(flagValue(args, '-n') ?? 10)
    const files = stripFlagPairs(args, ['-n'])
    const text = files.length ? readSafe(fs, files[0]) : stdin
    if (text === null) return fail(`tail: ${files[0]}: introuvable\n`)
    return ok(lines(text).slice(-count).join('\n') + '\n')
  },

  wc: ({ fs, args, stdin }) => {
    const { flags, rest } = parseFlags(args)
    const sources = rest.length
      ? rest.flatMap((p) => expandGlob(p, fs)).map((p) => ({ name: p, text: readSafe(fs, p) }))
      : [{ name: '', text: stdin }]
    const out: string[] = []
    for (const { name, text } of sources) {
      if (text === null) {
        out.push(`wc: ${name}: introuvable`)
        continue
      }
      const l = lines(text).length
      const w = text.split(/\s+/).filter(Boolean).length
      const c = text.length
      const only = flags.has('l') || flags.has('w') || flags.has('c')
      const cols: string[] = []
      if (!only || flags.has('l')) cols.push(String(l))
      if (!only || flags.has('w')) cols.push(String(w))
      if (!only || flags.has('c')) cols.push(String(c))
      out.push(cols.map((v) => v.padStart(6)).join(' ') + (name ? ` ${name}` : ''))
    }
    return ok(out.join('\n') + '\n')
  },

  grep: ({ fs, args, stdin }) => {
    const { flags } = parseFlags(args)
    const positional = stripFlagPairs(args, [])
    const pattern = positional[0]
    if (!pattern) return fail('grep: motif manquant\n')
    const files = positional.slice(1).flatMap((p) => expandGlob(p, fs))
    const regex = new RegExp(pattern, flags.has('i') ? 'i' : '')

    const scan = (text: string, label: string): string[] => {
      const out: string[] = []
      lines(text).forEach((line, index) => {
        const hit = regex.test(line)
        if (hit === flags.has('v')) return
        const prefix = files.length > 1 ? `${label}:` : ''
        out.push(flags.has('n') ? `${prefix}${index + 1}:${line}` : `${prefix}${line}`)
      })
      return out
    }

    let matches: string[] = []
    if (files.length) {
      for (const file of files) {
        const text = readSafe(fs, file)
        if (text === null) return fail(`grep: ${file}: introuvable\n`)
        matches = matches.concat(scan(text, file))
      }
    } else {
      matches = scan(stdin, '')
    }

    if (flags.has('c')) return ok(`${matches.length}\n`)
    return {
      stdout: matches.length ? matches.join('\n') + '\n' : '',
      stderr: '',
      code: matches.length ? 0 : 1,
    }
  },

  sort: ({ fs, args, stdin }) => {
    const { flags, rest } = parseFlags(args)
    const key = Number(flagValue(args, '-k') ?? 0)
    const files = rest.filter((r) => r !== String(key))
    const text = files.length ? readSafe(fs, files[0]) : stdin
    if (text === null) return fail(`sort: ${files[0]}: introuvable\n`)

    let result = lines(text)
    const value = (line: string) => (key ? (line.split(/\s+/)[key - 1] ?? '') : line)
    result.sort((a, b) =>
      flags.has('n')
        ? (parseFloat(value(a)) || 0) - (parseFloat(value(b)) || 0)
        : value(a).localeCompare(value(b)),
    )
    if (flags.has('r')) result.reverse()
    if (flags.has('u')) result = [...new Set(result)]
    return ok(result.join('\n') + '\n')
  },

  uniq: ({ args, stdin }) => {
    const { flags } = parseFlags(args)
    const input = lines(stdin)
    const out: string[] = []
    let previous: string | null = null
    let count = 0
    const flush = () => {
      if (previous === null) return
      if (flags.has('c')) out.push(`${String(count).padStart(7)} ${previous}`)
      else if (!flags.has('d') || count > 1) out.push(previous)
    }
    for (const line of input) {
      if (line === previous) {
        count++
      } else {
        flush()
        previous = line
        count = 1
      }
    }
    flush()
    return ok(out.join('\n') + '\n')
  },

  cut: ({ fs, args, stdin }) => {
    const delimiter = flagValue(args, '-d') ?? '\t'
    const fieldSpec = flagValue(args, '-f') ?? '1'
    const files = stripFlagPairs(args, ['-d', '-f'])
    const text = files.length ? readSafe(fs, files[0]) : stdin
    if (text === null) return fail(`cut: ${files[0]}: introuvable\n`)

    const fields = fieldSpec.split(',').flatMap((part) => {
      if (part.includes('-')) {
        const [from, to] = part.split('-').map(Number)
        return Array.from({ length: to - from + 1 }, (_, i) => from + i)
      }
      return [Number(part)]
    })
    const out = lines(text).map((line) => {
      const cells = line.split(delimiter)
      return fields.map((index) => cells[index - 1] ?? '').join(delimiter)
    })
    return ok(out.join('\n') + '\n')
  },

  sed: ({ fs, args, stdin }) => {
    const script = args.find((arg) => arg.startsWith('s'))
    if (!script) return fail("sed: seule la forme 's/motif/remplacement/[g]' est gérée\n")
    const separator = script[1]
    const [, pattern, replacement, modifiers = ''] = script.split(separator)
    const files = args.filter((arg) => arg !== script && !arg.startsWith('-'))
    const text = files.length ? readSafe(fs, files[0]) : stdin
    if (text === null) return fail(`sed: ${files[0]}: introuvable\n`)
    const regex = new RegExp(pattern, modifiers.includes('g') ? 'g' : '')
    return ok(
      lines(text)
        .map((line) => line.replace(regex, replacement))
        .join('\n') + '\n',
    )
  },

  awk: ({ fs, args, stdin }) => {
    const separator = flagValue(args, '-F')
    const program = args.find((arg) => arg.includes('{')) ?? '{print}'
    const files = stripFlagPairs(args, ['-F']).filter((f) => f !== program)
    const text = files.length ? readSafe(fs, files[0]) : stdin
    if (text === null) return fail(`awk: ${files[0]}: introuvable\n`)

    const body = program.replace(/^.*\{|\}.*$/g, '').trim()
    const condition = program.match(/^([^{]+)\{/)?.[1]?.trim()
    const split = (line: string) =>
      separator ? line.split(separator) : line.split(/\s+/).filter(Boolean)

    const out: string[] = []
    lines(text).forEach((line, index) => {
      const cells = split(line)
      const resolveField = (token: string) => {
        if (token === '$0') return line
        const match = token.match(/^\$(\d+)$/)
        if (match) return cells[Number(match[1]) - 1] ?? ''
        if (token === 'NR') return String(index + 1)
        if (token === 'NF') return String(cells.length)
        return token.replace(/^"|"$/g, '')
      }
      if (condition) {
        const test = condition.replace(/\$(\d+)|NR|NF/g, (token) => `"${resolveField(token)}"`)
        try {
          // eslint-disable-next-line no-new-func
          if (!new Function(`return (${test})`)()) return
        } catch {
          return
        }
      }
      if (!body.startsWith('print')) return
      const items = body.slice(5).trim()
      if (!items) {
        out.push(line)
        return
      }
      out.push(
        items
          .split(',')
          .map((token) => resolveField(token.trim()))
          .join(' '),
      )
    })
    return ok(out.join('\n') + '\n')
  },

  tr: ({ args, stdin }) => {
    const [from, to] = args.filter((a) => !a.startsWith('-'))
    if (!from) return fail('tr: arguments manquants\n')
    if (args.includes('-d')) return ok(stdin.replace(new RegExp(`[${from}]`, 'g'), ''))
    const map = new Map<string, string>()
    ;[...from].forEach((char, index) => map.set(char, to?.[index] ?? to?.[to.length - 1] ?? char))
    return ok([...stdin].map((char) => map.get(char) ?? char).join(''))
  },

  rev: ({ stdin }) =>
    ok(
      lines(stdin)
        .map((line) => [...line].reverse().join(''))
        .join('\n') + '\n',
    ),

  tac: ({ stdin }) => ok(lines(stdin).reverse().join('\n') + '\n'),

  nl: ({ stdin }) =>
    ok(
      lines(stdin)
        .map((line, i) => `${String(i + 1).padStart(6)}\t${line}`)
        .join('\n') + '\n',
    ),

  diff: ({ fs, args }) => {
    const [left, right] = args.filter((a) => !a.startsWith('-'))
    const a = readSafe(fs, left)
    const b = readSafe(fs, right)
    if (a === null || b === null) return fail('diff: fichier introuvable\n')
    const la = lines(a)
    const lb = lines(b)
    const out: string[] = []
    const max = Math.max(la.length, lb.length)
    for (let i = 0; i < max; i++) {
      if (la[i] !== lb[i]) {
        if (la[i] !== undefined) out.push(`< ${la[i]}`)
        if (lb[i] !== undefined) out.push(`> ${lb[i]}`)
      }
    }
    return out.length ? ok(out.join('\n') + '\n') : ok()
  },

  echo: ({ args }) => ok(args.join(' ') + '\n'),

  touch: ({ fs, args }) => {
    for (const path of args) {
      const existing = fs.resolve(path)
      if (existing) existing.mtime = new Date()
      else fs.writeFile(path, '')
    }
    return ok()
  },

  mkdir: ({ fs, args }) => {
    const { flags, rest } = parseFlags(args)
    for (const path of rest) {
      if (!flags.has('p')) {
        const target = fs.resolveParent(path)
        if (!target || target.parent.kind !== 'dir')
          return fail(`mkdir: ${path}: chemin invalide\n`)
        if (target.parent.children.has(target.name)) return fail(`mkdir: ${path}: existe déjà\n`)
      }
      fs.mkdirp(path)
    }
    return ok()
  },

  rm: ({ fs, args }) => {
    const { flags, rest } = parseFlags(args)
    for (const path of rest.flatMap((p) => expandGlob(p, fs))) {
      try {
        fs.remove(path, flags.has('r') || flags.has('R'))
      } catch (error) {
        if (!flags.has('f')) return fail(`rm: ${(error as Error).message}\n`)
      }
    }
    return ok()
  },

  cp: ({ fs, args }) => {
    const { rest } = parseFlags(args)
    const [source, destination] = rest
    const node = fs.resolve(source)
    if (!node) return fail(`cp: ${source}: introuvable\n`)
    const target = fs.resolve(destination)
    if (target?.kind === 'dir') {
      const clone = cloneNode(node, target)
      target.children.set(clone.name, clone)
      return ok()
    }
    if (node.kind === 'dir') return fail(`cp: ${source}: utilise -r pour un dossier\n`)
    fs.writeFile(destination, node.content)
    return ok()
  },

  mv: ({ fs, args }) => {
    const { rest } = parseFlags(args)
    const [source, destination] = rest
    const node = fs.resolve(source)
    if (!node) return fail(`mv: ${source}: introuvable\n`)
    const target = fs.resolve(destination)
    node.parent?.children.delete(node.name)
    if (target?.kind === 'dir') {
      node.parent = target
      target.children.set(node.name, node)
      return ok()
    }
    const parentInfo = fs.resolveParent(destination)
    if (!parentInfo) return fail(`mv: ${destination}: chemin invalide\n`)
    node.name = parentInfo.name
    node.parent = parentInfo.parent
    parentInfo.parent.children.set(node.name, node)
    return ok()
  },

  chmod: ({ fs, args }) => {
    const [mode, ...paths] = args.filter((a) => !a.startsWith('-'))
    const parsed = parseInt(mode, 8)
    if (Number.isNaN(parsed)) return fail(`chmod: ${mode}: mode invalide (utilise 755, 644…)\n`)
    for (const path of paths.flatMap((p) => expandGlob(p, fs))) {
      const node = fs.resolve(path)
      if (!node) return fail(`chmod: ${path}: introuvable\n`)
      node.mode = parsed
    }
    return ok()
  },

  stat: ({ fs, args }) => {
    const node = fs.resolve(args[0] ?? '.')
    if (!node) return fail(`stat: ${args[0]}: introuvable\n`)
    return ok(
      [
        `  Fichier : ${fs.pathOf(node)}`,
        `   Taille : ${nodeSize(node)}\tType : ${node.kind === 'dir' ? 'dossier' : 'fichier'}`,
        `   Accès  : (${(node.mode & 0o777).toString(8).padStart(4, '0')}/${modeString(node)})  UID: (1000/de)`,
        `Modifié   : ${node.mtime.toISOString()}`,
        '',
      ].join('\n'),
    )
  },

  file: ({ fs, args }) => {
    const node = fs.resolve(args[0] ?? '.')
    if (!node) return fail(`file: ${args[0]}: introuvable\n`)
    if (node.kind === 'dir') return ok(`${args[0]}: directory\n`)
    const kind = node.name.endsWith('.csv')
      ? 'CSV text'
      : node.name.endsWith('.py')
        ? 'Python script, ASCII text'
        : node.name.endsWith('.sh')
          ? 'Bourne-Again shell script, ASCII text executable'
          : node.name.endsWith('.md')
            ? 'Markdown document, UTF-8 text'
            : 'ASCII text'
    return ok(`${args[0]}: ${kind}\n`)
  },

  find: ({ fs, args }) => {
    const start = args.find((a) => !a.startsWith('-')) ?? '.'
    const namePattern = flagValue(args, '-name')
    const typeFilter = flagValue(args, '-type')
    const root = fs.resolve(start)
    if (!root) return fail(`find: ${start}: introuvable\n`)
    const regex = namePattern ? globToRegex(namePattern.replace(/^["']|["']$/g, '')) : null

    const out: string[] = []
    for (const { node } of fs.walk(root)) {
      if (regex && !regex.test(node.name)) continue
      if (typeFilter === 'f' && node.kind !== 'file') continue
      if (typeFilter === 'd' && node.kind !== 'dir') continue
      const full = fs.pathOf(node)
      const rootPath = fs.pathOf(root)
      out.push(start === '.' ? '.' + full.slice(rootPath.length) : full)
    }
    return ok(out.join('\n') + '\n')
  },

  du: ({ fs, args }) => {
    const root = fs.resolve(args.find((a) => !a.startsWith('-')) ?? '.')
    if (!root) return fail('du: introuvable\n')
    const out: string[] = []
    const size = (node: FsNode): number => {
      if (node.kind === 'file') return node.content.length
      let total = 0
      for (const child of node.children.values()) total += size(child)
      out.push(`${Math.max(4, Math.ceil(total / 1024))}\t${fs.displayPath(node)}`)
      return total
    }
    size(root)
    return ok(out.join('\n') + '\n')
  },

  df: () =>
    ok(
      [
        'Sys. de fichiers Taille Utilisé Dispo Uti% Monté sur',
        'browserfs           512M     18M  494M   4% /',
        '',
      ].join('\n'),
    ),

  date: () => ok(new Date().toString() + '\n'),
  whoami: () => ok('de\n'),
  hostname: () => ok('bootcamp-de\n'),

  env: ({ env }) =>
    ok(
      Object.entries(env)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n',
    ),

  export: ({ args, env }) => {
    for (const arg of args) {
      const [key, ...value] = arg.split('=')
      if (key) env[key] = value.join('=')
    }
    return ok()
  },

  which: ({ args }) =>
    args[0] && args[0] in COMMANDS
      ? ok(`/usr/bin/${args[0]}\n`)
      : fail(`which: ${args[0]}: introuvable\n`, 1),

  history: ({ history }) =>
    ok(history.map((line, index) => `${String(index + 1).padStart(5)}  ${line}`).join('\n') + '\n'),

  man: ({ args }) => {
    const page = MAN_PAGES[args[0]]
    return page ? ok(page + '\n') : fail(`man: pas de page pour « ${args[0] ?? ''} »\n`)
  },

  python3: () =>
    ok(
      "Le terminal ne lance pas Python. Ouvre l'onglet « Python » de l'atelier pour exécuter du vrai code.\n",
    ),
  python: (ctx) => COMMANDS.python3(ctx) as ExecResult,

  clear: () => ok('\x1bc'),
}

const MAN_PAGES: Record<string, string> = {
  grep: [
    'GREP(1)',
    '',
    'NOM      grep — filtrer les lignes correspondant à un motif',
    'SYNOPSIS grep [-i] [-v] [-n] [-c] MOTIF [FICHIER…]',
    '',
    '  -i  ignorer la casse       -v  inverser la sélection',
    '  -n  afficher le numéro     -c  compter les correspondances',
    '',
    'EXEMPLE  grep ERROR /var/log/pipeline.log',
  ].join('\n'),
  ls: [
    'LS(1)',
    '',
    'NOM      ls — lister le contenu d’un dossier',
    'SYNOPSIS ls [-l] [-a] [-h] [-t] [-r] [CHEMIN…]',
    '',
    '  -l  format long   -a  inclure les fichiers cachés',
    '  -h  tailles lisibles   -t  trier par date   -r  inverser',
  ].join('\n'),
  sort: [
    'SORT(1)',
    '',
    'NOM      sort — trier des lignes',
    'SYNOPSIS sort [-n] [-r] [-u] [-k N] [FICHIER]',
    '',
    '  -n  tri numérique   -r  ordre décroissant',
    '  -u  supprimer les doublons   -k  trier sur la Nième colonne',
  ].join('\n'),
  cut: [
    'CUT(1)',
    '',
    'NOM      cut — extraire des colonnes',
    'SYNOPSIS cut -d DELIM -f CHAMPS [FICHIER]',
    '',
    'EXEMPLE  cut -d, -f3,5 data/raw/ventes.csv',
  ].join('\n'),
  awk: [
    'AWK(1)',
    '',
    'NOM      awk — traitement de texte par colonnes',
    "SYNOPSIS awk [-F DELIM] '[CONDITION] {print $1, $3}' [FICHIER]",
    '',
    "EXEMPLE  awk -F, '{print $3, $5}' data/raw/ventes.csv",
  ].join('\n'),
}

function readSafe(fs: VirtualFs, path: string): string | null {
  try {
    return readNode(fs, path)
  } catch {
    return null
  }
}

function cloneNode(node: FsNode, parent: FsNode): FsNode {
  const copy = createNode(node.name, node.kind, { content: node.content, mode: node.mode, parent })
  for (const child of node.children.values()) {
    copy.children.set(child.name, cloneNode(child, copy))
  }
  return copy
}

/* ---------------------------------------------------------------- shell */

export class Shell {
  fs: VirtualFs
  env: Record<string, string>
  history: string[] = []
  /** Commands registered by the host app (exercises, reset…). */
  extensions: Record<string, CommandFn> = {}

  constructor() {
    this.fs = new VirtualFs()
    this.env = {
      USER: 'de',
      HOME: '/home/de',
      PWD: '/home/de',
      SHELL: '/bin/bash',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      LANG: 'fr_FR.UTF-8',
    }
  }

  get prompt(): string {
    return `de@bootcamp:${this.fs.displayPath()}$ `
  }

  completions(partial: string): string[] {
    const words = partial.split(/\s+/)
    const last = words[words.length - 1] ?? ''
    if (words.length <= 1) {
      const names = [...Object.keys(COMMANDS), ...Object.keys(this.extensions)]
      return names.filter((name) => name.startsWith(last)).sort()
    }
    const slash = last.lastIndexOf('/')
    const dirPath = slash >= 0 ? last.slice(0, slash) || '/' : '.'
    const prefix = slash >= 0 ? last.slice(slash + 1) : last
    const dir = this.fs.resolve(dirPath)
    if (!dir || dir.kind !== 'dir') return []
    return [...dir.children.keys()]
      .filter((name) => name.startsWith(prefix))
      .sort()
      .map((name) => (slash >= 0 ? `${dirPath}/${name}` : name))
  }

  async run(input: string): Promise<ExecResult> {
    const trimmed = input.trim()
    if (!trimmed) return ok()
    this.history.push(trimmed)

    let aggregate: ExecResult = ok()
    for (const statement of splitStatements(trimmed)) {
      aggregate = await this.runStatement(statement)
    }
    return aggregate
  }

  private async runStatement(statement: string): Promise<ExecResult> {
    const tokens = tokenize(statement)
    const segments: Token[][] = [[]]
    let redirect: { mode: '>' | '>>'; target: string } | null = null

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (!token.quoted && token.value === '|') {
        segments.push([])
        continue
      }
      if (!token.quoted && (token.value === '>' || token.value === '>>')) {
        const target = tokens[++i]
        if (!target) return fail('syntaxe : fichier de redirection manquant\n')
        redirect = { mode: token.value as '>' | '>>', target: target.value }
        continue
      }
      segments[segments.length - 1].push(token)
    }

    let stdin = ''
    let result: ExecResult = ok()

    for (const segment of segments) {
      const expanded = segment.flatMap((token) => {
        // Single quotes suppress expansion; double quotes keep variables but no globbing.
        const value = token.raw ? token.value : expandVariables(token.value, this.env)
        return token.quoted ? [value] : expandGlob(value, this.fs)
      })
      if (!expanded.length) continue

      const [name, ...args] = expanded
      const command = this.extensions[name] ?? COMMANDS[name]
      if (!command) {
        return fail(`${name} : commande introuvable. Tape « help » pour la liste.\n`, 127)
      }
      try {
        result = await command({
          fs: this.fs,
          env: this.env,
          history: this.history,
          stdin,
          args,
          shell: this,
        })
      } catch (error) {
        return fail(`${name}: ${(error as Error).message}\n`)
      }
      stdin = result.stdout
    }

    if (redirect) {
      const previous = redirect.mode === '>>' ? (readSafe(this.fs, redirect.target) ?? '') : ''
      this.fs.writeFile(redirect.target, previous + result.stdout)
      return { ...result, stdout: '' }
    }
    return result
  }
}

function splitStatements(input: string): string[] {
  const out: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false
  for (const char of input) {
    if (char === "'" && !inDouble) inSingle = !inSingle
    if (char === '"' && !inSingle) inDouble = !inDouble
    if (char === ';' && !inSingle && !inDouble) {
      out.push(current)
      current = ''
      continue
    }
    current += char
  }
  out.push(current)
  return out.map((s) => s.trim()).filter(Boolean)
}

export { COMMANDS, ok as shellOk, fail as shellFail }
export type { CommandFn, Context as ShellContext }
