import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  BookMarked,
  Brain,
  BookOpen,
  Flame,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Moon,
  Search,
  Route,
  Sparkles,
  Sun,
  TerminalSquare,
  Trophy,
  User as UserIcon,
  X,
} from 'lucide-react'

import { CommandPalette } from './CommandPalette'
import { Skeleton, cx } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'

const NAV = [
  { to: '/app', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/app/curriculum', label: 'Curriculum', icon: Route },
  { to: '/app/modules', label: 'Modules', icon: BookOpen },
  { to: '/app/atelier', label: 'Atelier', icon: TerminalSquare },
  { to: '/app/revision', label: 'Révision', icon: Brain },
  { to: '/app/bibliotheque', label: 'Bibliothèque', icon: Library },
  { to: '/app/glossaire', label: 'Glossaire', icon: BookMarked },
  { to: '/app/reussites', label: 'Réussites', icon: Trophy },
  { to: '/app/profil', label: 'Profil', icon: UserIcon },
]

function Brand() {
  return (
    <Link to="/app" className="flex items-center gap-2.5">
      <span
        className="grid h-9 w-9 place-items-center rounded-xl text-sm font-bold"
        style={{ background: 'var(--accent)', color: '#04121d' }}
      >
        DE
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">Bootcamp Data Eng.</span>
        <span className="block text-[0.68rem]" style={{ color: 'var(--text-muted)' }}>
          From Zero to Hero
        </span>
      </span>
    </Link>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive ? '' : 'hover:opacity-80',
            )
          }
          style={({ isActive }) => ({
            background: isActive ? 'var(--accent-soft)' : 'transparent',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
          })}
        >
          <Icon size={17} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout() {
  const { user, logout, status } = useAuth()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="min-h-screen">
      <CommandPalette />
      {/* ------------------------------------------------------------ topbar */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 lg:px-6">
          <button
            type="button"
            className="rounded-lg p-2 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            style={{ color: 'var(--text-muted)' }}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Brand />

          <div className="ml-auto flex items-center gap-2">
            {user && (
              <>
                <span
                  className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex"
                  style={{ background: 'var(--surface-3)' }}
                  title="Expérience cumulée"
                >
                  <Sparkles size={13} style={{ color: 'var(--accent)' }} />
                  {user.xp} XP
                </span>
                <span
                  className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex"
                  style={{ background: 'var(--surface-3)' }}
                  title="Jours consécutifs"
                >
                  <Flame size={13} className="text-orange-400" />
                  {user.current_streak}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() =>
                document.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
                )
              }
              aria-label="Rechercher"
              title="Rechercher (⌘K)"
              className="hidden items-center gap-2 rounded-xl border px-3 py-1.5 text-xs sm:flex"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <Search size={14} />
              Rechercher
              <kbd
                className="rounded border px-1 py-0.5 text-[0.6rem]"
                style={{ borderColor: 'var(--border)' }}
              >
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label="Changer de thème"
              className="rounded-lg p-2 transition hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {status === 'authenticated' ? (
              <button
                type="button"
                onClick={logout}
                aria-label="Se déconnecter"
                className="rounded-lg p-2 transition hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                <LogOut size={17} />
              </button>
            ) : (
              <Link
                to="/connexion"
                className="rounded-xl px-3 py-2 text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#04121d' }}
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 lg:px-6">
        {/* --------------------------------------------------------- sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-22">
            <NavItems />
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div
              className="absolute top-16 right-0 left-0 border-b p-4"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          {/* Seule la zone de contenu s'anime — la coquille reste en place.
              `mode="popLayout"` plutôt que `"wait"` : avec `"wait"`, une route
              paresseuse qui suspend interrompt l'animation de sortie et laisse
              AnimatePresence dans un état bloqué — la page ne s'affichait
              qu'après un rechargement. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* La frontière vit ici : le chargement d'un chunk ne démonte
                  jamais la coquille, seulement le contenu. */}
              <Suspense fallback={<Skeleton className="h-64" />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
