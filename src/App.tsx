import { Fragment, Suspense, useSyncExternalStore, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router'
import { getLocale, subscribeLocale } from './i18n'
import { SCREENS } from './screens'
import { NotFound } from './ui/NotFound'
import { Shell } from './ui/Shell'
import { SignInGate } from './ui/SignInScreen'
import { ROUTES, isPublicPath } from './routes/routes'

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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
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
