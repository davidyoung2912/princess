import { useParams } from 'react-router'
import type { StringKey } from '../../../i18n'
import { t } from '../../../i18n'
import { Saved } from '../../onboard/common'
import { ExplorerPage } from '../ExplorerPage'
import { VenueDetailPage } from '../VenueDetailPage'
import { SpaReservations } from './SpaReservations'
import { appointmentSpans, useSpaView } from './spaView'

const BASE = '/spa-explorer'

const KINDS: Record<string, StringKey> = { spa: 'spa.kind.spa', salon: 'spa.kind.salon', thermal: 'spa.kind.thermal', sanctuary: 'spa.kind.sanctuary' }
const kindLabels = (): Record<string, string> => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, t(v)]))

/** The Spa Explorer: your appointments for the day, then the spa, salon, thermal suite and sanctuary with what is on there next. */
export function SpaExplorerScreen() {
  const view = useSpaView()
  return (
    <ExplorerPage
      kind="spa" title={t('spa.title')} purpose={t('spa.purpose')} basePath={BASE} kindLabels={kindLabels()}
      above={({ data, state }) => (
        <Saved copy={view}>
          {(v) => <SpaReservations venues={data.venues} day={state.day} view={v} reload={view.retry} basePath={BASE} />}
        </Saved>
      )}
    />
  )
}

/** One spa venue: its hours, its treatments, what is on there and your appointments. */
export function SpaVenueScreen() {
  const { venueId = '' } = useParams()
  const view = useSpaView()
  return (
    <VenueDetailPage
      kind="spa" basePath={BASE} backLabel={t('route.spaExplorer')}
      busy={({ state }) => appointmentSpans(view.data, state.day)}
      above={({ venue, explorerDay, state }) => {
        if (venue.venue.bookable !== 'spa' || !view.data) return null
        return <SpaReservations venues={explorerDay?.venues ?? [venue]} day={state.day} venueId={venueId} view={view.data} reload={view.retry} />
      }}
    />
  )
}
