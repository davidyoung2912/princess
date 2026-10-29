import type { ComponentType } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { CruiseScreen } from './ui/discover/CruiseScreen'
import { Landing } from './ui/discover/Landing'
import { PortScreen } from './ui/discover/PortScreen'
import { SailingScreen } from './ui/discover/SailingScreen'
import { SailingsScreen } from './ui/discover/SailingsScreen'
import { SavedScreen } from './ui/discover/SavedScreen'
import { ShipScreen } from './ui/discover/ShipScreen'
import { DemoScreen } from './ui/DemoScreen'
import { Kit } from './ui/Kit'
import { NotFound } from './ui/NotFound'
import { Placeholder } from './ui/Placeholder'
import { SettingsScreen } from './ui/SettingsScreen'
import { Shell } from './ui/Shell'
import { ROUTES } from './routes/routes'

/** Screens that already exist; every other route shows its placeholder until the phase that builds it. */
const SCREENS: Record<string, ComponentType> = {
  '/': Landing,
  '/home/cruise': CruiseScreen,
  '/home/sailings': SailingsScreen,
  '/home/sailings/:id': SailingScreen,
  '/home/ports/:id': PortScreen,
  '/home/ship': ShipScreen,
  '/home/saved': SavedScreen,
  '/me/settings': SettingsScreen,
  '/me/demo': DemoScreen,
  '/kit': Kit,
}

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
