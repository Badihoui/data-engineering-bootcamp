/**
 * A real terminal (xterm.js) wired to the in-browser bash interpreter.
 *
 * Handles line editing, history, tab completion and Ctrl-C/Ctrl-L the way a
 * learner expects, then hands the line to `Shell.run`.
 */

import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'

import { Shell } from '@/lib/playground/shell'

const THEME = {
  background: '#0b1020',
  foreground: '#dbe4f4',
  cursor: '#38bdf8',
  cursorAccent: '#0b1020',
  selectionBackground: '#264663',
  black: '#0b1020',
  red: '#ff7b72',
  green: '#7ee787',
  yellow: '#ffd580',
  blue: '#79c0ff',
  magenta: '#c792ea',
  cyan: '#38bdf8',
  white: '#dbe4f4',
  brightBlack: '#5c6b84',
  brightRed: '#ffa198',
  brightGreen: '#a5f3a0',
  brightYellow: '#ffe1a8',
  brightBlue: '#a5d6ff',
  brightMagenta: '#d9b3ff',
  brightCyan: '#8ee0ff',
  brightWhite: '#ffffff',
}

const BANNER = [
  '\x1b[38;5;39m',
  '  ╭──────────────────────────────────────────────────────────╮',
  '  │  Terminal du bootcamp — bash simulé, 100 % navigateur    │',
  '  ╰──────────────────────────────────────────────────────────╯',
  '\x1b[0m',
  '  Tape \x1b[1mhelp\x1b[0m pour les commandes, \x1b[1mexercices\x1b[0m pour les défis guidés.',
  '',
]

export interface ShellTerminalHandle {
  runCommand: (command: string) => void
  focus: () => void
  clear: () => void
}

interface Props {
  shell: Shell
  /** Called after every command with the produced output. */
  onCommand?: (command: string, output: string) => void
  height?: number
}

