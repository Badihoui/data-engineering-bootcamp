import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ListChecks, Sparkles, Timer } from 'lucide-react'
import { motion } from 'motion/react'

import { Confetti } from '@/components/motion'

import { BlockRenderer } from '@/components/content/BlockRenderer'
import { LessonNotes } from '@/components/content/LessonNotes'
import { Button, ButtonLink, Card, ProgressBar, Skeleton } from '@/components/ui'
import { useLesson, useModule, useProgress, useTrackLesson } from '@/lib/queries'
import { useAuth } from '@/store/auth'

/** Sends the time spent on the lesson when leaving it. */
function useTimeTracker(moduleSlug?: string, lessonSlug?: string) {
  const track = useTrackLesson()
  const startedAt = useRef(Date.now())
  const authenticated = useAuth((s) => s.status === 'authenticated')

  useEffect(() => {
    startedAt.current = Date.now()
    return () => {
      if (!authenticated || !moduleSlug || !lessonSlug) return
      const seconds = Math.round((Date.now() - startedAt.current) / 1000)
      if (seconds < 5) return
      track.mutate({
        moduleSlug,
        lessonSlug,
        seconds_spent: Math.min(seconds, 3600),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleSlug, lessonSlug, authenticated])
}

export function LessonView() {
  const { moduleSlug, lessonSlug } = useParams()
  const { data: lesson, isLoading } = useLesson(moduleSlug, lessonSlug)
  const { data: module } = useModule(moduleSlug)
  const { data: progress } = useProgress()
  const track = useTrackLesson()
  const authenticated = useAuth((s) => s.status === 'authenticated')
  const [justCompleted, setJustCompleted] = useState(false)
  const [celebration, setCelebration] = useState(0)

  useTimeTracker(moduleSlug, lessonSlug)

  useEffect(() => {
    setJustCompleted(false)
    window.scrollTo({ top: 0 })
  }, [lessonSlug])

  const completedSlugs = useMemo(
    () =>
      new Set(
        progress?.lessons.filter((l) => l.status === 'completed').map((l) => l.lesson_slug) ?? [],
      ),
    [progress],
  )

  if (isLoading || !lesson) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  const isDone = completedSlugs.has(lesson.slug) || justCompleted
  const lessons = module?.lessons ?? []
  const position = lessons.findIndex((l) => l.slug === lesson.slug)
  const modulePercent = lessons.length
    ? Math.round(((position + (isDone ? 1 : 0)) / lessons.length) * 100)
    : 0

  const complete = () => {
    if (!moduleSlug || !lessonSlug) return
    setJustCompleted(true)
    setCelebration((n) => n + 1)
    track.mutate({
      moduleSlug,
      lessonSlug,
      status: 'completed',
      scroll_ratio: 1,
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_240px]">
      <Confetti trigger={celebration} />
      <article className="min-w-0">
        {/* ------------------------------------------------------- header */}
        <header className="mb-6">
          <Link
            to={`/app/modules/${lesson.module_slug}`}
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft size={14} /> {lesson.module_title}
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
            {lesson.title}
          </h1>
          <p
            className="mt-2 flex flex-wrap items-center gap-3 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="flex items-center gap-1">
              <Timer size={12} /> {lesson.estimated_minutes} min de lecture
            </span>
            <span className="flex items-center gap-1">
              <Sparkles size={12} /> {lesson.xp_reward} XP
            </span>
            {lessons.length > 0 && (
              <span>
                Leçon {position + 1} / {lessons.length}
              </span>
            )}
          </p>
          <ProgressBar percent={modulePercent} className="mt-4 max-w-md" height={4} />
        </header>

        {/* ------------------------------------------------------ content */}
        <BlockRenderer
          blocks={lesson.blocks}
          diagrams={lesson.diagrams}
          origin={{
            label: lesson.title,
            path: `/app/modules/${lesson.module_slug}/${lesson.slug}`,
          }}
        />

        {/* --------------------------------------------------------- footer */}
        <Card className="mt-10 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-medium">
              {isDone ? 'Leçon terminée ✅' : 'Vous avez terminé cette leçon ?'}
            </p>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              {isDone
                ? 'Passez à la suivante quand vous voulez.'
                : `La marquer comme terminée vous rapporte ${lesson.xp_reward} XP.`}
            </p>
          </div>
          {authenticated ? (
            <motion.div
              animate={isDone ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 0.4 }}
            >
              <Button
                onClick={complete}
                disabled={isDone || track.isPending}
                variant={isDone ? 'subtle' : 'primary'}
              >
                <Check size={16} />
                {isDone ? 'Terminée' : 'Marquer comme terminée'}
              </Button>
            </motion.div>
          ) : (
            <ButtonLink to="/connexion" variant="outline">
              Se connecter pour suivre sa progression
            </ButtonLink>
          )}
        </Card>

        <LessonNotes lessonId={lesson.id} lessonSlug={lesson.slug} />

        {/* ------------------------------------------------------ neighbours */}
        <nav className="mt-6 flex flex-wrap items-stretch justify-between gap-3">
          {lesson.neighbours.previous ? (
            <Link
              to={`/app/modules/${lesson.module_slug}/${lesson.neighbours.previous.slug}`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-4 py-3 transition hover:brightness-105"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
              }}
            >
              <ArrowLeft size={16} style={{ color: 'var(--text-muted)' }} />
              <span className="min-w-0">
                <span className="block text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                  Précédent
                </span>
                <span className="block truncate text-sm font-medium">
                  {lesson.neighbours.previous.title}
                </span>
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}

          {lesson.neighbours.next ? (
            <Link
              to={`/app/modules/${lesson.module_slug}/${lesson.neighbours.next.slug}`}
              className="flex min-w-0 flex-1 items-center justify-end gap-3 rounded-xl border px-4 py-3 text-right transition hover:brightness-105"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
              }}
            >
              <span className="min-w-0">
                <span className="block text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                  Suivant
                </span>
                <span className="block truncate text-sm font-medium">
                  {lesson.neighbours.next.title}
                </span>
              </span>
              <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
            </Link>
          ) : module?.has_quiz ? (
            <Link
              to={`/app/modules/${lesson.module_slug}/quiz`}
              className="flex flex-1 items-center justify-end gap-3 rounded-xl border px-4 py-3 text-right transition hover:brightness-105"
              style={{
                borderColor: 'var(--accent)',
                background: 'var(--surface)',
              }}
            >
              <span>
                <span className="block text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                  Pour finir
                </span>
                <span className="block text-sm font-medium">Passer le quiz</span>
              </span>
              <ListChecks size={16} style={{ color: 'var(--accent)' }} />
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      </article>

      {/* ----------------------------------------------------------- outline */}
      <aside className="hidden xl:block">
        <div className="sticky top-22 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <p
            className="mb-2 text-[0.7rem] font-semibold tracking-wide uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            Dans ce module
          </p>
          <ul className="space-y-0.5 border-l" style={{ borderColor: 'var(--border)' }}>
            {lessons.map((item) => {
              const active = item.slug === lesson.slug
              const done = completedSlugs.has(item.slug)
              return (
                <li key={item.slug}>
                  <Link
                    to={`/app/modules/${lesson.module_slug}/${item.slug}`}
                    className="-ml-px flex items-start gap-2 border-l-2 py-1.5 pl-3 text-[0.8rem] transition"
                    style={{
                      borderColor: active ? 'var(--accent)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {done && <Check size={12} className="mt-0.5 shrink-0" />}
                    <span className="line-clamp-2">{item.title}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
    </div>
  )
}
