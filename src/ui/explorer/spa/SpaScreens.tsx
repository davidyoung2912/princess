import { useNavigate, useParams, useSearchParams } from 'react-router'
import type { StringKey } from '../../../i18n'
import { t } from '../../../i18n'
import type { SpaView } from '../../../api/spaTypes'
import { spaBookingCard } from '../../../domain/explorer/bookingState'
import { useExplorerStage } from '../../../hooks/useExplorerStage'
import { useReservationScope } from '../../../hooks/useReservationScope'
import { Saved } from '../../onboard/common'
import { BookingCard } from '../BookingCard'
import { ReservationScope } from '../ReservationScope'
import { ExplorerPage } from '../ExplorerPage'
import { VenueDetailPage } from '../VenueDetailPage'
import { SpaReservations } from './SpaReservations'
import { appointmentSpans, useSpaView } from './spaView'
import { SpaEditor } from './SpaEditor'
import { useExplorerData, useExplorerDay } from '../../../hooks/useExplorer'

const BASE = '/spa-explorer'

const KINDS: Record<string, StringKey> = { spa: 'spa.kind.spa', salon: 'spa.kind.salon', thermal: 'spa.kind.thermal', sanctuary: 'spa.kind.sanctuary' }
const kindLabels = (): Record<string, string> => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, t(v)]))

/** The Spa Explorer: your appointments for the day, then the spa, salon, thermal suite and sanctuary with what is on there next. */
export function SpaExplorerScreen() {
  const view = useSpaView()
  const [params] = useSearchParams()
  const [scope, setScope] = useReservationScope()
  if (params.get('book')) return <BookPage />
  return (
    <ExplorerPage
      kind="spa" basePath={BASE} kindLabels={kindLabels()}
      above={({ data, state }) => (
        <Saved copy={view}>
          {(v) => (
            <>
              <SpaBooking view={v} />
              <ReservationScope scope={scope} onChange={setScope} />
              <SpaReservations venues={data.venues} day={state.day} view={v} reload={view.retry} basePath={BASE} scope={scope} />
            </>
          )}
        </Saved>
      )}
    />
  )
}

/** Whether the guest can book a treatment, the cancellation rule and the party limit. */
function SpaBooking({ view }: { view: SpaView }) {
  const { stage } = useExplorerStage()
  return <BookingCard model={spaBookingCard(view, stage)} labelledBy="spa-book-h" />
}

/** One spa venue: its hours, its treatments, what is on there and your appointments. */
export function SpaVenueScreen() {
  const { venueId = '' } = useParams()
  const view = useSpaView()
  const [params] = useSearchParams()
  if (params.get('book')) return <BookPage venueId={venueId} />
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

/** Book a treatment, or change an appointment: its own page, opened by `?book=new` (optionally `&treatment=<id>`) or `?book=<appointment id>` on the Spa Explorer or a venue's page. */
function BookPage({ venueId }: { venueId?: string }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const state = useExplorerDay()
  const view = useSpaView()
  const data = useExplorerData('spa', state.day)
  const book = params.get('book') ?? 'new'
  const back = `${venueId ? `${BASE}/${venueId}` : BASE}?day=${state.day}`
  const changing = book === 'new' ? undefined : view.data?.appointments.find((a) => a.id === book)
  return (
    <div className="page">
      <Saved copy={view}>
        {(v) => (
          <SpaEditor
            view={v} day={state.day} venues={(data.data?.venues ?? []).filter((x) => x.venue.bookable === 'spa').map((x) => ({ id: x.venue.id, title: x.venue.title }))}
            venueId={venueId} treatmentId={params.get('treatment') ?? undefined} appointment={changing} backTo={back} backLabel={t('route.spaExplorer')}
            onClose={() => { void navigate(back) }} onDone={() => { view.retry() }}
          />
        )}
      </Saved>
    </div>
  )
}
