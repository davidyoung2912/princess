import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The audit gate of multi-device plan 2 (Phase 7). The goal is a thin client: no screen reads an authored catalogue or a simulation straight from
 * a domain module, and nothing outside the stores keeps data in `localStorage`. Both lists below are a ratchet: they hold what still does so today
 * (each is work for a later phase), a new file doing the same fails the test, and a file that no longer does must be taken off the list.
 */
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))

/** Domain modules that hold an authored catalogue or a simulation a server now serves or will serve. */
const CATALOGUE = ['pricing', 'sailings', 'excursions', 'dining', 'ports', 'portCrowd', 'pulse', 'cabinScore']
const importsCatalogue = (text: string): boolean =>
  CATALOGUE.some((m) => new RegExp(`from '(\\.\\./)+domain/${m}'`).test(text))

describe('audit gate', () => {
  it('has no screen importing an authored catalogue or simulation module beyond the known list', () => {
    const found = files('src/ui').filter((f) => importsCatalogue(readFileSync(f, 'utf8'))).map((f) => f.replaceAll('\\', '/')).sort()
    expect(found).toEqual(KNOWN_CATALOGUE_SCREENS)
  })

  it('keeps localStorage inside the stores, settings, sync and runtime', () => {
    const outside = files('src')
      .filter((f) => !f.endsWith('.d.ts'))
      .filter((f) => /\blocalStorage\b/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replaceAll('\\', '/'))
      .filter((f) => !LOCAL_STORAGE_OK.some((ok) => f.startsWith(ok)))
      .sort()
    expect(outside).toEqual(KNOWN_LOCAL_STORAGE_OUTSIDE)
  })
})

