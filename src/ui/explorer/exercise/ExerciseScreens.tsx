import type { StringKey } from '../../../i18n'
import { t } from '../../../i18n'
import { ExplorerPage } from '../ExplorerPage'
import { VenueDetailPage } from '../VenueDetailPage'

const BASE = '/exercise-explorer'

const KINDS: Record<string, StringKey> = {
  gym: 'exex.kind.gym', studio: 'exex.kind.studio', court: 'exex.kind.court', track: 'exex.kind.track', pool: 'exex.kind.pool',
}
const kindLabels = (): Record<string, string> => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, t(v)]))

/** The Exercise Explorer: the gym, studios, courts, tracks and pools, each with its hours and the classes and games on next. Classes are signed up for at the fitness desk, so there is no reservations list. */
export function ExerciseExplorerScreen() {
  return <ExplorerPage kind="exercise" title={t('exex.title')} purpose={t('exex.purpose')} basePath={BASE} kindLabels={kindLabels()} />
}

/** One exercise venue: its hours for the day and every class or game there, each with a toggle that adds it to your plan. */
export function ExerciseVenueScreen() {
  return <VenueDetailPage kind="exercise" basePath={BASE} backLabel={t('route.exerciseExplorer')} />
}
