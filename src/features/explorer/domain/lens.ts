import type { JourneyStage } from '../../../app/routes/hubs'
import type { StringKey } from '../../../shared/i18n/locales/en'
import { BOOKABLE_EXPLORERS, type ActionGate, type ExplorerId } from './actionGate'

/** Where each of the seven Explorers lives. */
export const EXPLORER_ROUTES: Readonly<Record<ExplorerId, string>> = {
  dining: '/dining-today', excursions: '/excursions-explorer', spa: '/spa-explorer', entertainment: '/entertainment', shopping: '/shopping-today', exercise: '/exercise-explorer', activities: '/activities-explorer',
}

/** The text key of an Explorer's name (the existing route titles). */
export const EXPLORER_TITLE_KEYS: Readonly<Record<ExplorerId, StringKey>> = {
  dining: 'route.diningToday', excursions: 'route.excursionsExplorer', spa: 'route.spaExplorer', entertainment: 'route.entertainment', shopping: 'route.shoppingToday', exercise: 'route.exerciseExplorer', activities: 'route.activitiesExplorer',
}

/** What the guest is doing in each stage, which decides the order of the tiles. Before sailing, dining and excursions lead; aboard, today's items do. */
const BEFORE_SAILING: readonly JourneyStage[] = ['dream', 'discover', 'book', 'manage', 'prebook', 'getToShip']
export function explorerOrder(stage: JourneyStage): readonly ExplorerId[] {
  if (BEFORE_SAILING.includes(stage)) return ['dining', 'excursions', 'spa', 'entertainment', 'shopping', 'exercise', 'activities']
  if (stage === 'remember') return ['dining', 'excursions', 'spa', 'entertainment', 'shopping', 'exercise', 'activities']
  return ['entertainment', 'dining', 'excursions', 'spa', 'activities', 'exercise', 'shopping']
}

export interface TileLine {
  /** A text key in the `en` file. */
  key: StringKey
  params?: Record<string, string | number>
}

export interface LensInput {
  stage: JourneyStage
  explorer: ExplorerId
  gate: ActionGate
  /** The next thing the guest has in this Explorer today, already worded ("dinner at 7:00"). Aboard stages only. */
  next?: string
  /** What the server's views count: tables booked and specialty meals still covered, tours in the cart. */
  counts?: { booked?: number; toGo?: number; inCart?: number }
}

const SEE: Record<ExplorerId, StringKey> = {
  dining: 'explorers.see.dining', excursions: 'explorers.see.excursions', spa: 'explorers.see.spa', entertainment: 'explorers.see.events', shopping: 'explorers.see.events', exercise: 'explorers.see.events', activities: 'explorers.see.events',
}
const BOOK: Record<'dining' | 'excursions' | 'spa', StringKey> = { dining: 'explorers.book.dining', excursions: 'explorers.book.excursions', spa: 'explorers.book.spa' }
const PAST: Record<ExplorerId, StringKey> = {
  dining: 'explorers.past.dining', excursions: 'explorers.past.excursions', spa: 'explorers.past.spa', entertainment: 'explorers.past.events', shopping: 'explorers.past.events', exercise: 'explorers.past.events', activities: 'explorers.past.events',
}

const isBookable = (e: ExplorerId): e is 'dining' | 'excursions' | 'spa' => BOOKABLE_EXPLORERS.includes(e)

/**
 * The second line of a front-door tile, from the stage table (plan section 12.1) and the gate. The stage chooses the words; the gate chooses what is true.
 * Returns null where the plan says to show nothing. It never says "disabled": a closed action always gives its reason.
 */
export function tileLine({ stage, explorer, gate, next, counts }: LensInput): TileLine | null {
  if (stage === 'remember') return { key: PAST[explorer] }
  if (stage === 'disembark') return explorer === 'dining' && next ? { key: 'explorers.last.dining' } : null
  if (!isBookable(explorer)) {
    if (stage === 'embark' || stage === 'sea' || stage === 'port') return next ? { key: 'explorers.on.now', params: { what: next } } : { key: SEE[explorer] }
    return stage === 'manage' || stage === 'prebook' || stage === 'getToShip' ? { key: 'explorers.plan' } : { key: SEE[explorer] }
  }
  switch (gate.status) {
    case 'needsBooking': return stage === 'book' ? { key: 'explorers.afterBooking' } : { key: SEE[explorer] }
    case 'opensOn': return { key: 'explorers.opensOn', params: { date: gate.opensOn ?? '' } }
    case 'readOnly': return { key: 'explorers.readOnly' }
    case 'closed': return { key: 'explorers.closed' }
    case 'finished': return { key: PAST[explorer] }
    case 'open': break
  }
  if (stage === 'dream' || stage === 'discover') return { key: SEE[explorer] }
  if (stage === 'book') return { key: 'explorers.afterBooking' }
  if (stage === 'manage') return { key: 'explorers.open.now' }
  if (stage === 'prebook' || stage === 'getToShip') {
    const booked = counts?.booked ?? 0
    const toGo = counts?.toGo ?? 0
    if (explorer === 'dining' && booked > 0) return toGo > 0 ? { key: 'explorers.bookedToGo', params: { booked, toGo } } : { key: 'explorers.booked', params: { booked } }
    if (explorer === 'excursions' && (counts?.inCart ?? 0) > 0) return { key: 'explorers.inCart', params: { count: counts?.inCart ?? 0 } }
    return { key: BOOK[explorer] }
  }
  return next ? { key: 'explorers.next', params: { what: next } } : { key: BOOK[explorer] }
}

export type FirstBlock = 'booking' | 'trip' | 'today' | 'saved'
export type ReservationScope = 'day' | 'trip'

export interface Lens {
  headingKey: StringKey
  purposeKey: StringKey
  first: FirstBlock
  scope: ReservationScope
}

/**
 * The words and emphasis a page takes in a stage: which block leads and whether it opens on This day or Whole trip.
 * It never says a thing is enabled or disabled; that stays with the gate.
 */
export function explorerLens(stage: JourneyStage, gate: ActionGate): Lens {
  const headingKey = 'explorers.heading' as const
  if (stage === 'dream' || stage === 'discover' || stage === 'book') return { headingKey, purposeKey: 'explorers.purpose.research', first: 'saved', scope: 'trip' }
  if (stage === 'remember') return { headingKey, purposeKey: 'explorers.purpose.past', first: 'trip', scope: 'trip' }
  if (stage === 'manage') return { headingKey, purposeKey: gate.status === 'open' ? 'explorers.purpose.plan' : 'explorers.purpose.wait', first: 'booking', scope: 'trip' }
  if (stage === 'prebook' || stage === 'getToShip') return { headingKey, purposeKey: 'explorers.purpose.plan', first: 'booking', scope: 'trip' }
  return { headingKey, purposeKey: 'explorers.purpose.aboard', first: 'today', scope: 'day' }
}
