import { useState } from 'react'
import { Award, Flame, Save, Sparkles, Target } from 'lucide-react'

import {
  Button,
  Card,
  Pill,
  ProgressBar,
  Skeleton,
  StatTile,
  formatDuration,
} from '@/components/ui'
import { api } from '@/lib/api'
import { useDashboard } from '@/lib/queries'
import { useAuth } from '@/store/auth'
import type { User } from '@/lib/types'

const inputClass =
  'w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]'
const inputStyle = {
  background: 'var(--surface-2)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
}

export function Profile() {
  const { user, patchUser } = useAuth()
  const { data: dashboard } = useDashboard()
  const [form, setForm] = useState({
    display_name: user?.display_name ?? '',
    job_title: user?.job_title ?? '',
    bio: user?.bio ?? '',
    weekly_goal_minutes: user?.weekly_goal_minutes ?? 300,
  })
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!user) return <Skeleton className="h-96" />

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const updated = await api.patch<User>('/auth/me/', form)
      patchUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setBusy(false)
    }
  }

  const weeklyMinutes = Math.round((dashboard?.seconds_spent ?? 0) / 60)
  const goalPercent = form.weekly_goal_minutes
    ? Math.min(100, Math.round((weeklyMinutes / form.weekly_goal_minutes) * 100))
    : 0

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        <span
          className="grid h-16 w-16 place-items-center rounded-2xl text-2xl font-semibold"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {(user.display_name || user.username).slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.display_name || user.username}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {user.job_title || 'Apprenant Data Engineering'} · membre depuis le{' '}
            {new Date(user.date_joined).toLocaleDateString('fr-FR')}
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Expérience" value={`${user.xp} XP`} icon={<Sparkles size={16} />} />
        <StatTile
          label="Série"
          value={`${user.current_streak} j`}
          hint={`record ${user.longest_streak} j`}
          icon={<Flame size={16} />}
          accent="#fb923c"
        />
        <StatTile
          label="Badges"
          value={user.badges.length}
          icon={<Award size={16} />}
          accent="#a78bfa"
        />
        <StatTile
          label="Temps cumulé"
          value={formatDuration(weeklyMinutes)}
          icon={<Target size={16} />}
          accent="#34d399"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* --------------------------------------------------------- form */}
        <Card className="p-6">
          <h2 className="mb-4 font-semibold">Mon profil</h2>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="display_name">
                Nom affiché
              </label>
              <input
                id="display_name"
                className={inputClass}
                style={inputStyle}
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="job_title">
                Poste actuel
              </label>
              <input
                id="job_title"
                className={inputClass}
                style={inputStyle}
                placeholder="Data Analyst, étudiant…"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="bio">
                Bio
              </label>
              <textarea
                id="bio"
                rows={3}
                className={inputClass}
                style={inputStyle}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="goal">
                Objectif hebdomadaire (minutes)
              </label>
              <input
                id="goal"
                type="number"
                min={30}
                step={30}
                className={inputClass}
                style={inputStyle}
                value={form.weekly_goal_minutes}
                onChange={(e) =>
                  setForm({ ...form, weekly_goal_minutes: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                <Save size={15} /> {busy ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {saved && (
                <span className="text-sm" style={{ color: '#34d399' }}>
                  Profil mis à jour
                </span>
              )}
            </div>
          </form>
        </Card>

        {/* ------------------------------------------------------- badges */}
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="mb-2 font-semibold">Objectif hebdomadaire</h2>
            <p className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {formatDuration(weeklyMinutes)} sur {formatDuration(form.weekly_goal_minutes)}
            </p>
            <ProgressBar percent={goalPercent} height={8} />
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-semibold">Badges</h2>
            {user.badges.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Terminez un premier module pour débloquer votre premier badge.
              </p>
            ) : (
              <ul className="space-y-3">
                {user.badges.map(({ badge, unlocked_at }) => (
                  <li key={badge.slug} className="flex items-start gap-3">
                    <span className="text-xl">{badge.icon}</span>
                    <span>
                      <span className="block text-sm font-medium">{badge.name}</span>
                      <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                        {badge.description} · débloqué le{' '}
                        {new Date(unlocked_at).toLocaleDateString('fr-FR')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {dashboard && (
            <Card className="p-6">
              <h2 className="mb-4 font-semibold">Avancement</h2>
              <div className="space-y-4">
                {Object.entries(dashboard.tracks).map(([slug, track]) => (
                  <div key={slug}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span>{track.title}</span>
                      <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {track.percent} %
                      </span>
                    </div>
                    <ProgressBar percent={track.percent} color={track.color} height={5} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>{dashboard.lessons_done} leçons</Pill>
                <Pill>{dashboard.modules_completed} modules</Pill>
                <Pill>{dashboard.quizzes_passed} quiz</Pill>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
