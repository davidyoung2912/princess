import { useParams } from 'react-router'
import type { StringKey } from '../../../i18n'
import { zonedToEpoch } from '../../../domain/timezones'
import { shipZoneOnDate } from '../../../domain/sailings'
import { useSailing } from '../../../hooks/useDemo'
import { t } from '../../../i18n'
import { Saved } from '../../onboard/common'
import { ExplorerPage } from '../ExplorerPage'
import { VenueDetailPage } from '../VenueDetailPage'
import { DiningReservations } from './DiningReservations'
import { reservationSpans, useDiningView } from './diningView'

const BASE = '/dining-today'

const KINDS: Record<string, StringKey> = { main: 'exp.dining.kind.main', specialty: 'exp.dining.kind.specialty', casual: 'exp.dining.kind.casual', bar: 'exp.dining.kind.bar' }
const kindLabels = (): Record<string, string> => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, t(v)]))

/** The Dining Explorer: your reservations for the day, then every place to eat and drink with what is on there next. */
export function DiningExplorerScreen() {
  const view = useDiningView()
  return (
    <ExplorerPage
      kind="dining" basePath={BASE} kindLabels={kindLabels()}
      above={({ data, state }) => (
        <Saved copy={view}>
          {(v) => <DiningReservations venues={data.venues} day={state.day} view={v} reload={view.retry} basePath={BASE} />}
        </Saved>
      )}
    />
  )
}

/** One place to eat or drink: its menu for the day, its events and your reservations there. */
export function DiningVenueScreen() {
  const { venueId = '' } = useParams()
  const view = useDiningView()
  const sailing = useSailing()
  return (
    <VenueDetailPage
      kind="dining" basePath={BASE} backLabel={t('route.diningToday')}
      busy={({ explorerDay, state }) => {
        const date = explorerDay?.date
        if (!date) return []
        const zone = shipZoneOnDate(sailing, date)
        return reservationSpans(view.data, state.day, date, (id) => explorerDay.venues.find((v) => v.venue.id === id)?.venue.title ?? id, (d, time) => zonedToEpoch(d, time, zone))
      }}
      above={({ venue, explorerDay, state }) => {
        if (venue.venue.bookable !== 'dining' || !view.data) return null
        return <DiningReservations venues={explorerDay?.venues ?? [venue]} day={state.day} venueId={venueId} view={view.data} reload={view.retry} />
      }}
    />
  )
}
