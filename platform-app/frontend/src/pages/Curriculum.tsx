import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Circle, Package, Search, Timer } from 'lucide-react'
import { motion } from 'motion/react'

import { Reveal, Stagger, StaggerItem, hoverLift } from '@/components/motion'

import {
  Card,
  DifficultyDots,
  EmptyState,
  Pill,
  ProgressBar,
  Skeleton,
  cx,
  formatDuration,
} from '@/components/ui'
import { useModules, useProgress, useTrack, useTracks } from '@/lib/queries'
import type { Module, ModuleStats } from '@/lib/types'

function ModuleCard({ module, stats }: { module: Module; stats?: ModuleStats }) {
  const percent = stats?.percent ?? 0
  const done = stats?.completed ?? false

  return (
    <motion.div {...hoverLift} className="h-full">
      <Link to={`/app/modules/${module.slug}`} className="group block h-full">
        <Card className="flex h-full flex-col p-5 transition group-hover:brightness-105">
          <div className="flex items-start gap-3">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl"
              style={{ background: `${module.track_color}1f` }}
            >
              {module.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-[0.7rem] font-semibold tabular-nums"
                  style={{ color: module.track_color }}
                >
                  {module.kind === 'project'
                    ? 'PROJET'
                    : `MODULE ${String(module.number).padStart(2, '0')}`}
                </span>
                {done && <CheckCircle2 size={13} style={{ color: 'var(--accent)' }} />}
              </div>
              <h3 className="mt-0.5 leading-snug font-semibold">{module.title}</h3>
            </div>
          </div>

          <p className="mt-3 line-clamp-2 flex-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {module.summary || module.subtitle}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {module.tags.slice(0, 3).map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </div>

          <div
            className="mt-4 flex items-center justify-between text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Timer size={12} /> {formatDuration(module.estimated_minutes)}
              </span>
              <span>{module.lesson_count} leçons</span>
              {module.has_quiz && <span>· quiz</span>}
            </span>
            <DifficultyDots level={module.difficulty} />
          </div>

          {percent > 0 && (
            <ProgressBar percent={percent} color={module.track_color} className="mt-3" height={4} />
          )}
        </Card>
      </Link>
    </motion.div>
  )
}

/* ------------------------------------------------------------- overview */

export function Curriculum() {
  const { data: tracks, isLoading } = useTracks()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Curriculum</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Trois niveaux à suivre dans l'ordre — chaque module s'appuie sur le précédent.
        </p>
      </header>

      {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}

      {tracks?.map((track, index) => (
        <Reveal key={track.slug} delay={index * 0.07}>
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="text-3xl">{track.icon}</span>
                <div>
                  <h2 className="text-lg font-semibold">{track.title}</h2>
                  <p className="text-sm font-medium" style={{ color: track.color }}>
                    {track.subtitle}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-muted)' }}>
                    {track.description}
                  </p>
                </div>
              </div>
              <Link
                to={`/app/curriculum/${track.slug}`}
                className="rounded-xl border px-3.5 py-2 text-sm font-medium"
                style={{ borderColor: 'var(--border)' }}
              >
                Détail du niveau
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Pill color={track.color}>{track.module_count} modules</Pill>
              <Pill>{formatDuration(track.total_minutes)}</Pill>
              <Pill>{track.estimated_weeks} semaines</Pill>
            </div>

            {track.objectives.length > 0 && (
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {track.objectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-2 text-sm">
                    <Circle
                      size={7}
                      className="mt-1.5 shrink-0"
                      style={{ color: track.color }}
                      fill="currentColor"
                    />
                    {objective}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------- track detail */

export function TrackDetail() {
  const { trackSlug } = useParams()
  const { data: track, isLoading } = useTrack(trackSlug)
  const { data: progress } = useProgress()

  if (isLoading || !track) return <Skeleton className="h-96" />

  const courses = track.modules?.filter((m) => m.kind === 'course') ?? []
  const projects = track.modules?.filter((m) => m.kind === 'project') ?? []

  return (
    <div className="space-y-6">
      <header>
        <Link to="/app/curriculum" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          ← Curriculum
        </Link>
        <div className="mt-2 flex items-start gap-4">
          <span className="text-4xl">{track.icon}</span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{track.title}</h1>
            <p className="font-medium" style={{ color: track.color }}>
              {track.subtitle}
            </p>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm" style={{ color: 'var(--text-muted)' }}>
          {track.description}
        </p>
        {track.prerequisites && (
          <p className="mt-3 text-sm">
            <span className="font-medium">Prérequis :</span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>{track.prerequisites}</span>
          </p>
        )}
      </header>

      <section>
        <h2
          className="mb-3 text-sm font-semibold tracking-wide uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          Modules
        </h2>
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((module) => (
            <StaggerItem key={module.slug}>
              <ModuleCard module={module} stats={progress?.modules[module.id]} />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {projects.length > 0 && (
        <section>
          <h2
            className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            <Package size={14} /> Projet intégrateur
          </h2>
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((module) => (
              <StaggerItem key={module.slug}>
                <ModuleCard module={module} stats={progress?.modules[module.id]} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  )
}

/* ---------------------------------------------------------- module list */

export function ModuleList() {
  const { data: modules, isLoading } = useModules()
  const { data: progress } = useProgress()
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState<string>('all')

  const filtered = useMemo(() => {
    if (!modules) return []
    const needle = query.trim().toLowerCase()
    return modules.filter((module) => {
      if (track !== 'all' && module.track_slug !== track) return false
      if (!needle) return true
      return (
        module.title.toLowerCase().includes(needle) ||
        module.summary.toLowerCase().includes(needle) ||
        module.tags.some((tag) => tag.toLowerCase().includes(needle))
      )
    })
  }, [modules, query, track])

  const tracks = useMemo(() => {
    const map = new Map<string, { slug: string; title: string; color: string }>()
    modules?.forEach((m) =>
      map.set(m.track_slug, {
        slug: m.track_slug,
        title: m.track_title,
        color: m.track_color,
      }),
    )
    return [...map.values()]
  }, [modules])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tous les modules</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {modules?.length ?? 0} modules · recherche par titre, thème ou technologie.
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
            placeholder="Rechercher un module, une techno…"
            aria-label="Rechercher un module"
            className="w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm outline-none focus:border-[var(--accent)]"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTrack('all')}
            className={cx('rounded-full border px-3 py-1.5 text-xs font-medium transition')}
            style={{
              borderColor: track === 'all' ? 'var(--accent)' : 'var(--border)',
              color: track === 'all' ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            Tous
          </button>
          {tracks.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setTrack(t.slug)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
              style={{
                borderColor: track === t.slug ? t.color : 'var(--border)',
                color: track === t.slug ? t.color : 'var(--text-muted)',
              }}
            >
              {t.title.replace('Niveau ', 'N').replace(' — ', ' · ')}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          title="Aucun module trouvé"
          description="Essayez un autre mot-clé ou retirez le filtre de niveau."
        />
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((module) => (
            <StaggerItem key={module.slug}>
              <ModuleCard module={module} stats={progress?.modules[module.id]} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  )
}
