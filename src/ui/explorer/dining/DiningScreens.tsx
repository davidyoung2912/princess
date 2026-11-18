import { carryOverVenue } from '../../../domain/explorer/shortlist'
import { usePins } from '../../../hooks/usePins'
import type { DiningView } from '../../../api/types'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import type { StringKey } from '../../../i18n'
import { zonedToEpoch } from '../../../domain/timezones'
import { shipZoneOnDate } from '../../../domain/sailings'
import { useSailing } from '../../../hooks/useDemo'
import { t } from '../../../i18n'
import { Saved } from '../../onboard/common'
import { diningBookingCard } from '../../../domain/explorer/bookingState'
import { useExplorerStage } from '../../../hooks/useExplorerStage'
import { BookingCard } from '../BookingCard'
import { LinkButton } from '../../Button'
import { CalendarCheck, CalendarDays } from '../../icons'
import { ReservationScope } from '../ReservationScope'
import { useReservationScope } from '../../../hooks/useReservationScope'
import { ExplorerPage } from '../ExplorerPage'
import { VenueDetailPage } from '../VenueDetailPage'
import { DiningReservations } from './DiningReservations'
import { reservationSpans, useDiningView } from './diningView'
import { ReservationEditor } from './ReservationEditor'
import { useExplorerData, useExplorerDay } from '../../../hooks/useExplorer'

const BASE = '/dining-today'

/** Where the guest started, when a page sent them to the editor (`state.from`): Back and Close lead there. Only an address inside the app counts. */
const originOf = (state: unknown): string | null => { const from = (state as { from?: unknown } | null)?.from; return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : null }

const KINDS: Record<string, StringKey> = { main: 'exp.dining.kind.main', specialty: 'exp.dining.kind.specialty', casual: 'exp.dining.kind.casual', bar: 'exp.dining.kind.bar' }
const kindLabels = (): Record<string, string> => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, t(v)]))

/** The Dining Explorer: your reservations for the day, then every place to eat and drink with what is on there next. */
export function DiningExplorerScreen() {
  const view = useDiningView()
  const [params] = useSearchParams()
  const [scope, setScope] = useReservationScope()
  if (params.get('reserve')) return <ReservePage />
  return (
    <ExplorerPage
      kind="dining" basePath={BASE} kindLabels={kindLabels()}
      above={({ data, state }) => (
        <Saved copy={view}>
          {(v) => (
            <>
              <DiningBooking view={v} />
              <ReservationScope scope={scope} onChange={setScope} />
              <DiningReservations venues={data.venues} day={state.day} view={v} scope={scope} />
            </>
          )}
        </Saved>
      )}
    />
  )
}

/** Whether the guest can reserve, and why not when they cannot (window, plan, seating, meals left). */
function DiningBooking({ view }: { view: DiningView }) {
  const { stage } = useExplorerStage()
  return <BookingCard model={diningBookingCard(view, stage)} labelledBy="dine-book-h" />
}

/** One place to eat or drink: its menu for the day, its events and your reservations there. */
export function DiningVenueScreen() {
  const { venueId = '' } = useParams()
  const view = useDiningView()
  const sailing = useSailing()
  const [params] = useSearchParams()
  const { stage } = useExplorerStage()
  if (params.get('reserve')) return <ReservePage venueId={venueId} />
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
        const canReserve = diningBookingCard(view.data, stage).canReserve
        return (
          <>
            <DiningReservations venues={explorerDay?.venues ?? [venue]} day={state.day} venueId={venueId} view={view.data} />
            <p className="exp-reserve-cta button-row">
              {canReserve && <LinkButton to={`${BASE}/${venueId}?day=${state.day}&reserve=new`} icon={CalendarCheck}>{t('exp.res.make')}<span className="visually-hidden"> {venue.venue.title}</span></LinkButton>}
              <LinkButton to="/plan/reservations" variant="secondary" icon={CalendarDays}>{t('exp.res.seeAll')}</LinkButton>
            </p>
          </>
        )
      }}
    />
  )
}

/** Reserve a table, or move one: its own page, opened by `?reserve=new` or `?reserve=<reservation id>` on the Dining Explorer or a venue's page. */
function ReservePage({ venueId }: { venueId?: string }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const state = useExplorerDay()
  const view = useDiningView()
  const data = useExplorerData('dining', state.day)
  const reserve = params.get('reserve') ?? 'new'
  const origin = originOf(useLocation().state)
  const back = origin ?? `${venueId ? `${BASE}/${venueId}` : BASE}?day=${state.day}`
  const moving = reserve === 'new' ? undefined : view.data?.reservations.find((r) => r.id === reserve)
  const pins = usePins()
  const tables = (data.data?.venues ?? []).filter((x) => x.venue.bookable === 'dining')
  // A new reservation starts on the first place the guest saved, when there is one; moving one, or a venue's own page, keeps its place.
  const saved = !moving && !venueId ? carryOverVenue(pins.venueKeys, 'dining', tables.map((x) => x.venue)) : null
  const choices = tables.map((x) => ({ id: x.venue.id, title: x.venue.title })).sort((a, b) => Number(b.id === saved) - Number(a.id === saved))
  return (
    <div className="page">
      <Saved copy={view}>
        {(v) => (
          <ReservationEditor
            view={v} day={state.day} venues={choices}
            venueId={venueId} reservation={moving} backTo={back} backLabel={origin ? t('route.reservations') : t('route.diningToday')}
            onClose={() => { void navigate(back) }} onDone={() => { view.retry() }}
          />
        )}
      </Saved>
    </div>
  )
}
