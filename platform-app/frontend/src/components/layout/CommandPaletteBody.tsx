/**
 * The palette itself — loaded on first ⌘K, never in the initial bundle.
 *
 * Search runs server-side (`/api/search/`) so the client never ships a 700-item
 * index; queries are debounced and the last result stays visible while typing.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Command } from 'cmdk'
import {
  BookOpen,
  Database,
  LayoutDashboard,
  Loader2,
  Route as RouteIcon,
  Search,
  Sparkles,
  TerminalSquare,
  User as UserIcon,
} from 'lucide-react'

import { api } from '@/lib/api'

interface SearchModule {
  slug: string
  number: number
  title: string
  icon: string
  kind: string
  track_title: string
  track_color: string
  tags: string[]
}

interface SearchLesson {
  slug: string
  title: string
  summary: string
  module_slug: string
  module_title: string
  module_number: number
  track_color: string
  estimated_minutes: number
}

const SHORTCUTS = [
  { label: 'Tableau de bord', path: '/app', icon: LayoutDashboard },
  { label: 'Curriculum', path: '/app/curriculum', icon: RouteIcon },
  { label: 'Tous les modules', path: '/app/modules', icon: BookOpen },
  { label: 'Atelier — terminal', path: '/app/atelier', icon: TerminalSquare },
  { label: 'Glossaire', path: '/app/glossaire', icon: Database },
  { label: 'Mon profil', path: '/app/profil', icon: UserIcon },
]

export function PaletteBody({ open, setOpen }: { open: boolean; setOpen: (value: boolean) => void }) {
  const [query, setQuery] = useState('')
  const [modules, setModules] = useState<SearchModule[]>([])
  const [lessons, setLessons] = useState<SearchLesson[]>([])
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) {
      setQuery('')
      setModules([])
      setLessons([])
    }
  }, [open])

  useEffect(() => {
    const needle = query.trim()
    if (needle.length < 2) {
      setModules([])
      setLessons([])
      return
    }
    setBusy(true)
    const timer = setTimeout(() => {
      api
        .get<{ modules: SearchModule[]; lessons: SearchLesson[] }>(
          `/search/?q=${encodeURIComponent(needle)}`,
        )
        .then((data) => {
          setModules(data.modules)
          setLessons(data.lessons)
        })
        .catch(() => {
          setModules([])
          setLessons([])
        })
        .finally(() => setBusy(false))
    }, 180)
    return () => clearTimeout(timer)
  }, [query])

  const go = useCallback(
    (path: string) => {
      setOpen(false)
      navigate(path)
    },
    [navigate],
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] backdrop-blur-sm"
          style={{ background: 'rgb(2 6 16 / 0.55)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <Command shouldFilter={false} loop>
              <div
                className="flex items-center gap-3 border-b px-4"
                style={{ borderColor: 'var(--border)' }}
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                ) : (
                  <Search size={16} style={{ color: 'var(--text-muted)' }} />
                )}
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Rechercher un module, une leçon, une commande…"
                  className="flex-1 bg-transparent py-4 text-sm outline-none"
                  style={{ color: 'var(--text)' }}
                />
                <kbd
                  className="rounded border px-1.5 py-0.5 text-[0.65rem]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  esc
                </kbd>
              </div>

              <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  {query.trim().length < 2
                    ? 'Tapez au moins deux caractères.'
                    : `Aucun résultat pour « ${query} ».`}
                </Command.Empty>

                {query.trim().length < 2 && (
                  <Command.Group heading="Aller à">
                    {SHORTCUTS.map(({ label, path, icon: Icon }) => (
                      <Item key={path} onSelect={() => go(path)}>
                        <Icon size={15} style={{ color: 'var(--text-muted)' }} />
                        <span className="flex-1">{label}</span>
                      </Item>
                    ))}
                  </Command.Group>
                )}

                {modules.length > 0 && (
                  <Command.Group heading="Modules">
                    {modules.map((module) => (
                      <Item
                        key={module.slug}
                        onSelect={() => go(`/app/modules/${module.slug}`)}
                      >
                        <span className="text-base">{module.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{module.title}</span>
                          <span
                            className="block truncate text-[0.72rem]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {module.kind === 'project'
                              ? 'Projet'
                              : `Module ${String(module.number).padStart(2, '0')}`}{' '}
                            · {module.track_title}
                          </span>
                        </span>
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: module.track_color }}
                        />
                      </Item>
                    ))}
                  </Command.Group>
                )}

                {lessons.length > 0 && (
                  <Command.Group heading="Leçons">
                    {lessons.map((lesson) => (
                      <Item
                        key={`${lesson.module_slug}/${lesson.slug}`}
                        onSelect={() => go(`/app/modules/${lesson.module_slug}/${lesson.slug}`)}
                      >
                        <Sparkles size={15} style={{ color: lesson.track_color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{lesson.title}</span>
                          <span
                            className="block truncate text-[0.72rem]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {lesson.module_title}
                          </span>
                        </span>
                        <span
                          className="shrink-0 text-[0.7rem] tabular-nums"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {lesson.estimated_minutes}′
                        </span>
                      </Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Item({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 data-[selected=true]:bg-[var(--accent-soft)]"
    >
      {children}
    </Command.Item>
  )
}
