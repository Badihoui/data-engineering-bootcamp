/**
 * Réussites : certificats de parcours, badges et classement.
 *
 * Le certificat est une vraie page imprimable (`window.print` + `@media print`)
 * plutôt qu'une image générée : il reste net à toute taille et le navigateur
 * sait l'exporter en PDF sans dépendance supplémentaire.
 */

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Award, Crown, Flame, Lock, Medal, Printer, Sparkles, X } from 'lucide-react'

import { Button, Card, EmptyState, Pill, ProgressBar, Skeleton, cx } from '@/components/ui'
import { CountUp, Reveal, Stagger, StaggerItem } from '@/components/motion'
import { useCertificates, useLeaderboard } from '@/lib/queries'
import { useAuth } from '@/store/auth'
import type { Certificate } from '@/lib/types'

const MEDALS = ['#facc15', '#cbd5e1', '#d97706']

function CertificateSheet({
  certificate,
  learner,
  onClose,
}: {
  certificate: Certificate
  learner: string
  onClose: () => void
}) {
  const sheetRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/70 p-4 backdrop-blur-sm print:static print:bg-transparent print:p-0 print:backdrop-blur-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <Button variant="subtle" onClick={() => window.print()}>
            <Printer size={15} /> Imprimer / PDF
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X size={15} /> Fermer
          </Button>
        </div>

        <div
          ref={sheetRef}
          id="certificat"
          className="relative overflow-hidden rounded-2xl border-8 bg-white p-10 text-center text-slate-900 sm:p-16"
          style={{ borderColor: certificate.track_color }}
        >
          <div
            className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-10"
            style={{ background: certificate.track_color }}
          />
          <p className="text-[0.7rem] font-semibold tracking-[0.3em] text-slate-500 uppercase">
            Bootcamp Data Engineering
          </p>
          <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
            Certificat de réussite
          </h2>
          <p className="mt-8 text-sm text-slate-500">Décerné à</p>
          <p className="mt-1 text-2xl font-semibold">{learner}</p>
          <p className="mt-8 text-sm text-slate-500">pour avoir terminé l'intégralité du parcours</p>
          <p className="mt-1 text-xl font-semibold" style={{ color: certificate.track_color }}>
            {certificate.track_title}
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-10 text-sm">
            <span>
              <span className="block text-2xl font-semibold">{certificate.modules_total}</span>
              <span className="text-slate-500">modules</span>
            </span>
            <span>
              <span className="block text-2xl font-semibold">≈ {certificate.hours} h</span>
              <span className="text-slate-500">de contenu</span>
            </span>
            <span>
              <span className="block text-2xl font-semibold">
                {certificate.earned_on
                  ? new Date(certificate.earned_on).toLocaleDateString('fr-FR')
                  : '—'}
              </span>
              <span className="text-slate-500">date d'obtention</span>
            </span>
          </div>

          <div className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-400">
            From Zero to Hero · programme en 3 niveaux, 36 modules et 2 projets intégrateurs
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function CertificateCard({
  certificate,
  onOpen,
}: {
  certificate: Certificate
  onOpen: () => void
}) {
  const percent = certificate.modules_total
    ? Math.round((certificate.modules_completed / certificate.modules_total) * 100)
    : 0

  return (
    <Card className={cx('flex h-full flex-col p-5', !certificate.earned && 'opacity-95')}>
      <div className="flex items-start justify-between gap-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{
            background: `${certificate.track_color}1f`,
            color: certificate.earned ? certificate.track_color : 'var(--text-muted)',
          }}
        >
          {certificate.earned ? <Award size={20} /> : <Lock size={17} />}
        </span>
        {certificate.earned && <Pill color={certificate.track_color}>obtenu</Pill>}
      </div>

      <h3 className="mt-3 font-semibold">{certificate.track_title}</h3>
      <p className="mt-1 flex-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        {certificate.earned
          ? `Parcours terminé — ${certificate.modules_total} modules, environ ${certificate.hours} heures.`
          : `Encore ${certificate.modules_total - certificate.modules_completed} module(s) avant de débloquer ce certificat.`}
      </p>

      <div className="mt-4">
        <div
          className="mb-1.5 flex justify-between text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>
            {certificate.modules_completed}/{certificate.modules_total} modules
          </span>
          <span className="tabular-nums">{percent} %</span>
        </div>
        <ProgressBar percent={percent} color={certificate.track_color} height={5} />
      </div>

      {certificate.earned && (
        <Button variant="outline" className="mt-4" onClick={onOpen}>
          <Award size={15} /> Voir le certificat
        </Button>
      )}
    </Card>
  )
}

