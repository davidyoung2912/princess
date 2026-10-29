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
  { path: '/plan', titleKey: 'route.plan', tab: 'plan', phase: 6 },
  { path: '/plan/reservations', titleKey: 'route.reservations', tab: 'plan', phase: 6 },
  { path: '/plan/reservations/:id', titleKey: 'route.reservation', tab: 'plan', phase: 6 },
  { path: '/plan/excursions', titleKey: 'route.excursions', tab: 'plan', phase: 4 },
  { path: '/ship', titleKey: 'route.ship', tab: 'ship', phase: 6 },
  { path: '/ship/map', titleKey: 'route.deckMap', tab: 'ship', phase: 6 },
  { path: '/ship/order', titleKey: 'route.order', tab: 'ship', phase: 7 },
  { path: '/ship/family', titleKey: 'route.family', tab: 'ship', phase: 7 },
  { path: '/chat', titleKey: 'route.chat', tab: 'chat', phase: 6 },
  { path: '/me', titleKey: 'route.me', tab: 'me', phase: 2, notice: true },
  { path: '/me/bill', titleKey: 'route.bill', tab: 'me', phase: 6 },
  { path: '/me/packages', titleKey: 'route.packages', tab: 'me', phase: 4 },
  { path: '/me/settings', titleKey: 'route.settings', tab: 'me', phase: 0 },
  { path: '/me/demo', titleKey: 'route.demo', tab: 'me', phase: 0 },
  { path: '/kit', titleKey: 'route.kit', tab: null, phase: 0 },
]
