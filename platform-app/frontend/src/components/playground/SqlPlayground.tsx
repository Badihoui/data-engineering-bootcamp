import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Database, Loader2, Play, RotateCcw, Table2, Timer, Wand2 } from 'lucide-react'

import { CodeEditor } from './CodeEditor'
import { Button, Card, Pill, cx } from '@/components/ui'
import { DATASETS } from '@/lib/playground/datasets'
import { SqlSession, type QueryResult } from '@/lib/playground/sqlEngine'

function formatCell(value: string | number | null | Uint8Array): string {
  if (value === null) return 'NULL'
  if (value instanceof Uint8Array) return `<${value.length} octets>`
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  return value
}

function ResultTable({ result }: { result: QueryResult }) {
  if (!result.columns.length) {
    return (
      <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Requête exécutée — {result.rowsAffected} ligne(s) affectée(s).
      </p>
    )
  }
  return (
    <div className="overflow-auto" style={{ maxHeight: 340 }}>
      <table className="w-full text-left text-[0.82rem]">
        <thead className="sticky top-0" style={{ background: 'var(--surface-3)' }}>
          <tr>
            {result.columns.map((column) => (
              <th key={column} className="px-3 py-2 font-semibold whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIndex) => (
            <motion.tr
              key={rowIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(rowIndex * 0.012, 0.25) }}
              style={{ background: rowIndex % 2 ? 'var(--surface-2)' : 'transparent' }}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border-t px-3 py-1.5 font-mono whitespace-nowrap"
                  style={{
                    borderColor: 'var(--border)',
                    color: cell === null ? 'var(--text-muted)' : undefined,
                  }}
                >
                  {formatCell(cell)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SqlPlayground({ initialCode }: { initialCode?: string }) {
  const sessionRef = useRef<SqlSession | null>(null)
  const [datasetId, setDatasetId] = useState(DATASETS[0].id)
  const [query, setQuery] = useState(initialCode || DATASETS[0].samples[1].query)
  const [results, setResults] = useState<QueryResult[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [schema, setSchema] = useState<Record<string, string[]>>({})

  const dataset = useMemo(
    () => DATASETS.find((d) => d.id === datasetId) ?? DATASETS[0],
    [datasetId],
  )

  const loadSchema = useCallback(async (session: SqlSession) => {
    const tables = await session.schema()
    setSchema(Object.fromEntries(tables.map((t) => [t.table, t.columns.map((c) => c.name)])))
  }, [])

  useEffect(() => {
    let cancelled = false
    setReady(false)
    const session = sessionRef.current ?? new SqlSession(datasetId)
    sessionRef.current = session
    session
      .open(datasetId)
      .then(() => loadSchema(session))
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })
    return () => {
      cancelled = true
    }
  }, [datasetId, loadSchema])

  const run = useCallback(async () => {
    const session = sessionRef.current
    if (!session || busy) return
    setBusy(true)
    setError('')
    try {
      setResults(await session.exec(query))
    } catch (err) {
      setResults([])
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }, [busy, query])

  const reset = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return
    setBusy(true)
    await session.reset()
    await loadSchema(session)
    setResults([])
    setError('')
    setBusy(false)
  }, [loadSchema])

  const totalRows = results.reduce((sum, r) => sum + r.rows.length, 0)
  const elapsed = results[0]?.elapsedMs ?? 0

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {DATASETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDatasetId(item.id)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
              style={{
                borderColor: datasetId === item.id ? 'var(--accent)' : 'var(--border)',
                color: datasetId === item.id ? 'var(--accent)' : 'var(--text-muted)',
                background: datasetId === item.id ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <Database size={11} className="mr-1 inline" />
              {item.name}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={reset} disabled={busy}>
              <RotateCcw size={14} /> Réinitialiser
            </Button>
            <Button onClick={run} disabled={busy || !ready}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Exécuter
              <kbd className="ml-1 rounded px-1 text-[0.65rem] opacity-60">⌘↵</kbd>
            </Button>
          </span>
        </div>

        <CodeEditor
          value={query}
          onChange={setQuery}
          language="sql"
          height="220px"
          schema={schema}
          onRun={run}
        />

        <Card className="overflow-hidden">
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Table2 size={14} style={{ color: 'var(--accent)' }} />
              Résultat
            </span>
            {results.length > 0 && !error && (
              <span
                className="flex items-center gap-3 text-xs tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>{totalRows} ligne(s)</span>
                <span className="flex items-center gap-1">
                  <Timer size={11} /> {elapsed.toFixed(1)} ms
                </span>
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {error ? (
              <motion.pre
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="px-4 py-4 font-mono text-sm"
                style={{ color: '#f87171' }}
              >
                {error}
              </motion.pre>
            ) : !ready ? (
              <motion.p
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 px-4 py-6 text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                <Loader2 size={14} className="animate-spin" /> Chargement de SQLite (WebAssembly)…
              </motion.p>
            ) : results.length === 0 ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-6 text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Écris une requête puis lance-la avec ⌘↵.
              </motion.p>
            ) : (
              <motion.div key="rows" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {results.map((result, index) => (
                  <ResultTable key={index} result={result} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {/* ------------------------------------------------------------ aside */}
      <aside className="space-y-4">
        <Card className="p-4">
          <h3 className="mb-1 text-sm font-semibold">{dataset.name}</h3>
          <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {dataset.description}
          </p>
          <ul className="space-y-2.5">
            {dataset.tables.map((table) => (
              <li key={table.name}>
                <button
                  type="button"
                  onClick={() => setQuery(`SELECT * FROM ${table.name} LIMIT 20;`)}
                  className="w-full text-left"
                >
                  <span className="flex items-center justify-between">
                    <span className="font-mono text-[0.78rem] font-medium">{table.name}</span>
                    <Pill>{table.rows}</Pill>
                  </span>
                  <span
                    className="mt-0.5 block font-mono text-[0.68rem] leading-relaxed"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {table.columns.join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Wand2 size={13} style={{ color: 'var(--accent)' }} /> Requêtes d'exemple
          </h3>
          <ul className="space-y-1.5">
            {dataset.samples.map((sample) => (
              <li key={sample.title}>
                <button
                  type="button"
                  onClick={() => setQuery(sample.query)}
                  className={cx(
                    'w-full rounded-lg px-2.5 py-2 text-left text-[0.78rem] transition hover:brightness-110',
                  )}
                  style={{ background: 'var(--surface-2)' }}
                >
                  {sample.title}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  )
}
