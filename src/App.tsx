import type { ComponentType } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { BalanceScreen } from './ui/book/BalanceScreen'
import { BookScreen } from './ui/book/BookScreen'
import { ConfirmedScreen } from './ui/book/ConfirmedScreen'
import { ResumeScreen } from './ui/book/ResumeScreen'
import { CruiseScreen } from './ui/discover/CruiseScreen'
import { Landing } from './ui/discover/Landing'
import { PortScreen } from './ui/discover/PortScreen'
import { SailingScreen } from './ui/discover/SailingScreen'
import { SailingsScreen } from './ui/discover/SailingsScreen'
import { SavedScreen } from './ui/discover/SavedScreen'
import { ShipScreen } from './ui/discover/ShipScreen'
import { ContactScreen } from './ui/account/ContactScreen'
import { DocumentsScreen } from './ui/account/DocumentsScreen'
import { HelpCentreScreen } from './ui/account/HelpCentreScreen'
import { HelperScreen } from './ui/account/HelperScreen'
import { MeScreen } from './ui/account/MeScreen'
import { NotificationsScreen } from './ui/account/NotificationsScreen'
import { PaymentsScreen } from './ui/account/PaymentsScreen'
import { ProfileScreen } from './ui/account/ProfileScreen'
import { TripScreen } from './ui/account/TripScreen'
import { TripsScreen } from './ui/account/TripsScreen'
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
  '/book': BookScreen,
  '/book/:id': BookScreen,
  '/book/confirmed/:id': ConfirmedScreen,
  '/book/resume/:id': ResumeScreen,
  '/book/pay/:id': BalanceScreen,
  '/me': MeScreen,
  '/me/trips': TripsScreen,
  '/me/trips/:id': TripScreen,
  '/me/profile': ProfileScreen,
  '/me/profile/:id': ProfileScreen,
  '/me/documents': DocumentsScreen,
  '/me/payments': PaymentsScreen,
  '/me/notifications': NotificationsScreen,
  '/me/helper': HelperScreen,
  '/me/help': HelpCentreScreen,
  '/me/contact': ContactScreen,
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