/** Screens that still read the catalogue straight from the client (Phase 4 moves them to the server's copy). */
const KNOWN_CATALOGUE_SCREENS: string[] = [
  'src/ui/ConfirmCharge.tsx',
  'src/ui/DemoScreen.tsx',
  'src/ui/ThreeClocks.tsx',
  'src/ui/aboard/DrinksScreen.tsx',
  'src/ui/aboard/GroupTable.tsx',
  'src/ui/aboard/InfoScreens.tsx',
  'src/ui/aboard/MoneyScreen.tsx',
  'src/ui/aboard/PortExtras.tsx',
  'src/ui/aboard/TvScreen.tsx',
  'src/ui/aboard/common.tsx',
  'src/ui/account/CalmScreen.tsx',
  'src/ui/account/LedgerScreen.tsx',
  'src/ui/account/MeScreen.tsx',
  'src/ui/account/MemoryScreen.tsx',
  'src/ui/account/NotificationsScreen.tsx',
  'src/ui/account/PaymentsScreen.tsx',
  'src/ui/account/PrintScreen.tsx',
  'src/ui/account/TripScreen.tsx',
  'src/ui/account/TripsScreen.tsx',
  'src/ui/account/WrappedScreen.tsx',
  'src/ui/account/tripParts.tsx',
  'src/ui/ahead/BookAheadScreens.tsx',
  'src/ui/ahead/ContactScreens.tsx',
  'src/ui/ahead/QuizScreen.tsx',
  'src/ui/ahead/ReadyScreens.tsx',
  'src/ui/ahead/UpgradesScreen.tsx',
  'src/ui/ai/DayScreen.tsx',
  'src/ui/book/BalanceScreen.tsx',
  'src/ui/book/BookScreen.tsx',
  'src/ui/book/ConfirmedScreen.tsx',
  'src/ui/book/FareStep.tsx',
  'src/ui/book/GuestsStep.tsx',
  'src/ui/book/ManageBooking.tsx',
  'src/ui/book/PayPanel.tsx',
  'src/ui/book/PayStep.tsx',
  'src/ui/book/PerksPanel.tsx',
  'src/ui/book/ReviewStep.tsx',
  'src/ui/book/RoomStep.tsx',
  'src/ui/book/SailingStep.tsx',
  'src/ui/discover/CabinChooserScreen.tsx',
  'src/ui/discover/CruiseScreen.tsx',
  'src/ui/discover/DecideScreen.tsx',
  'src/ui/discover/Landing.tsx',
  'src/ui/discover/PortScreen.tsx',
  'src/ui/discover/SailingScreen.tsx',
  'src/ui/discover/SailingsScreen.tsx',
  'src/ui/discover/SavedScreen.tsx',
  'src/ui/discover/TripCostScreen.tsx',
  'src/ui/discover/parts.tsx',
  'src/ui/extras/HealthScreens.tsx',
  'src/ui/extras/LaundryScreen.tsx',
  'src/ui/extras/OrderScreen.tsx',
  'src/ui/extras/PhotosScreen.tsx',
  'src/ui/extras/WifiScreen.tsx',
  'src/ui/finish/CasesScreen.tsx',
  'src/ui/finish/FinalBillScreen.tsx',
  'src/ui/finish/HistoryScreen.tsx',
  'src/ui/finish/LoyaltyScreen.tsx',
  'src/ui/finish/OnwardScreen.tsx',
  'src/ui/finish/RebookScreen.tsx',
  'src/ui/home/BriefingScreen.tsx',
  'src/ui/home/DelayedScreen.tsx',
  'src/ui/home/HomeScreen.tsx',
  'src/ui/home/NudgeCards.tsx',
  'src/ui/home/PrepCards.tsx',
  'src/ui/offers/Offers.tsx',
  'src/ui/onboard/AboardMoreScreens.tsx',
  'src/ui/onboard/BillScreen.tsx',
  'src/ui/onboard/BudgetCard.tsx',
  'src/ui/onboard/FinishMoreScreens.tsx',
  'src/ui/onboard/MoneyShieldCards.tsx',
  'src/ui/onboard/OnboardHome.tsx',
  'src/ui/onboard/Planner.tsx',
  'src/ui/onboard/PortCard.tsx',
  'src/ui/onboard/PortDayScreen.tsx',
  'src/ui/onboard/PortGuideScreen.tsx',
  'src/ui/onboard/PortParty.tsx',
  'src/ui/onboard/PortPilot.tsx',
  'src/ui/onboard/PulseScreen.tsx',
  'src/ui/onboard/ReservationsScreen.tsx',
  'src/ui/onboard/SkyScreen.tsx',
  'src/ui/onboard/VenuesScreen.tsx',
  'src/ui/onboard/common.tsx',
  'src/ui/onboard/shipTime.ts',
  'src/ui/plan/AtSeaScreen.tsx',
  'src/ui/plan/DiningScreen.tsx',
  'src/ui/plan/ExcursionsScreen.tsx',
  'src/ui/plan/JourneyScreen.tsx',
  'src/ui/plan/PackagesScreen.tsx',
  'src/ui/plan/PhoneScreen.tsx',
  'src/ui/plan/PlanningScreens.tsx',
  'src/ui/plan/PrepMoreScreens.tsx',
  'src/ui/plan/PrepScreens.tsx',
  'src/ui/plan/SlotWatch.tsx',
  'src/ui/plan/TravelScreen.tsx',
  'src/ui/plan/WeekPlanner.tsx',
  'src/ui/plan/WhatIfScreen.tsx',
]
const LOCAL_STORAGE_OK = ['src/ai/', 'src/data/', 'src/design/', 'src/demo/', 'src/hub/', 'src/journey/', 'src/memory/', 'src/offers/', 'src/party/', 'src/phone/', 'src/pilot/', 'src/port/', 'src/runtime/', 'src/settings/', 'src/shop/', 'src/sync/', 'src/auth/', 'src/diagnostics/', 'src/rates/', 'src/feeds/feed.ts', 'src/hooks/useOutbox.ts', 'src/hooks/useSavedCopy.ts']
/** Screens that keep a small device-only setting themselves (diagnostics switch, a support draft, the pass finder). */
const KNOWN_LOCAL_STORAGE_OUTSIDE: string[] = ['src/ui/DiagnosticsSettings.tsx', 'src/ui/aboard/SupportScreens.tsx', 'src/ui/boarding/FindPassScreen.tsx']