export const ShellTerminal = forwardRef<ShellTerminalHandle, Props>(function ShellTerminal(
  { shell, onCommand, height = 420 },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const bufferRef = useRef('')
  const cursorRef = useRef(0)
  const historyIndexRef = useRef(-1)
  const busyRef = useRef(false)
  const onCommandRef = useRef(onCommand)
  onCommandRef.current = onCommand

  const writePrompt = useCallback(() => {
    const term = termRef.current
    if (!term) return
    term.write(
      `\r\n\x1b[38;5;79mde@bootcamp\x1b[0m:\x1b[38;5;39m${shell.fs.displayPath()}\x1b[0m$ `,
    )
  }, [shell])

  const redrawLine = useCallback(() => {
    const term = termRef.current
    if (!term) return
    const prompt = `de@bootcamp:${shell.fs.displayPath()}$ `
    term.write('\x1b[2K\r')
    term.write(`\x1b[38;5;79mde@bootcamp\x1b[0m:\x1b[38;5;39m${shell.fs.displayPath()}\x1b[0m$ `)
    term.write(bufferRef.current)
    const back = bufferRef.current.length - cursorRef.current
    if (back > 0) term.write(`\x1b[${back}D`)
    void prompt
  }, [shell])

  const submit = useCallback(async () => {
    const term = termRef.current
    if (!term) return
    const command = bufferRef.current
    bufferRef.current = ''
    cursorRef.current = 0
    historyIndexRef.current = -1
    term.write('\r\n')

    if (!command.trim()) {
      writePrompt()
      return
    }

    busyRef.current = true
    const result = await shell.run(command)
    busyRef.current = false

    if (result.stdout === '\x1bc') {
      term.clear()
      term.write('\x1b[H')
    } else {
      if (result.stdout) term.write(result.stdout.replace(/\n/g, '\r\n'))
      if (result.stderr) term.write(`\x1b[38;5;203m${result.stderr.replace(/\n/g, '\r\n')}\x1b[0m`)
    }
    onCommandRef.current?.(command, result.stdout + result.stderr)

    // `writePrompt` starts with \r\n; avoid a blank line when output already ended with one.
    const needsBreak = !(result.stdout + result.stderr).endsWith('\n')
    if (!needsBreak) {
      term.write(`\x1b[38;5;79mde@bootcamp\x1b[0m:\x1b[38;5;39m${shell.fs.displayPath()}\x1b[0m$ `)
    } else {
      writePrompt()
    }
  }, [shell, writePrompt])

  useEffect(() => {
    if (!hostRef.current) return
    const term = new Terminal({
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: THEME,
      convertEol: false,
      scrollback: 4000,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current)
    termRef.current = term
    fitRef.current = fit

    // `fit()` échoue si l'hôte n'a pas encore de dimensions — ce qui arrive au
    // montage, avant que le navigateur ait calculé la mise en page. L'échec
    // était silencieux et laissait un terminal de taille nulle, invisible
    // jusqu'au prochain redimensionnement (d'où « il faut recharger la page »).
    // On réessaie donc sur quelques frames tant que la taille est nulle.
    let attempts = 0
    let rafId = 0
    const fitWhenSized = () => {
      const host = hostRef.current
      if (!host) return
      if (host.clientWidth > 0 && host.clientHeight > 0) {
        try {
          fit.fit()
        } catch {
          /* le terminal a pu être détruit entre-temps */
        }
        return
      }
      if (attempts++ < 30) rafId = requestAnimationFrame(fitWhenSized)
    }
    fitWhenSized()

    BANNER.forEach((line) => term.writeln(line))
    term.write(`\x1b[38;5;79mde@bootcamp\x1b[0m:\x1b[38;5;39m${shell.fs.displayPath()}\x1b[0m$ `)

    const disposable = term.onData((data) => {
      if (busyRef.current) return
      const buffer = bufferRef.current
      const cursor = cursorRef.current

      switch (data) {
        case '\r':
          void submit()
          return
        case '\u0003': // Ctrl-C
          term.write('^C')
          bufferRef.current = ''
          cursorRef.current = 0
          writePrompt()
          return
        case '\u000c': // Ctrl-L
          term.clear()
          redrawLine()
          return
        case '\u0001': // Ctrl-A
          cursorRef.current = 0
          redrawLine()
          return
        case '\u0005': // Ctrl-E
          cursorRef.current = buffer.length
          redrawLine()
          return
        case '\u0015': // Ctrl-U
          bufferRef.current = buffer.slice(cursor)
          cursorRef.current = 0
          redrawLine()
          return
        case '\u007f': // Backspace
          if (cursor > 0) {
            bufferRef.current = buffer.slice(0, cursor - 1) + buffer.slice(cursor)
            cursorRef.current = cursor - 1
            redrawLine()
          }
          return
        case '\u001b[A': {
          // Up
          const history = shell.history
          if (!history.length) return
          historyIndexRef.current =
            historyIndexRef.current < 0
              ? history.length - 1
              : Math.max(0, historyIndexRef.current - 1)
          bufferRef.current = history[historyIndexRef.current] ?? ''
          cursorRef.current = bufferRef.current.length
          redrawLine()
          return
        }
        case '\u001b[B': {
          // Down
          const history = shell.history
          if (historyIndexRef.current < 0) return
          historyIndexRef.current += 1
          if (historyIndexRef.current >= history.length) {
            historyIndexRef.current = -1
            bufferRef.current = ''
          } else {
            bufferRef.current = history[historyIndexRef.current] ?? ''
          }
          cursorRef.current = bufferRef.current.length
          redrawLine()
          return
        }
        case '\u001b[C': // Right
          if (cursor < buffer.length) {
            cursorRef.current = cursor + 1
            term.write('\x1b[C')
          }
          return
        case '\u001b[D': // Left
          if (cursor > 0) {
            cursorRef.current = cursor - 1
            term.write('\x1b[D')
          }
          return
        case '\t': {
          const matches = shell.completions(buffer)
          if (matches.length === 1) {
            const words = buffer.split(/\s+/)
            words[words.length - 1] = matches[0]
            bufferRef.current = words.join(' ')
            cursorRef.current = bufferRef.current.length
            redrawLine()
          } else if (matches.length > 1) {
            term.write('\r\n' + matches.join('  '))
            writePrompt()
            term.write(buffer)
          }
          return
        }
        default:
          if (data >= ' ' || data === '\u00a0') {
            bufferRef.current = buffer.slice(0, cursor) + data + buffer.slice(cursor)
            cursorRef.current = cursor + data.length
            if (cursor === buffer.length) term.write(data)
            else redrawLine()
          }
      }
    })

    const observer = new ResizeObserver(() => {
      try {
        fit.fit()
      } catch {
        /* the host may be hidden */
      }
    })
    observer.observe(hostRef.current)

    return () => {
      cancelAnimationFrame(rafId)
      disposable.dispose()
      observer.disconnect()
      term.dispose()
      termRef.current = null
    }
  }, [shell, submit, redrawLine, writePrompt])

  useImperativeHandle(ref, () => ({
    runCommand(command: string) {
      const term = termRef.current
      if (!term || busyRef.current) return
      bufferRef.current = command
      cursorRef.current = command.length
      redrawLine()
      void submit()
    },
    focus() {
      termRef.current?.focus()
    },
    clear() {
      termRef.current?.clear()
    },
  }))

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--border)', background: '#0b1020' }}
    >
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: '#1c2740' }}
      >
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="ml-1 font-mono text-[0.7rem] text-slate-400">de@bootcamp — bash</span>
      </div>
      <div ref={hostRef} style={{ height }} className="px-2 py-2" />
    </div>
  )
})
