import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Boxes,
  GitBranch,
  Images,
  ListChecks,
  Rocket,
  Timer,
} from 'lucide-react'

import { ButtonLink, Card, Pill, Skeleton, formatDuration } from '@/components/ui'
import { useCatalogStats, useTracks } from '@/lib/queries'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'

export function Landing() {
  const { data: stats } = useCatalogStats()
  const { data: tracks, isLoading } = useTracks()
  const authenticated = useAuth((s) => s.status === 'authenticated')
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <span className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#04121d' }}
          >
            DE
          </span>
          <span className="text-sm font-semibold">Bootcamp Data Engineering</span>
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            {theme === 'dark' ? 'Clair' : 'Sombre'}
          </button>
          <ButtonLink to={authenticated ? '/app' : '/connexion'} variant="outline">
            {authenticated ? 'Reprendre' : 'Se connecter'}
          </ButtonLink>
        </div>
      </header>

      {/* ------------------------------------------------------------- hero */}
      <section className="mx-auto max-w-6xl px-5 pt-10 pb-16 text-center">
        <Pill color="var(--accent)">
          <Rocket size={12} /> Programme complet · 100 % gratuit
        </Pill>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          Devenez Data Engineer,
          <br />
          <span style={{ color: 'var(--accent)' }}>du premier script au poste de Senior.</span>
        </h1>
        <p
          className="mx-auto mt-5 max-w-2xl text-lg text-pretty"
          style={{ color: 'var(--text-muted)' }}
        >
          35 modules progressifs, 2 projets intégrateurs, des centaines d'exercices et des schémas
          d'architecture clairs. Suivez votre progression, validez vos acquis par des quiz notés.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to={authenticated ? '/app' : '/inscription'}>
            {authenticated ? 'Reprendre mon parcours' : 'Commencer gratuitement'}
            <ArrowRight size={16} />
          </ButtonLink>
          <ButtonLink to="/app/curriculum" variant="outline">
            Voir le programme
          </ButtonLink>
        </div>

        {stats && (
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: BookOpen, value: stats.modules, label: 'modules' },
              { icon: Boxes, value: stats.projects, label: 'projets' },
              { icon: ListChecks, value: stats.lessons, label: 'leçons' },
              { icon: Timer, value: formatDuration(stats.total_minutes), label: 'de contenu' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="text-center">
                <Icon size={18} className="mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ tracks */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="mb-6 text-center text-2xl font-semibold">Trois niveaux, un seul parcours</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}
          {tracks?.map((track) => (
            <Card key={track.slug} className="flex flex-col p-6">
              <span className="text-3xl">{track.icon}</span>
              <h3 className="mt-3 text-lg font-semibold">{track.title}</h3>
              <p className="text-sm font-medium" style={{ color: track.color }}>
                {track.subtitle}
              </p>
              <p className="mt-3 flex-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {track.description}
              </p>
              <div
                className="mt-5 flex items-center gap-2 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                <Pill color={track.color}>{track.module_count} modules</Pill>
                <Pill>{track.estimated_weeks} semaines</Pill>
              </div>
              <Link
                to={`/app/curriculum/${track.slug}`}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium"
                style={{ color: track.color }}
              >
                Explorer le niveau <ArrowRight size={14} />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Images,
              title: 'Des schémas, pas de l’art ASCII',
              body: `Les architectures des notebooks sont converties en diagrammes vectoriels lisibles, zoomables, adaptés au thème clair et sombre${
                stats ? ` (${stats.diagrams_converted}/${stats.diagrams} déjà convertis)` : ''
              }.`,
            },
            {
              icon: ListChecks,
              title: 'Progression et quiz notés',
              body: 'Chaque leçon terminée rapporte de l’XP, alimente votre série quotidienne et débloque des badges. Les quiz sont corrigés côté serveur.',
            },
            {
              icon: GitBranch,
              title: 'Le contenu reste dans Git',
              body: 'Les notebooks du dépôt sont la source de vérité : un import réindexe modules, leçons, exercices et quiz sans rien ressaisir.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-6">
              <Icon size={20} style={{ color: 'var(--accent)' }} />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                {body}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <footer
        className="border-t py-8 text-center text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        Bootcamp Data Engineering — From Zero to Hero · Contenu MIT
      </footer>
    </div>
  )
}
