import { BrowserRouter, Route, Routes } from 'react-router'
import { SCREENS } from './screens'
import { NotFound } from './ui/NotFound'
import { Placeholder } from './ui/Placeholder'
import { Shell } from './ui/Shell'
import { ROUTES } from './routes/routes'

/** Every screen, built from the route table, inside the shell. Separate from the router so tests can render it in memory. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        {ROUTES.map((route) => {
          const Screen = SCREENS[route.path]
          return <Route key={route.path} path={route.path} element={Screen ? <Screen /> : <Placeholder route={route} />} />
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
      <AppRoutes />
    </BrowserRouter>
  )
}
