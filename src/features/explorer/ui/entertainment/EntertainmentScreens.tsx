import type { StringKey } from '../../../../shared/i18n'
import { t } from '../../../../shared/i18n'
import { ExplorerPage } from '../ExplorerPage'
import { VenueDetailPage } from '../VenueDetailPage'

const BASE = '/entertainment'

const KINDS: Record<string, StringKey> = {
  show: 'ent.kind.show', music: 'ent.kind.music', deck: 'ent.kind.deck', studio: 'ent.kind.studio', casino: 'ent.kind.casino',
}
const kindLabels = (): Record<string, string> => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, t(v)]))

/** The Entertainment Explorer: the show rooms, music lounges, pool decks, Princess Live! and the casino, each with what is on there next. Nothing here is booked, so there is no reservations list. */
export function EntertainmentExplorerScreen() {
  return <ExplorerPage kind="entertainment" tour="ent-shows" basePath={BASE} kindLabels={kindLabels()} />
}

/** One entertainment venue: its hours for the day and everything on there, each with a toggle that adds it to your plan. */
export function EntertainmentVenueScreen() {
  return <VenueDetailPage kind="entertainment" basePath={BASE} backLabel={t('route.entertainment')} />
}
