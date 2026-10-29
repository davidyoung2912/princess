import { backBy, EXCURSIONS, filterExcursions, NO_FILTER, timingProblem, type ExcursionItem, type Interest } from './excursions'
import { eventsOn, filterEvents, NO_EVENT_FILTER, type DatedEvent, type EventInterest } from './program'
import { formatMoney, type Cents } from './pricing'
import { itinerary, type Sailing } from './sailings'

/** "Build my day" (PRE-12): a suggested day for one port or sea day from what the guest likes and how they get around. Pure; the same wishes always give the same day. */
export type Mobility = 'any' | 'easy' | 'wheelchair'

export interface DayWish {
  tours: readonly Interest[]
  events: readonly EventInterest[]
  mobility: Mobility
  /** Children are in the party: suggest family events and tours, not adults-only ones. */
  withKids: boolean
  /** Most to spend on a tour per adult, or null for no limit. */
  maxTour: Cents | null
}

export const NO_WISH: DayWish = { tours: [], events: [], mobility: 'any', withKids: false, maxTour: null }

export type DayItemKind = 'tour' | 'event' | 'dinner'

export interface DayItem {
  kind: DayItemKind
  id: string
  title: string
  /** Local port time for a tour, ship time for the rest: "HH:MM". */
  start: string
  /** Why this was chosen, as a short phrase. */
  why: string
  /** Where in the app to see or book it. */
  path: string
}

export interface DayPlan {
  day: number
  items: DayItem[]
  /** Nothing but dinner could be matched to the wishes. */
  empty: boolean
  /** The time to be back at the ship for the tour, when there is one. */
  backBy: string | null
}

export const DINNER_START = '18:30'

const minutesOf = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

const tourScore = (x: ExcursionItem, wish: DayWish): number => x.interests.filter((i) => wish.tours.includes(i)).length * 10 + x.rating

/** The tour that suits the wishes best for a port day and fits the ship's day, or null. */
export function bestTour(s: Sailing, day: number, wish: DayWish): ExcursionItem | null {
  const d = itinerary(s)[day - 1]
  if (!d || d.port === 'sea' || d.port === 'fll') return null
  const list = filterExcursions(EXCURSIONS, {
    ...NO_FILTER,
    port: d.port,
    family: wish.withKids,
    accessible: wish.mobility === 'wheelchair',
    maxActivity: wish.mobility === 'any' ? null : 'easy',
    maxPrice: wish.maxTour,
  }).filter((x) => !timingProblem(x, d))
  return [...list].sort((a, b) => tourScore(b, wish) - tourScore(a, wish) || a.id.localeCompare(b.id))[0] ?? null
}

/** Up to `limit` events that suit the wishes, are still on, and do not crowd each other. */
export function pickEvents(s: Sailing, day: number, wish: DayWish, limit: number): DatedEvent[] {
  const ages: readonly string[] = wish.withKids ? ['all', 'kids', 'teens'] : ['all', 'adults']
  const base = eventsOn(s, day, false).filter((e) => e.status === 'on' && ages.includes(e.age))
  const open = filterEvents(base, { ...NO_EVENT_FILTER, stepFree: wish.mobility !== 'any' }, 0)
  const liked = open.filter((e) => wish.events.length === 0 || wish.events.includes(e.interest))
  const chosen: DatedEvent[] = []
  for (const e of liked) {
    if (chosen.length >= limit) break
    const last = chosen[chosen.length - 1]
    // At least an hour between starts, so the day is spread rather than packed.
    if (last && (e.startAt < last.endAt || e.startAt - last.startAt < 60 * 60_000)) continue
    chosen.push(e)
  }
  return chosen
}

/** A suggested day. A port day has a tour that fits the ship's day and one ship event; a sea day has up to three events; the first seven days end with dinner. */
export function buildDay(s: Sailing, day: number, wish: DayWish): DayPlan {
  const d = itinerary(s)[day - 1]
  if (!d) return { day, items: [], empty: true, backBy: null }
  const items: DayItem[] = []
  const tour = bestTour(s, day, wish)
  if (tour) {
    const matched = tour.interests.some((i) => wish.tours.includes(i))
    items.push({ kind: 'tour', id: tour.id, title: tour.name, start: tour.start, why: matched ? 'matches what you like' : 'the best rated that fits the ship’s day', path: '/plan/excursions' })
  }
  for (const e of pickEvents(s, day, wish, d.port === 'sea' ? 3 : 1)) {
    items.push({ kind: 'event', id: e.id, title: e.title, start: e.start, why: e.extra > 0 ? `extra cost ${formatMoney(e.extra)} each` : 'included in your fare', path: '/plan' })
  }
  const real = items.length
  if (day <= 7) items.push({ kind: 'dinner', id: 'eclipse', title: 'Dinner in the Eclipse Dining Room', start: DINNER_START, why: wish.mobility === 'any' ? 'main dining room, included' : 'main dining room, level access', path: '/plan/dining' })
  items.sort((a, b) => minutesOf(a.start) - minutesOf(b.start) || a.id.localeCompare(b.id))
  return { day, items, empty: real === 0, backBy: tour ? backBy(tour, d) : null }
}
