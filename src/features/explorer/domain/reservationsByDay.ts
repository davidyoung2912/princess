import type { SpaView } from '../../../shared/api/spaTypes'
import type { DiningView, ExcursionsView } from '../../../shared/api/types'
import { DINNER_MINUTES } from '../../../domain/groupBoard'
import { clashMap, sortItems, type PlanItem } from './planTimeline'
import { tourPath } from './planItems'
import type { ExplorerStage } from './stage'

const MIN = 60_000

/** This day, or every day of the trip. */
export type ReservationScope = 'day' | 'trip'

/** Before sailing the whole trip is the useful view; aboard and after it is the chosen day. An explicit `?view=` always wins. */
export function reservationScope(param: string | null, stage: ExplorerStage): ReservationScope {
  if (param === 'trip' || param === 'day') return param
  return stage === 'ahead' ? 'trip' : 'day'
}

/** One reservation, appointment or tour on the trip, with the day it falls on and where to open it. */
export interface TripItem extends PlanItem {
  day: number
  /** Ship date "YYYY-MM-DD". */
  date: string
  /** The Explorer page that owns it, opened at that item. */
  to: string
}

export interface TripDay { day: number; date: string; items: TripItem[] }

/** The reservations and what other items each overlaps (touching ends do not count). */
export const tripClashes = (items: readonly TripItem[]): Map<string, TripItem[]> => clashMap(items) as Map<string, TripItem[]>

/**
 * Every dinner, spa appointment and booked tour of the trip in time order, from the three views the server already serves.
 * `dates[n - 1]` is the ship date of day n; a booking on a day the itinerary does not have is left out. `atMs` turns a ship date and "HH:MM" into an instant.
 */
export function tripItems(o: { dining: DiningView | null; spa: SpaView | null; tours: ExcursionsView | null; dates: readonly string[]; diningTitle: (venueId: string) => string; atMs: (date: string, time: string) => number }): TripItem[] {
  const out: TripItem[] = []
  for (const r of o.dining?.reservations ?? []) {
    const date = o.dates[r.day - 1]
    if (!date) continue
    const title = o.diningTitle(r.venueId)
    const startAt = o.atMs(date, r.time)
    out.push({ id: r.id, kind: 'dining', explorer: 'dining', venueId: r.venueId, title, venueTitle: title, placeId: '', start: r.time, startAt, endAt: startAt + DINNER_MINUTES * MIN, status: 'on', day: r.day, date, to: `/dining-today/${r.venueId}?day=${r.day}` })
  }
  for (const a of o.spa?.appointments ?? []) {
    const date = o.dates[a.day - 1]
    if (!date) continue
    out.push({ id: a.id, kind: 'spa', explorer: 'spa', venueId: a.venueId, title: a.title, venueTitle: a.title, placeId: '', start: a.time, startAt: a.startAt, endAt: a.startAt + a.minutes * MIN, status: 'on', day: a.day, date, to: `/spa-explorer/${a.venueId}?day=${a.day}` })
  }
  for (const b of o.tours?.booked ?? []) {
    if (b.status !== 'booked') continue
    const offer = o.tours?.offers.find((x) => x.item.id === b.excursionId)
    if (!offer) continue
    const startAt = o.atMs(offer.date, offer.item.start)
    const endAt = Math.max(startAt + MIN, o.atMs(offer.date, offer.backBy))
    out.push({ id: b.id, kind: 'tour', explorer: 'activities', venueId: '', title: offer.item.name, venueTitle: offer.item.name, placeId: '', start: offer.item.start, startAt, endAt, status: 'on', day: offer.day, date: offer.date, to: tourPath(offer.item.id, offer.day) })
  }
  return sortItems(out)
}

/** The items grouped by day in day order, each day's items in time order. Days without an item are left out. */
export function groupByDay<T extends { day: number; date: string; id: string; startAt: number; endAt: number }>(items: readonly T[]): { day: number; date: string; items: T[] }[] {
  const days = new Map<number, { day: number; date: string; items: T[] }>()
  for (const i of sortItems(items)) {
    const d = days.get(i.day) ?? { day: i.day, date: i.date, items: [] }
    d.items.push(i)
    days.set(i.day, d)
  }
  return [...days.values()].sort((a, b) => a.day - b.day)
}
