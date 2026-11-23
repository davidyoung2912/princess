import { Fragment, lazy, Suspense, useSyncExternalStore, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { getLocale, subscribeLocale } from './i18n'
import { SCREENS } from './screens'
import { NotFound } from './ui/NotFound'
import { Shell } from './ui/Shell'
import { SignInGate } from './ui/SignInScreen'
import { REDIRECTS, ROUTES, isPublicPath } from './routes/routes'

/** The page a hand-over address opens. It is not a screen of the app (it is not in the route table or any menu): a scanned code or a copied link lands here, after sign-in if needed. */
const ShareReceive = lazy(() => import('./ui/scan/ShareReceiveScreen').then((m) => ({ default: m.ShareReceiveScreen })))

/** Every screen, built from the route table, inside the shell. Separate from the router so tests can render it in memory. */
export function AppRoutes() {
  return (
    <Routes>
      {ROUTES.filter((r) => r.public).map((route) => {
        const Screen = SCREENS[route.path]
        return <Route key={route.path} path={route.path} element={<Suspense fallback={null}><Screen /></Suspense>} />
      })}
      <Route element={<Shell />}>
        {ROUTES.filter((r) => !r.public).map((route) => {
          const Screen = SCREENS[route.path]
          return <Route key={route.path} path={route.path} element={<Screen />} />
        })}
        <Route path="/s" element={<Suspense fallback={null}><ShareReceive /></Suspense>} />
        <Route path="/s/:code" element={<Suspense fallback={null}><ShareReceive /></Suspense>} />
        {REDIRECTS.map((r) => <Route key={r.from} path={r.from} element={<ForwardTo to={r.to} />} />)}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

/** Sends an old address to its new home, keeping any query the old link carried (the target's own query wins). */
function ForwardTo({ to }: { to: string }) {
  const { search } = useLocation()
  const [path, own = ''] = to.split('?')
  const merged = new URLSearchParams(search)
  for (const [k, v] of new URLSearchParams(own)) merged.set(k, v)
  const q = merged.toString()
  return <Navigate to={q ? `${path}?${q}` : path} replace />
}

/** The app root: the browser router around the routes. */
export default function App() {
  return (
    <BrowserRouter>
      <LanguageKey>
        <PublicOrSignedIn>
          <AppRoutes />
        </PublicOrSignedIn>
      </LanguageKey>
    </BrowserRouter>
  )
}

/** A family link or the trial day opens without an account; everything else waits for sign-in. */
function PublicOrSignedIn({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return isPublicPath(pathname) ? <>{children}</> : <SignInGate>{children}</SignInGate>
}

/** Draws everything again when the language changes, since text is read when a screen is drawn. */
function LanguageKey({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale)
  return <Fragment key={locale}>{children}</Fragment>
}
