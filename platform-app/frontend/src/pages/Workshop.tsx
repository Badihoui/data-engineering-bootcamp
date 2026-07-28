import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  ChevronRight,
  Database,
  Eye,
  Lightbulb,
  Play,
  RotateCcw,
  TerminalSquare,
  Trophy,
} from 'lucide-react'

import { PythonPlayground } from '@/components/playground/PythonPlayground'
import { ShellTerminal, type ShellTerminalHandle } from '@/components/playground/ShellTerminal'
import { SqlPlayground } from '@/components/playground/SqlPlayground'
import { Button, Card, Pill, ProgressBar, cx } from '@/components/ui'
import { Shell } from '@/lib/playground/shell'
import { SHELL_CHALLENGES } from '@/lib/playground/shellExercises'
import { useWorkshop } from '@/store/workshop'

type Tab = 'shell' | 'sql' | 'python'

const TABS: { id: Tab; label: string; icon: typeof TerminalSquare; hint: string }[] = [
  { id: 'shell', label: 'Terminal', icon: TerminalSquare, hint: 'bash · modules 02, 03' },
  { id: 'sql', label: 'SQL', icon: Database, hint: 'SQLite · modules 06, 07, 20' },
  { id: 'python', label: 'Python', icon: Play, hint: 'pandas · modules 04, 05, 17' },
]

/* --------------------------------------------------------------- shell tab */