export function Achievements() {
  const user = useAuth((s) => s.user)
  const { data: certificates, isLoading } = useCertificates()
  const { data: leaderboard } = useLeaderboard()
  const [open, setOpen] = useState<Certificate | null>(null)

  if (isLoading) return <Skeleton className="h-96" />

  const learner = user?.display_name || user?.username || 'Apprenant'
  const earned = certificates?.filter((item) => item.earned).length ?? 0

  return (
    <div className="space-y-6 print:space-y-0">
      <header className="print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Réussites</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {earned > 0
            ? `${earned} certificat(s) obtenu(s) · ${user?.badges.length ?? 0} badge(s) débloqué(s).`
            : 'Terminez tous les modules d’un niveau pour décrocher son certificat.'}
        </p>
      </header>

      {/* ---------------------------------------------------- certificats */}
      <section className="print:hidden">
        <h2
          className="mb-3 text-sm font-semibold tracking-wide uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          Certificats
        </h2>
        <Stagger className="grid gap-4 md:grid-cols-3">
          {certificates?.map((certificate) => (
            <StaggerItem key={certificate.track_slug}>
              <CertificateCard certificate={certificate} onOpen={() => setOpen(certificate)} />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr] print:hidden">
        {/* --------------------------------------------------------- badges */}
        <Reveal>
          <Card className="h-full p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <Sparkles size={16} style={{ color: 'var(--accent)' }} /> Badges
            </h2>
            {!user || user.badges.length === 0 ? (
              <EmptyState
                icon={<Medal size={26} />}
                title="Aucun badge pour l’instant"
                description="Terminez un premier module, réussissez des quiz, tenez une série — chaque jalon en débloque un."
              />
            ) : (
              <ul className="space-y-3">
                {user.badges.map(({ badge, unlocked_at }, index) => (
                  <motion.li
                    key={badge.slug}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg"
                      style={{ background: `${badge.color}1f` }}
                    >
                      {badge.icon}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{badge.name}</span>
                      <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                        {badge.description} · {new Date(unlocked_at).toLocaleDateString('fr-FR')}
                      </span>
                    </span>
                  </motion.li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>

        {/* ----------------------------------------------------- classement */}
        <Reveal delay={0.08}>
          <Card className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <Crown size={16} style={{ color: '#facc15' }} /> Classement
              </h2>
              {leaderboard?.my_rank && <Pill color="var(--accent)">#{leaderboard.my_rank}</Pill>}
            </div>

            {!leaderboard || leaderboard.entries.length === 0 ? (
              <EmptyState
                icon={<Crown size={26} />}
                title="Classement vide"
                description="Les apprenants apparaissent ici dès leur première leçon terminée."
              />
            ) : (
              <ol className="space-y-1">
                {leaderboard.entries.map((entry, index) => (
                  <motion.li
                    key={entry.rank}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2"
                    style={{
                      background: entry.is_me ? 'var(--accent-soft)' : 'transparent',
                    }}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums"
                      style={{
                        background: entry.rank <= 3 ? MEDALS[entry.rank - 1] : 'var(--surface-3)',
                        color: entry.rank <= 3 ? '#0b1020' : 'var(--text-muted)',
                      }}
                    >
                      {entry.rank}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-sm"
                      style={{ fontWeight: entry.is_me ? 600 : 400 }}
                    >
                      {entry.display_name}
                      {entry.is_me && (
                        <span className="ml-1.5 text-xs" style={{ color: 'var(--accent)' }}>
                          vous
                        </span>
                      )}
                    </span>
                    {entry.current_streak > 0 && (
                      <span
                        className="flex shrink-0 items-center gap-0.5 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Flame size={11} className="text-orange-400" />
                        {entry.current_streak}
                      </span>
                    )}
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      <CountUp value={entry.xp} suffix=" XP" />
                    </span>
                  </motion.li>
                ))}
              </ol>
            )}
          </Card>
        </Reveal>
      </div>

      <AnimatePresence>
        {open && (
          <CertificateSheet
            certificate={open}
            learner={learner}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
