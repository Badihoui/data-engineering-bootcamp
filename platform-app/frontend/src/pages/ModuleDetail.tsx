import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Code2,
  ExternalLink,
  Image,
  ListChecks,
  PenLine,
  Star,
  Timer,
} from 'lucide-react'

import {
  ButtonLink,
  Card,
  DifficultyDots,
  Pill,
  ProgressBar,
  Skeleton,
  formatDuration,
} from '@/components/ui'
import { useBookmarks, useModule, useProgress, useToggleBookmark } from '@/lib/queries'
import { useAuth } from '@/store/auth'

export function ModuleDetail() {
  const { moduleSlug } = useParams()
  const { data: module, isLoading } = useModule(moduleSlug)
  const { data: progress } = useProgress()
  const { data: bookmarks } = useBookmarks()
  const toggleBookmark = useToggleBookmark()
  const authenticated = useAuth((s) => s.status === 'authenticated')

  if (isLoading || !module) return <Skeleton className="h-96" />

  const completedSlugs = new Set(
    progress?.lessons.filter((l) => l.status === 'completed').map((l) => l.lesson_slug) ?? [],
  )
  const stats = progress?.modules[module.id]
  const bookmark = bookmarks?.find((item) => item.module === module.id)
  const lessons = module.lessons ?? []
  const firstUnfinished = lessons.find((lesson) => !completedSlugs.has(lesson.slug)) ?? lessons[0]

  return (
    <div className="space-y-6">
      <header>
        <Link
          to={`/app/curriculum/${module.track_slug}`}
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          ← {module.track_title}
        </Link>

        <div className="mt-3 flex items-start gap-4">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl"
            style={{ background: `${module.track_color}1f` }}
          >
            {module.icon}
          </span>
          <div className="min-w-0">
            <p
              className="text-[0.72rem] font-semibold tracking-wide"
              style={{ color: module.track_color }}
            >
              {module.kind === 'project'
                ? 'PROJET INTÉGRATEUR'
                : `MODULE ${String(module.number).padStart(2, '0')}`}
            </p>
            <span className="flex items-start gap-3">
              <h1 className="mt-0.5 flex-1 text-2xl font-semibold tracking-tight text-balance">
                {module.title}
              </h1>
              {authenticated && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() =>
                    toggleBookmark.mutate({ moduleId: module.id, existingId: bookmark?.id })
                  }
                  aria-label={bookmark ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  title={bookmark ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  className="mt-1 shrink-0 rounded-lg border p-2 transition"
                  style={{
                    borderColor: bookmark ? '#facc15' : 'var(--border)',
                    color: bookmark ? '#facc15' : 'var(--text-muted)',
                  }}
                >
                  <Star size={16} fill={bookmark ? '#facc15' : 'none'} />
                </motion.button>
              )}
            </span>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm" style={{ color: 'var(--text-muted)' }}>
          {module.summary}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Pill color={module.track_color}>
            <Timer size={11} /> {formatDuration(module.estimated_minutes)}
          </Pill>
          <Pill>
            <BookOpen size={11} /> {module.lesson_count} leçons
          </Pill>
          {module.has_quiz && (
            <Pill>
              <ListChecks size={11} /> quiz noté
            </Pill>
          )}
          <span className="ml-1">
            <DifficultyDots level={module.difficulty} />
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {firstUnfinished && (
            <ButtonLink to={`/app/modules/${module.slug}/${firstUnfinished.slug}`}>
              {stats && stats.done > 0 ? 'Reprendre le module' : 'Commencer le module'}
            </ButtonLink>
          )}
          {module.has_quiz && (
            <ButtonLink to={`/app/modules/${module.slug}/quiz`} variant="outline">
              <ListChecks size={15} /> Passer le quiz
            </ButtonLink>
          )}
          {module.colab_url && (
            <ButtonLink to={module.colab_url} variant="ghost" external>
              <ExternalLink size={15} /> Notebook source
            </ButtonLink>
          )}
        </div>

        {stats && stats.total > 0 && (
          <div className="mt-5 max-w-md">
            <div
              className="mb-1.5 flex justify-between text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>
                {stats.done} / {stats.total} leçons
              </span>
              <span className="tabular-nums">{stats.percent} %</span>
            </div>
            <ProgressBar percent={stats.percent} color={module.track_color} />
          </div>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* --------------------------------------------------------- lessons */}
        <Card className="overflow-hidden">
          <h2 className="border-b px-5 py-4 font-semibold" style={{ borderColor: 'var(--border)' }}>
            Plan du module
          </h2>
          <ol>
            {lessons.map((lesson) => {
              const done = completedSlugs.has(lesson.slug)
              return (
                <li key={lesson.slug}>
                  <Link
                    to={`/app/modules/${module.slug}/${lesson.slug}`}
                    className="flex items-start gap-3 border-b px-5 py-3.5 transition last:border-b-0 hover:brightness-105"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {done ? (
                      <CheckCircle2
                        size={17}
                        className="mt-0.5 shrink-0"
                        style={{ color: 'var(--accent)' }}
                      />
                    ) : (
                      <Circle
                        size={17}
                        className="mt-0.5 shrink-0"
                        style={{ color: 'var(--border)' }}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{lesson.title}</span>
                      {lesson.summary && (
                        <span
                          className="mt-0.5 line-clamp-1 block text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {lesson.summary}
                        </span>
                      )}
                    </span>
                    <span
                      className="flex shrink-0 items-center gap-2 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {lesson.has_diagram && <Image size={12} />}
                      {lesson.has_code && <Code2 size={12} />}
                      {lesson.has_exercise && <PenLine size={12} />}
                      <span className="tabular-nums">{lesson.estimated_minutes}′</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </Card>

        {/* -------------------------------------------------------- sidebar */}
        <div className="space-y-5">
          {(module.objectives?.length ?? 0) > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Ce que vous allez apprendre</h2>
              <ul className="space-y-2">
                {module.objectives?.map((objective) => (
                  <li key={objective} className="flex items-start gap-2 text-sm">
                    <Circle
                      size={6}
                      className="mt-2 shrink-0"
                      fill="currentColor"
                      style={{ color: module.track_color }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>{objective}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(module.prerequisites?.length ?? 0) > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Prérequis</h2>
              <ul className="space-y-2">
                {module.prerequisites?.map((item) => (
                  <li key={item} className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(module.resources?.length ?? 0) > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Ressources</h2>
              <ul className="space-y-2">
                {module.resources?.map((resource) => (
                  <li key={resource.url}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-start gap-2 text-sm hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      <ExternalLink size={13} className="mt-1 shrink-0" />
                      {resource.title}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {module.tags.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Technologies</h2>
              <div className="flex flex-wrap gap-2">
                {module.tags.map((tag) => (
                  <Pill key={tag}>{tag}</Pill>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
