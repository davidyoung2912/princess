import type { StringKey } from '../../../i18n'
import { t } from '../../../i18n'
import { ExplorerPage } from '../ExplorerPage'
import { VenueDetailPage } from '../VenueDetailPage'

const BASE = '/shopping-today'

const KINDS: Record<string, StringKey> = { shop: 'shex.kind.shop', gallery: 'shex.kind.gallery', popup: 'shex.kind.popup' }
const kindLabels = (): Record<string, string> => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, t(v)]))

/** The Shopping Explorer: the boutiques, the gallery and the pop-up markets, each with its hours (closed in port) and the sales, trunk shows and auctions on next. Nothing is booked here, so there is no reservations list. */
export function ShoppingExplorerScreen() {
  return <ExplorerPage kind="shopping" title={t('shex.title')} purpose={t('shex.purpose')} basePath={BASE} kindLabels={kindLabels()} />
}

/** One shop, gallery or market: its hours for the day and every event there, each with a toggle that adds it to your plan. */
export function ShoppingVenueScreen() {
  return <VenueDetailPage kind="shopping" basePath={BASE} backLabel={t('route.shoppingToday')} />
}
