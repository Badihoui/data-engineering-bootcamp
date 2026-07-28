import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Award,
  CheckCircle2,
  Clock,
  Flame,
  PlayCircle,
  Sparkles,
  TerminalSquare,
  Trophy,
} from 'lucide-react'

import { CountUp, ProgressRing, Reveal, Stagger, StaggerItem, hoverLift } from '@/components/motion'
import {
  ButtonLink,
  Card,
  EmptyState,
  Pill,
  ProgressBar,
  Skeleton,
  formatDuration,
} from '@/components/ui'
import { useDashboard } from '@/lib/queries'
import { useAuth } from '@/store/auth'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'hier' : `il y a ${days} jours`
}

function StatTile({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  icon: React.ReactNode
  accent?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[0.72rem] font-medium tracking-wide uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold">{value}</p>
          {hint && (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {hint}
            </p>
          )}
        </div>
        <motion.span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{
            background: `${accent ?? 'var(--accent)'}1f`,
            color: accent ?? 'var(--accent)',
          }}
          whileHover={{ rotate: -8, scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 320, damping: 14 }}
        >
          {icon}
        </motion.span>
      </div>
    </Card>
  )
}

export function Dashboard() {
  const user = useAuth((s) => s.user)
  const { data, isLoading } = useDashboard()

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-40" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const firstName = (user?.display_name || user?.username || '').split(' ')[0]

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- continue */}
      <Card className="overflow-hidden">
        <div className="relative flex flex-wrap items-center gap-8 p-6 sm:p-8">
          <motion.div
            className="pointer-events-none absolute -top-28 -right-20 h-72 w-72 rounded-full blur-3xl"
            style={{ background: 'var(--accent)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.18 }}
            transition={{ duration: 1.2 }}
          />
          <div className="relative min-w-0 flex-1">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {data.lessons_done === 0 ? 'Bienvenue' : 'Content de vous revoir'}
              {firstName ? `, ${firstName}` : ''}
            </p>
            <motion.h1
              className="mt-1 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              {data.next_lesson ? data.next_lesson.lesson_title : 'Parcours terminé 🎉'}
            </motion.h1>
            {data.next_lesson && (
              <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                Prochaine leçon · {data.next_lesson.module_title}
              </p>
            )}

            <p className="mt-5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <CountUp value={data.lessons_done} /> / {data.lessons_total} leçons ·{' '}
              <CountUp value={data.modules_completed} /> / {data.modules_total} modules terminés
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {data.next_lesson && (
                <ButtonLink
                  to={`/app/modules/${data.next_lesson.module_slug}/${data.next_lesson.lesson_slug}`}
                >
                  <PlayCircle size={16} />
                  {data.lessons_done === 0 ? 'Commencer' : 'Reprendre'}
                </ButtonLink>
              )}
              <ButtonLink to="/app/atelier" variant="outline">
                <TerminalSquare size={15} /> Ouvrir l'atelier
              </ButtonLink>
            </div>
          </div>

          <div className="relative">
            <ProgressRing percent={data.percent} size={128} stroke={10} sublabel="du parcours" />
          </div>
        </div>
      </Card>

      {/* ---------------------------------------------------------- stats */}
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile
            label="Expérience"
            value={<CountUp value={data.xp} suffix=" XP" />}
            icon={<Sparkles size={16} />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Série en cours"
            value={<CountUp value={data.current_streak} suffix=" j" />}
            hint={`record : ${data.longest_streak} j`}
            icon={<Flame size={16} />}
            accent="#fb923c"
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Quiz réussis"
            value={<CountUp value={data.quizzes_passed} />}
            icon={<Trophy size={16} />}
            accent="#facc15"
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Temps de lecture"
            value={formatDuration(Math.round(data.seconds_spent / 60))}
            icon={<Clock size={16} />}
            accent="#34d399"
          />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* ------------------------------------------------------- tracks */}
        <Reveal>
          <Card className="p-6">
            <h2 className="mb-5 font-semibold">Progression par niveau</h2>
            <div className="space-y-5">
              {Object.entries(data.tracks).map(([slug, track]) => (
                <div key={slug}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <Link
                      to={`/app/curriculum/${slug}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {track.title}
                    </Link>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {track.modules_done}/{track.modules} modules · {track.percent} %
                    </span>
                  </div>
                  <ProgressBar percent={track.percent} color={track.color} />
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        {/* ------------------------------------------------------- recent */}
        <Reveal delay={0.08}>
          <Card className="h-full p-6">
            <h2 className="mb-4 font-semibold">Activité récente</h2>
            {data.recent.length === 0 ? (
              <EmptyState
                icon={<Award size={28} />}
                title="Rien encore"
                description="Ouvrez une première leçon pour voir votre activité ici."
              />
            ) : (
              <ul className="space-y-1">
                {data.recent.map((item, index) => (
                  <motion.li
                    key={`${item.module_slug}-${item.lesson_slug}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.06 }}
                  >
                    <Link
                      to={`/app/modules/${item.module_slug}/${item.lesson_slug}`}
                      className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:opacity-80"
                    >
                      <CheckCircle2
                        size={16}
                        className="mt-0.5 shrink-0"
                        style={{
                          color:
                            item.status === 'completed' ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {item.lesson_title}
                        </span>
                        <span
                          className="block truncate text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {item.module_title} · {relativeTime(item.updated_at)}
                        </span>
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>

      {/* --------------------------------------------------------- badges */}
      {user && user.badges.length > 0 && (
        <Reveal>
          <Card className="p-6">
            <h2 className="mb-4 font-semibold">Badges débloqués</h2>
            <div className="flex flex-wrap gap-2">
              {user.badges.map(({ badge }, index) => (
                <motion.span
                  key={badge.slug}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: index * 0.05,
                    type: 'spring',
                    stiffness: 300,
                    damping: 18,
                  }}
                  {...hoverLift}
                >
                  <Pill color={badge.color}>
                    <span>{badge.icon}</span> {badge.name}
                  </Pill>
                </motion.span>
              ))}
            </div>
          </Card>
        </Reveal>
      )}
    </div>
  )
}
