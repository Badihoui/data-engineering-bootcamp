import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Lightbulb, Search } from 'lucide-react'

import { Card, EmptyState, Pill, cx } from '@/components/ui'
import { Stagger, StaggerItem } from '@/components/motion'
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  GLOSSARY,
  searchGlossary,
  type Category,
} from '@/lib/glossary'
import { useModules } from '@/lib/queries'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

export function Glossary() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const { data: modules } = useModules()

  const moduleBySlugNumber = useMemo(() => {
    const map = new Map<number, { slug: string; title: string }>()
    modules?.forEach((module) => map.set(module.number, { slug: module.slug, title: module.title }))
    return map
  }, [modules])

  const entries = useMemo(() => {
    const filtered = category === 'all' ? GLOSSARY : GLOSSARY.filter((e) => e.category === category)
    return searchGlossary(filtered, query).sort((a, b) =>
      a.term.localeCompare(b.term, 'fr', { sensitivity: 'base' }),
    )
  }, [category, query])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Glossaire</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {GLOSSARY.length} notions du Data Engineering, avec le piège que la définition courte ne
          dit jamais — et le module où la travailler.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="shuffle, watermark, idempotence…"
            aria-label="Rechercher une notion"
            className="w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm outline-none focus:border-[var(--accent)]"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
          style={{
            borderColor: category === 'all' ? 'var(--accent)' : 'var(--border)',
            color: category === 'all' ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          Toutes ({GLOSSARY.length})
        </button>
        {CATEGORIES.map((item) => {
          const count = GLOSSARY.filter((entry) => entry.category === item).length
          const active = category === item
          return (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
              style={{
                borderColor: active ? CATEGORY_COLORS[item] : 'var(--border)',
                color: active ? CATEGORY_COLORS[item] : 'var(--text-muted)',
                background: active ? `${CATEGORY_COLORS[item]}14` : 'transparent',
              }}
            >
              {CATEGORY_LABELS[item]} ({count})
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {entries.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmptyState
              icon={<Search size={28} />}
              title="Aucune notion trouvée"
              description="Essayez un autre terme ou retirez le filtre de catégorie."
            />
          </motion.div>
        ) : (
          <Stagger
            key={`${category}-${query}`}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {entries.map((entry) => {
              const module = entry.moduleNumber
                ? moduleBySlugNumber.get(entry.moduleNumber)
                : undefined
              return (
                <StaggerItem key={entry.term}>
                  <Card className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-semibold">{entry.term}</h2>
                      <Pill color={CATEGORY_COLORS[entry.category]}>
                        {CATEGORY_LABELS[entry.category]}
                      </Pill>
                    </div>

                    {entry.aliases && (
                      <p className="mt-0.5 text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>
                        {entry.aliases.join(' · ')}
                      </p>
                    )}

                    <p className="mt-3 text-sm">{entry.definition}</p>

                    {entry.nuance && (
                      <p
                        className={cx(
                          'mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[0.82rem]',
                        )}
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                      >
                        <Lightbulb
                          size={13}
                          className="mt-0.5 shrink-0"
                          style={{ color: CATEGORY_COLORS[entry.category] }}
                        />
                        {entry.nuance}
                      </p>
                    )}

                    {module && (
                      <Link
                        to={`/app/modules/${module.slug}`}
                        className="mt-4 inline-flex items-center gap-1 text-[0.78rem] font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        Module {String(entry.moduleNumber).padStart(2, '0')} · {module.title}
                        <ArrowUpRight size={13} />
                      </Link>
                    )}
                  </Card>
                </StaggerItem>
              )
            })}
          </Stagger>
        )}
      </AnimatePresence>
    </div>
  )
}
