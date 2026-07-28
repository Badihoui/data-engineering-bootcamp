import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleAlert, Loader2, Play, Sparkles, Square, Timer, Trash2 } from 'lucide-react'

import { CodeEditor } from './CodeEditor'
import { Button, Card, cx } from '@/components/ui'
import { PYTHON_SNIPPETS } from '@/lib/playground/pythonFixtures'
import { runPython } from '@/lib/playground/pythonEngine'

interface Line {
  text: string
  stream: 'stdout' | 'stderr' | 'meta'
}

export function PythonPlayground({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode || PYTHON_SNIPPETS[0].code)
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [elapsed, setElapsed] = useState<number | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  const append = useCallback((text: string, stream: Line['stream']) => {
    setLines((previous) => [...previous, { text, stream }])
    requestAnimationFrame(() => {
      outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
    })
  }, [])

  const run = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setLines([])
    setElapsed(null)
    setStatus('Préparation…')
    try {
      const output = await runPython(code, {
        onProgress: setStatus,
        onStream: (chunk, stream) => append(chunk, stream),
      })
      setStatus('')
      setElapsed(output.elapsedMs)
      if (output.result) append(output.result, 'meta')
      if (!output.stdout && !output.stderr && !output.result) {
        append('(aucune sortie)', 'meta')
      }
    } catch (error) {
      setStatus('')
      append((error as Error).message, 'stderr')
    } finally {
      setBusy(false)
    }
  }, [append, busy, code])

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_250px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Python 3.13 · Pyodide (WebAssembly)</span>
          <span className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={() => setLines([])} disabled={busy}>
              <Trash2 size={14} /> Effacer
            </Button>
            <Button onClick={run} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Exécuter
              <kbd className="ml-1 rounded px-1 text-[0.65rem] opacity-60">⌘↵</kbd>
            </Button>
          </span>
        </div>

        <CodeEditor value={code} onChange={setCode} language="python" height="300px" onRun={run} />

        <Card className="overflow-hidden">
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Square size={12} style={{ color: 'var(--accent)' }} /> Sortie
            </span>
            <AnimatePresence>
              {status && (
                <motion.span
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Loader2 size={11} className="animate-spin" />
                  {status}
                </motion.span>
              )}
              {elapsed !== null && !status && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1 text-xs tabular-nums"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Timer size={11} /> {elapsed.toFixed(0)} ms
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div
            ref={outputRef}
            className="overflow-auto px-4 py-3 font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap"
            style={{ background: '#0b1020', color: '#dbe4f4', minHeight: 140, maxHeight: 320 }}
          >
            {lines.length === 0 && !status ? (
              <span style={{ color: '#5c6b84' }}>
                La première exécution télécharge l’interpréteur (~10 Mo), les suivantes sont
                instantanées.
              </span>
            ) : (
              lines.map((line, index) => (
                <span
                  key={index}
                  style={{
                    color:
                      line.stream === 'stderr'
                        ? '#ff7b72'
                        : line.stream === 'meta'
                          ? '#7ee787'
                          : undefined,
                  }}
                >
                  {line.text}
                </span>
              ))
            )}
          </div>
        </Card>

        <p className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <CircleAlert size={13} className="mt-0.5 shrink-0" />
          Les fichiers <code className="font-mono">data/ventes.csv</code> et{' '}
          <code className="font-mono">data/clients.csv</code> sont montés dans l’espace de travail.
          numpy, pandas, matplotlib et pyarrow s’installent automatiquement à la détection d’un
          import.
        </p>
      </div>

      <aside>
        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={13} style={{ color: 'var(--accent)' }} /> Exemples
          </h3>
          <ul className="space-y-1.5">
            {PYTHON_SNIPPETS.map((snippet) => (
              <li key={snippet.title}>
                <button
                  type="button"
                  onClick={() => setCode(snippet.code)}
                  className={cx(
                    'w-full rounded-lg px-2.5 py-2 text-left transition hover:brightness-110',
                  )}
                  style={{ background: 'var(--surface-2)' }}
                >
                  <span className="block text-[0.78rem] font-medium">{snippet.title}</span>
                  <span className="block text-[0.68rem]" style={{ color: 'var(--text-muted)' }}>
                    {snippet.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  )
}
