import type { StringKey } from '../i18n'

/** The five main areas; each owns a tab (phone) or rail entry (desktop). */
export type TabId = 'home' | 'plan' | 'ship' | 'chat' | 'me'

export interface RouteDef {
  /** react-router path pattern. */
  path: string
  titleKey: StringKey
  /** The tab this screen belongs to, or null for screens outside the five areas. */
  tab: TabId | null
  /** The build phase that replaces the placeholder with the real screen (requirements §21). */
  phase: number
  /** Shows the "unofficial concept" notice (Home and Me, per the design language). */
  notice?: boolean
}

/** Every screen. The router is built from this table, and the navigation model is tested against it. */
export const ROUTES: readonly RouteDef[] = [
  { path: '/', titleKey: 'route.home', tab: 'home', phase: 5, notice: true },
  { path: '/home/boarding-pass', titleKey: 'route.boardingPass', tab: 'home', phase: 5 },
  { path: '/home/find-pass', titleKey: 'route.findPass', tab: 'home', phase: 5 },
  { path: '/home/check-in', titleKey: 'route.checkin', tab: 'home', phase: 5 },
  { path: '/home/check-in/receipt', titleKey: 'route.receipt', tab: 'home', phase: 5 },
  { path: '/home/check-in/terminal', titleKey: 'route.terminalCheckin', tab: 'home', phase: 5 },
  { path: '/home/check-in/:id', titleKey: 'route.checkin', tab: 'home', phase: 5 },
  { path: '/home/embarkation', titleKey: 'route.embarkation', tab: 'home', phase: 5 },
  { path: '/home/embarkation/steps', titleKey: 'route.companion', tab: 'home', phase: 5 },
  { path: '/home/disembark', titleKey: 'route.disembark', tab: 'home', phase: 8 },
  { path: '/home/disembark/customs', titleKey: 'route.customs', tab: 'home', phase: 8 },
  { path: '/home/disembark/onward', titleKey: 'route.onward', tab: 'home', phase: 8 },
  { path: '/home/disembark/final-night', titleKey: 'route.finalNight', tab: 'home', phase: 8 },
  { path: '/home/cruise', titleKey: 'route.cruise', tab: 'home', phase: 1 },
  { path: '/home/sailings', titleKey: 'route.sailings', tab: 'home', phase: 1 },
  { path: '/home/sailings/:id', titleKey: 'route.sailing', tab: 'home', phase: 1 },
  { path: '/home/ports/:id', titleKey: 'route.port', tab: 'home', phase: 1 },
  { path: '/home/ship', titleKey: 'route.sunPrincess', tab: 'home', phase: 1 },
  { path: '/home/saved', titleKey: 'route.saved', tab: 'home', phase: 1 },
  { path: '/plan', titleKey: 'route.plan', tab: 'plan', phase: 4 },
  { path: '/plan/reservations', titleKey: 'route.reservations', tab: 'plan', phase: 6 },
  { path: '/plan/reservations/:id', titleKey: 'route.reservation', tab: 'plan', phase: 6 },
  { path: '/plan/excursions', titleKey: 'route.excursions', tab: 'plan', phase: 4 },
  { path: '/plan/dining', titleKey: 'route.dining', tab: 'plan', phase: 4 },
  { path: '/plan/checklist', titleKey: 'route.checklist', tab: 'plan', phase: 4 },
  { path: '/plan/packing', titleKey: 'route.packing', tab: 'plan', phase: 4 },
  { path: '/plan/travel', titleKey: 'route.travel', tab: 'plan', phase: 4 },
  { path: '/plan/assistance', titleKey: 'route.assistance', tab: 'plan', phase: 4 },
  { path: '/ship', titleKey: 'route.ship', tab: 'ship', phase: 6 },
  { path: '/ship/map', titleKey: 'route.deckMap', tab: 'ship', phase: 6 },
  { path: '/ship/venues', titleKey: 'route.venues', tab: 'ship', phase: 6 },
  { path: '/ship/venues/:id', titleKey: 'route.venue', tab: 'ship', phase: 6 },
  { path: '/ship/muster', titleKey: 'route.muster', tab: 'ship', phase: 6 },
  { path: '/ship/emergency', titleKey: 'route.emergency', tab: 'ship', phase: 6 },
  { path: '/ship/port', titleKey: 'route.portDay', tab: 'ship', phase: 6 },
  { path: '/ship/order', titleKey: 'route.order', tab: 'ship', phase: 7 },
  { path: '/ship/family', titleKey: 'route.family', tab: 'ship', phase: 7 },
  { path: '/ship/health', titleKey: 'route.health', tab: 'ship', phase: 7 },
  { path: '/ship/help-now', titleKey: 'route.helpNow', tab: 'ship', phase: 7 },
  { path: '/ship/room', titleKey: 'route.room', tab: 'ship', phase: 7 },
  { path: '/ship/photos', titleKey: 'route.photos', tab: 'ship', phase: 7 },
  { path: '/ship/laundry', titleKey: 'route.laundry', tab: 'ship', phase: 7 },
  { path: '/ship/wifi', titleKey: 'route.wifi', tab: 'ship', phase: 7 },
  { path: '/chat', titleKey: 'route.chat', tab: 'chat', phase: 6 },
  { path: '/book', titleKey: 'route.book', tab: 'home', phase: 3 },
  { path: '/book/:id', titleKey: 'route.book', tab: 'home', phase: 3 },
  { path: '/book/confirmed/:id', titleKey: 'route.bookConfirmed', tab: 'home', phase: 3 },
  { path: '/book/resume/:id', titleKey: 'route.bookResume', tab: 'home', phase: 3 },
  { path: '/book/pay/:id', titleKey: 'route.bookPay', tab: 'home', phase: 3 },
  { path: '/me', titleKey: 'route.me', tab: 'me', phase: 2, notice: true },
  { path: '/me/trips', titleKey: 'route.trips', tab: 'me', phase: 2 },
  { path: '/me/trips/:id', titleKey: 'route.trip', tab: 'me', phase: 2 },
  { path: '/me/profile', titleKey: 'route.profile', tab: 'me', phase: 2 },
  { path: '/me/profile/:id', titleKey: 'route.profile', tab: 'me', phase: 2 },
  { path: '/me/documents', titleKey: 'route.documents', tab: 'me', phase: 2 },
  { path: '/me/payments', titleKey: 'route.payments', tab: 'me', phase: 2 },
  { path: '/me/notifications', titleKey: 'route.notifications', tab: 'me', phase: 2 },
  { path: '/me/helper', titleKey: 'route.helper', tab: 'me', phase: 2 },
  { path: '/me/help', titleKey: 'route.helpCentre', tab: 'me', phase: 2 },
  { path: '/me/contact', titleKey: 'route.contact', tab: 'me', phase: 2 },
  { path: '/me/bill', titleKey: 'route.bill', tab: 'me', phase: 6 },
  { path: '/me/bill/final', titleKey: 'route.finalBill', tab: 'me', phase: 8 },
  { path: '/me/cases', titleKey: 'route.cases', tab: 'me', phase: 8 },
  { path: '/me/feedback', titleKey: 'route.feedback', tab: 'me', phase: 8 },
  { path: '/me/history', titleKey: 'route.history', tab: 'me', phase: 8 },
  { path: '/me/loyalty', titleKey: 'route.loyalty', tab: 'me', phase: 8 },
  { path: '/me/rebook', titleKey: 'route.rebook', tab: 'me', phase: 8 },
  { path: '/me/sustainability', titleKey: 'route.sustainability', tab: 'me', phase: 8 },
  { path: '/me/packages', titleKey: 'route.packages', tab: 'me', phase: 4 },
  { path: '/me/settings', titleKey: 'route.settings', tab: 'me', phase: 0 },
  { path: '/me/demo', titleKey: 'route.demo', tab: 'me', phase: 0 },
  { path: '/kit', titleKey: 'route.kit', tab: null, phase: 0 },
]
