import type { StringKey } from '../../../../shared/i18n'
import { t } from '../../../../shared/i18n'
import { ExplorerPage } from '../ExplorerPage'
import { MoreLinks } from '../Parts'
import { VenueDetailPage } from '../VenueDetailPage'

const BASE = '/activities-explorer'

const KINDS: Record<string, StringKey> = {
  quiet: 'acex.kind.quiet', talks: 'acex.kind.talks', workshop: 'acex.kind.workshop', community: 'acex.kind.community', family: 'acex.kind.family', deck: 'acex.kind.deck', desk: 'acex.kind.desk',
}
const kindLabels = (): Record<string, string> => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, t(v)]))

/** The Activities Explorer: the card tables, talks, workshops, meet-ups, Camp Discovery and the open decks, each with its hours and what is on next. Nothing is booked here, so there is no reservations list. */
export function ActivitiesExplorerScreen() {
  return <ExplorerPage kind="activities" basePath={BASE} kindLabels={kindLabels()} above={() => <MoreLinks links={[{ to: '/ship/games', label: t('route.games') }, { to: '/ship/community', label: t('route.community') }]} />} />
}

/** One activity hub: its hours for the day and every event there, each with a toggle that adds it to your plan. */
export function ActivitiesVenueScreen() {
  return <VenueDetailPage kind="activities" basePath={BASE} backLabel={t('route.activitiesExplorer')} />
}
