import type { StringKey } from '../../../i18n'
import { t } from '../../../i18n'
import { ExplorerPage } from '../ExplorerPage'
import { VenueDetailPage } from '../VenueDetailPage'

const BASE = '/activities-explorer'

const KINDS: Record<string, StringKey> = {
  quiet: 'acex.kind.quiet', talks: 'acex.kind.talks', workshop: 'acex.kind.workshop', community: 'acex.kind.community', family: 'acex.kind.family', deck: 'acex.kind.deck',
}
const kindLabels = (): Record<string, string> => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, t(v)]))

/** The Activities Explorer: the card tables, talks, workshops, meet-ups, Camp Discovery and the open decks, each with its hours and what is on next. Nothing is booked here, so there is no reservations list. */
export function ActivitiesExplorerScreen() {
  return <ExplorerPage kind="activities" title={t('acex.title')} purpose={t('acex.purpose')} basePath={BASE} kindLabels={kindLabels()} />
}

/** One activity hub: its hours for the day and every event there, each with a toggle that adds it to your plan. */
export function ActivitiesVenueScreen() {
  return <VenueDetailPage kind="activities" basePath={BASE} backLabel={t('route.activitiesExplorer')} />
}
