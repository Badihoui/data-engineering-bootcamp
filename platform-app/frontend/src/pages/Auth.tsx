import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Button, Card } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/store/auth'

const inputClass =
  'w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]'
const inputStyle = {
  background: 'var(--surface-2)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
}

function Shell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#04121d' }}
          >
            DE
          </span>
          <span className="font-semibold">Bootcamp Data Engineering</span>
        </Link>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
          {children}
        </Card>
        <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          {footer}
        </p>
      </div>
    </div>
  )
}

export function Login() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (status === 'authenticated') return <Navigate to="/app" replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate('/app')
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell
      title="Content de vous revoir"
      subtitle="Reprenez votre parcours là où vous l'aviez laissé."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/inscription" style={{ color: 'var(--accent)' }}>
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
        {error && (
          <p
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: '#7f1d1d33', color: '#fca5a5' }}
          >
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
    </Shell>
  )
}

export function Register() {
  const { register, status } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ display_name: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (status === 'authenticated') return <Navigate to="/app" replace />

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register(form)
      navigate('/app')
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Inscription impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell
      title="Créer un compte"
      subtitle="Suivez votre progression, gagnez de l'XP et débloquez des badges."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to="/connexion" style={{ color: 'var(--accent)' }}>
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {(
          [
            { key: 'display_name', label: 'Nom affiché', type: 'text', autoComplete: 'name' },
            { key: 'username', label: "Nom d'utilisateur", type: 'text', autoComplete: 'username' },
            { key: 'email', label: 'Adresse e-mail', type: 'email', autoComplete: 'email' },
            {
              key: 'password',
              label: 'Mot de passe',
              type: 'password',
              autoComplete: 'new-password',
            },
          ] as const
        ).map(({ key, label, type, autoComplete }) => (
          <div key={key}>
            <label className="mb-1.5 block text-sm font-medium" htmlFor={key}>
              {label}
            </label>
            <input
              id={key}
              type={type}
              required
              autoComplete={autoComplete}
              value={form[key]}
              onChange={update(key)}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        ))}
        {error && (
          <p
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: '#7f1d1d33', color: '#fca5a5' }}
          >
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
    </Shell>
  )
}
