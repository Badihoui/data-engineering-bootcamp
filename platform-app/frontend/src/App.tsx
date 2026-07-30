import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { ButtonLink, EmptyState, Skeleton } from '@/components/ui'
import { Landing } from '@/pages/Landing'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'

/* Route-level splitting: the markdown/diagram machinery only ships with the
   lesson and quiz routes, not with the landing page. */
const Login = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.Register })))
const Curriculum = lazy(() => import('@/pages/Curriculum').then((m) => ({ default: m.Curriculum })))
const TrackDetail = lazy(() =>
  import('@/pages/Curriculum').then((m) => ({ default: m.TrackDetail })),
)
const ModuleList = lazy(() => import('@/pages/Curriculum').then((m) => ({ default: m.ModuleList })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const LessonView = lazy(() => import('@/pages/LessonView').then((m) => ({ default: m.LessonView })))
const ModuleDetail = lazy(() =>
  import('@/pages/ModuleDetail').then((m) => ({ default: m.ModuleDetail })),
)
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })))
const QuizView = lazy(() => import('@/pages/QuizView').then((m) => ({ default: m.QuizView })))
const Workshop = lazy(() => import('@/pages/Workshop').then((m) => ({ default: m.Workshop })))
const Glossary = lazy(() => import('@/pages/Glossary').then((m) => ({ default: m.Glossary })))
const Review = lazy(() => import('@/pages/Review').then((m) => ({ default: m.Review })))
const Library = lazy(() => import('@/pages/Library').then((m) => ({ default: m.Library })))
const Achievements = lazy(() =>
  import('@/pages/Achievements').then((m) => ({ default: m.Achievements })),
)

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status)
  if (status === 'idle' || status === 'loading') return null
  if (status !== 'authenticated') return <Navigate to="/connexion" replace />
  return <>{children}</>
}

export default function App() {
  const hydrate = useAuth((s) => s.hydrate)
  const initTheme = useTheme((s) => s.init)

  useEffect(() => {
    initTheme()
    hydrate()
  }, [hydrate, initTheme])

  return (
    <Routes>
      {/* Les routes hors layout ont leur propre frontière : rien à préserver
          au-dessus d'elles. */}
      <Route
        path="/"
        element={
          <Suspense fallback={<Skeleton className="m-6 h-64" />}>
            <Landing />
          </Suspense>
        }
      />
      <Route
        path="/connexion"
        element={
          <Suspense fallback={<Skeleton className="m-6 h-64" />}>
            <Login />
          </Suspense>
        }
      />
      <Route
        path="/inscription"
        element={
          <Suspense fallback={<Skeleton className="m-6 h-64" />}>
            <Register />
          </Suspense>
        }
      />

      {/* AppLayout porte sa propre frontière Suspense autour de <Outlet/>.
          Une frontière placée ici démonterait le layout — barre, menu,
          animations — à chaque première visite d'une route paresseuse. */}
      <Route path="/app" element={<AppLayout />}>
        <Route
          index
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route path="curriculum" element={<Curriculum />} />
        <Route path="curriculum/:trackSlug" element={<TrackDetail />} />
        <Route path="atelier" element={<Workshop />} />
        <Route path="glossaire" element={<Glossary />} />
        <Route
          path="bibliotheque"
          element={
            <RequireAuth>
              <Library />
            </RequireAuth>
          }
        />
        <Route
          path="reussites"
          element={
            <RequireAuth>
              <Achievements />
            </RequireAuth>
          }
        />
        <Route
          path="revision"
          element={
            <RequireAuth>
              <Review />
            </RequireAuth>
          }
        />
        <Route path="modules" element={<ModuleList />} />
        <Route path="modules/:moduleSlug" element={<ModuleDetail />} />
        <Route path="modules/:moduleSlug/quiz" element={<QuizView />} />
        <Route path="modules/:moduleSlug/:lessonSlug" element={<LessonView />} />
        <Route
          path="profil"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <EmptyState
            title="Page introuvable"
            description="Le lien que vous avez suivi ne mène nulle part."
            action={<ButtonLink to="/app">Retour au tableau de bord</ButtonLink>}
          />
        }
      />
    </Routes>
  )
}