function ShellWorkshop({ initialCommand }: { initialCommand?: string }) {
  const shell = useMemo(() => new Shell(), [])
  const terminalRef = useRef<ShellTerminalHandle>(null)
  const [solved, setSolved] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState(SHELL_CHALLENGES[0].id)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [justSolved, setJustSolved] = useState<string | null>(null)

  const percent = Math.round((solved.size / SHELL_CHALLENGES.length) * 100)

  // A snippet sent from a lesson is typed into the terminal, not executed —
  // the learner stays in control of when it runs.
  useEffect(() => {
    if (!initialCommand) return
    const firstLine = initialCommand
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'))
    if (firstLine) {
      const timer = setTimeout(() => terminalRef.current?.runCommand(firstLine), 400)
      return () => clearTimeout(timer)
    }
  }, [initialCommand])

  const handleCommand = useCallback(
    (_command: string, output: string) => {
      const newlySolved = SHELL_CHALLENGES.filter(
        (challenge) => !solved.has(challenge.id) && challenge.check(shell, output),
      )
      if (!newlySolved.length) return
      setSolved((previous) => new Set([...previous, ...newlySolved.map((c) => c.id)]))
      setJustSolved(newlySolved[0].id)
      setTimeout(() => setJustSolved(null), 2200)
      // Advance to the next unsolved challenge.
      const next = SHELL_CHALLENGES.find(
        (c) => !solved.has(c.id) && !newlySolved.some((n) => n.id === c.id),
      )
      if (next) setActiveId(next.id)
    },
    [shell, solved],
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-3">
        <ShellTerminal ref={terminalRef} shell={shell} onCommand={handleCommand} height={440} />
        <div className="flex flex-wrap gap-2">
          {['ls -lh', 'cat README.md', 'tree', 'grep ERROR /var/log/pipeline.log', 'help'].map(
            (command) => (
              <button
                key={command}
                type="button"
                onClick={() => terminalRef.current?.runCommand(command)}
                className="rounded-lg border px-2.5 py-1.5 font-mono text-[0.72rem] transition hover:brightness-110"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                {command}
              </button>
            ),
          )}
        </div>
      </div>

      {/* -------------------------------------------------------- challenges */}
      <aside className="space-y-3">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Trophy size={14} style={{ color: '#facc15' }} /> Défis guidés
            </h3>
            <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {solved.size}/{SHELL_CHALLENGES.length}
            </span>
          </div>
          <ProgressBar percent={percent} height={5} />
        </Card>

        <div className="space-y-2">
          {SHELL_CHALLENGES.map((challenge, index) => {
            const done = solved.has(challenge.id)
            const open = challenge.id === activeId
            return (
              <motion.div
                key={challenge.id}
                layout
                animate={
                  justSolved === challenge.id
                    ? { scale: [1, 1.03, 1], transition: { duration: 0.45 } }
                    : {}
                }
              >
                <Card className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveId(open ? '' : challenge.id)}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                  >
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[0.65rem] font-bold"
                      style={{
                        background: done ? '#34d399' : 'var(--surface-3)',
                        color: done ? '#04121d' : 'var(--text-muted)',
                      }}
                    >
                      {done ? <Check size={12} /> : index + 1}
                    </span>
                    <span
                      className={cx('flex-1 text-[0.82rem] font-medium', done && 'line-through')}
                      style={done ? { color: 'var(--text-muted)' } : undefined}
                    >
                      {challenge.title}
                    </span>
                    <ChevronRight
                      size={14}
                      className="transition-transform"
                      style={{
                        transform: open ? 'rotate(90deg)' : 'none',
                        color: 'var(--text-muted)',
                      }}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div
                          className="space-y-3 border-t px-3.5 py-3"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <p className="text-[0.82rem]">{challenge.brief}</p>
                          <p
                            className="flex items-start gap-1.5 text-[0.75rem]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Lightbulb size={12} className="mt-0.5 shrink-0" />
                            {challenge.hint}
                          </p>
                          {revealed.has(challenge.id) ? (
                            <div className="flex items-center gap-2">
                              <code
                                className="flex-1 rounded-lg px-2.5 py-1.5 font-mono text-[0.72rem]"
                                style={{ background: '#0b1020', color: '#7ee787' }}
                              >
                                {challenge.solution}
                              </code>
                              <button
                                type="button"
                                onClick={() => terminalRef.current?.runCommand(challenge.solution)}
                                aria-label="Exécuter la solution"
                                className="rounded-lg border p-1.5"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                <Play size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setRevealed((previous) => new Set([...previous, challenge.id]))
                              }
                              className="flex items-center gap-1.5 text-[0.75rem]"
                              style={{ color: 'var(--accent)' }}
                            >
                              <Eye size={12} /> Voir la solution
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {solved.size > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSolved(new Set())
              setRevealed(new Set())
              setActiveId(SHELL_CHALLENGES[0].id)
            }}
          >
            <RotateCcw size={14} /> Recommencer les défis
          </Button>
        )}
      </aside>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

export function Workshop() {
  const [tab, setTab] = useState<Tab>('shell')
  const consume = useWorkshop((s) => s.consume)
  const [snippet, setSnippet] = useState<{ code: string; origin?: { label: string; path: string } } | null>(
    null,
  )

  useEffect(() => {
    const pending = consume()
    if (!pending) return
    setTab(pending.tab)
    setSnippet({ code: pending.code, origin: pending.origin })
  }, [consume])

  return (
    <div className="space-y-5">
      <header>
        {snippet?.origin && (
          <Link
            to={snippet.origin.path}
            className="mb-2 inline-flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--accent)' }}
          >
            ← Revenir à « {snippet.origin.label} »
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">Atelier</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Un vrai terminal, une vraie base SQL, un vrai interpréteur Python — tout tourne dans votre
          navigateur, rien n'est envoyé au serveur.
        </p>
      </header>

      <div
        className="flex flex-wrap gap-1 rounded-xl border p-1"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {TABS.map(({ id, label, icon: Icon, hint }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition"
            style={{ color: tab === id ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            {tab === id && (
              <motion.span
                layoutId="workshop-tab"
                className="absolute inset-0 rounded-lg"
                style={{ background: 'var(--accent-soft)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <Icon size={15} />
              {label}
              <Pill className="hidden sm:inline-flex">{hint}</Pill>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'shell' && <ShellWorkshop initialCommand={snippet?.code} />}
          {tab === 'sql' && <SqlPlayground initialCode={snippet?.code} />}
          {tab === 'python' && <PythonPlayground initialCode={snippet?.code} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
