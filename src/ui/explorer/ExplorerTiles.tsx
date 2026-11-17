import { Link } from 'react-router'
import { actionGate, type ExplorerId, type GateFacts } from '../../domain/explorer/actionGate'
import { EXPLORER_ROUTES, EXPLORER_TITLE_KEYS, explorerOrder, tileLine, type LensInput } from '../../domain/explorer/lens'
import { bookingsOnDay } from '../../domain/explorer/excursionDay'
import { eventsOnNow, nextTable, nextTour, nextTreatment } from '../../domain/explorer/tileFacts'
import { timeIn } from '../../domain/timezones'
import type { JourneyStage } from '../../routes/hubs'
import { formatDayMonth } from '../../domain/cruise'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { useNow } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { api } from '../../runtime'
import { Compass } from '../icons'
import { ExplorerIcon } from './ExplorerIcon'
import { useDiningView } from './dining/diningView'
import { useSpaView } from './spa/spaView'

const ON_NOW_KINDS = ['entertainment', 'shopping', 'exercise', 'activities'] as const
const PRE_BOOKING: readonly JourneyStage[] = ['dream', 'discover', 'book']

function Icon({ id }: { id: ExplorerId }) {
  return id === 'excursions' ? <Compass className="explorer-icon" aria-hidden="true" focusable="false" /> : <ExplorerIcon kind={id} />
}

const lineText = (line: ReturnType<typeof tileLine>): string | null => {
  if (!line) return null
  const p = line.params
  return t(line.key, p && 'date' in p ? { ...p, date: p.date ? formatDayMonth(String(p.date)) : '' } : p)
}

function Tiles({ stage, facts, counts, next }: { stage: JourneyStage; facts: (id: ExplorerId) => GateFacts; counts: (id: ExplorerId) => LensInput['counts']; next: (id: ExplorerId) => string | undefined }) {
  return (
    <section aria-labelledby="explorers-h">
      <h2 id="explorers-h">{t('explorers.heading')}</h2>
      <ul className="card-grid" aria-label={t('explorers.list')}>
        {explorerOrder(stage).map((id) => {
          const text = lineText(tileLine({ stage, explorer: id, gate: actionGate(id, facts(id)), counts: counts(id), next: next(id) }))
          return (
            <li key={id} className="card">
              <h3><Icon id={id} /> <Link to={EXPLORER_ROUTES[id]}>{t(EXPLORER_TITLE_KEYS[id])}</Link></h3>
              {text && <p className="muted">{text}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Before a booking there is nothing to read from the booking views, so none is asked for. */
function TilesWithoutBooking({ stage }: { stage: JourneyStage }) {
  return <Tiles stage={stage} facts={() => ({ hasBooking: false, finished: false, canBook: null })} counts={() => undefined} next={() => undefined} />
}

function TilesWithBooking({ stage }: { stage: JourneyStage }) {
  const position = useJourneyPosition()
  const now = useNow()
  const dining = useDiningView().data
  const spa = useSpaView().data
  const tours = useMine(() => api.plan.excursions.list()).data
  const finished = stage === 'remember'
  const today = position.day?.kind === 'cruiseDay' ? position.day.day : null
  const aboard = position.onBoard && today !== null
  // Only aboard is "what is on now" worth reading: one read of each events Explorer for today, and nothing before then.
  const onNow = useMine(async () => {
    if (!aboard || today === null) return null
    const days = await Promise.all(ON_NOW_KINDS.map((kind) => api.onboard.explorerDay(kind, today)))
    return Object.fromEntries(ON_NOW_KINDS.map((kind, i) => [kind, days[i].venues.flatMap((v) => v.events)]))
  }, [aboard, today]).data
  const facts = (id: ExplorerId): GateFacts => {
    const base = { hasBooking: true, finished }
    if (id === 'dining') return { ...base, canBook: dining?.canBook ?? null, window: dining?.window ?? null }
    if (id === 'spa') return { ...base, canBook: spa?.canBook ?? null }
    if (id === 'excursions') return { ...base, canBook: tours?.canBook ?? null }
    return { ...base, canBook: null }
  }
  const counts = (id: ExplorerId): LensInput['counts'] => {
    if (id === 'dining' && dining) return { booked: dining.reservations.length, toGo: dining.mealsLeft }
    if (id === 'excursions' && tours) return { inCart: tours.cart.length }
    return undefined
  }
  const next = (id: ExplorerId): string | undefined => {
    if (!aboard) return undefined
    if (id === 'dining' && dining) return nextTable(dining.reservations, today, timeIn(now, position.zone)) ?? undefined
    if (id === 'spa' && spa) return nextTreatment(spa.appointments, today, now) ?? undefined
    if (id === 'excursions' && tours) return nextTour(bookingsOnDay(tours, today).map((b) => b.offer.item), timeIn(now, position.zone)) ?? undefined
    if (id !== 'dining' && id !== 'spa' && id !== 'excursions') return eventsOnNow(onNow?.[id] ?? [], now) ?? undefined
    return undefined
  }
  return <Tiles stage={stage} facts={facts} counts={counts} next={next} />
}

/**
 * The front door to the seven Explorers, open at every stage. Each tile's second line comes from the stage table and the server's own gate
 * (`actionGate`): the stage only chooses the words, never what is open.
 */
export function ExplorerTiles() {
  const { stage } = useJourneyPosition()
  return PRE_BOOKING.includes(stage) ? <TilesWithoutBooking stage={stage} /> : <TilesWithBooking stage={stage} />
}
