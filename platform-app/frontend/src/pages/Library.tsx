/**
 * Ma bibliothèque : toutes les notes prises et tous les modules mis en favori.
 *
 * Le but est la relecture avant un entretien ou un examen : on retrouve ses
 * propres mots, avec le chemin de retour vers la leçon d'origine.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, NotebookPen, Search, Star, Trash2 } from 'lucide-react'

import { Card, EmptyState, Pill, Skeleton, cx } from '@/components/ui'
import { Stagger, StaggerItem } from '@/components/motion'
import type { Module } from '@/lib/types'
import {
  useAllNotes,
  useBookmarks,
  useDeleteNote,
  useModules,
  useToggleBookmark,
} from '@/lib/queries'

type Tab = 'notes' | 'favoris'

function relativeDate(iso: string): string {
  const date = new Date(iso)
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 30) return `il y a ${days} jours`
  return date.toLocaleDateString('fr-FR')
}

function NotesPanel({ query }: { query: string }) {
  const { data: notes, isLoading } = useAllNotes()
  const remove = useDeleteNote()

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!notes) return []
    if (!needle) return notes
    return notes.filter(
      (note) =>
        note.body.toLowerCase().includes(needle) ||
        note.lesson_title.toLowerCase().includes(needle),
    )
  }, [notes, query])

  if (isLoading) return <Skeleton className="h-64" />

  if (!notes?.length) {
    return (
      <EmptyState
        icon={<NotebookPen size={28} />}
        title="Aucune note pour l’instant"
        description="Le bloc « Mes notes » en bas de chaque leçon enregistre ce que vous écrivez, automatiquement."
      />
    )
  }

  if (!filtered.length) {
    return (
      <EmptyState
        icon={<Search size={28} />}
        title="Aucune note ne correspond"
        description={`Rien trouvé pour « ${query} ».`}
      />
    )
  }

  return (
    <Stagger className="grid gap-4 md:grid-cols-2">
      {filtered.map((note) => (
        <StaggerItem key={note.id}>
          <Card className="group flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <Link
                to={`/app/modules/${note.module_slug}/${note.lesson_slug}`}
                className="min-w-0 flex-1"
              >
                <h3 className="truncate text-sm font-semibold hover:underline">
                  {note.lesson_title}
                </h3>
                <p className="truncate text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                  {note.module_title}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate(note.id)}
                aria-label="Supprimer la note"
                className="shrink-0 rounded-lg p-1.5 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>

            <p
              className="mt-2 flex-1 text-sm whitespace-pre-wrap"
              style={{ color: 'var(--text-muted)' }}
            >
              {note.body}
            </p>

            <p className="mt-3 text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
              modifiée {relativeDate(note.updated_at)}
            </p>
          </Card>
        </StaggerItem>
      ))}
    </Stagger>
  )
}

function BookmarksPanel({ query }: { query: string }) {
  const { data: bookmarks, isLoading } = useBookmarks()
  const { data: modules } = useModules()
  const toggle = useToggleBookmark()

  const moduleById = useMemo(() => {
    const map = new Map<number, Module>()
    modules?.forEach((module) => map.set(module.id, module))
    return map
  }, [modules])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!bookmarks) return []
    if (!needle) return bookmarks
    return bookmarks.filter((item) => item.module_title.toLowerCase().includes(needle))
  }, [bookmarks, query])

  if (isLoading) return <Skeleton className="h-64" />

  if (!bookmarks?.length) {
    return (
      <EmptyState
        icon={<Star size={28} />}
        title="Aucun favori"
        description="L’étoile en haut de chaque module l’ajoute ici, pour y revenir vite."
      />
    )
  }

  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((bookmark) => {
        const module = moduleById.get(bookmark.module)
        return (
          <StaggerItem key={bookmark.id}>
            <Card className="group flex h-full flex-col p-5">
              <div className="flex items-start gap-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
                  style={{ background: `${module?.track_color ?? 'var(--accent)'}1f` }}
                >
                  {module?.icon ?? '📗'}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{bookmark.module_title}</h3>
                  {module && (
                    <p className="text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                      {module.track_title}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    toggle.mutate({ moduleId: bookmark.module, existingId: bookmark.id })
                  }
                  aria-label="Retirer des favoris"
                  className="shrink-0 rounded-lg p-1.5"
                  style={{ color: '#facc15' }}
                >
                  <Star size={15} fill="#facc15" />
                </button>
              </div>

              {module?.summary && (
                <p
                  className="mt-3 line-clamp-2 flex-1 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {module.summary}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <span className="flex flex-wrap gap-1.5">
                  {module?.tags.slice(0, 2).map((tag: string) => (
                    <Pill key={tag}>{tag}</Pill>
                  ))}
                </span>
                <Link
                  to={`/app/modules/${bookmark.module_slug}`}
                  className="inline-flex items-center gap-1 text-[0.78rem] font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  Ouvrir <ArrowUpRight size={13} />
                </Link>
              </div>
            </Card>
          </StaggerItem>
        )
      })}
    </Stagger>
  )
}

export function Library() {
  const [tab, setTab] = useState<Tab>('notes')
  const [query, setQuery] = useState('')
  const { data: notes } = useAllNotes()
  const { data: bookmarks } = useBookmarks()

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'notes', label: 'Mes notes', count: notes?.length ?? 0 },
    { id: 'favoris', label: 'Favoris', count: bookmarks?.length ?? 0 },
  ]

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ma bibliothèque</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Vos notes et vos modules mis de côté, au même endroit.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex gap-1 rounded-xl border p-1"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="relative rounded-lg px-4 py-2 text-sm font-medium transition"
              style={{ color: tab === item.id ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              {tab === item.id && (
                <motion.span
                  layoutId="library-tab"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--accent-soft)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">
                {item.label}
                <span className={cx('ml-1.5 text-xs opacity-70')}>{item.count}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-48 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrer…"
            aria-label="Filtrer la bibliothèque"
            className="w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm outline-none focus:border-[var(--accent)]"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'notes' ? <NotesPanel query={query} /> : <BookmarksPanel query={query} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
