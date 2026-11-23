import type { ExplorerDay, ExplorerEvent, ExplorerVenueInfo } from '../../../shared/api/explorerTypes'
import { DINNER_MINUTES } from '../../../domain/groupBoard'
import type { PlanItem } from './planTimeline'
import type { ExplorerKind } from './types'

/** How many suggestions a plan line offers. */
export const MAX_ALTERNATIVES = 3

export type AlternativeWhy = 'series' | 'sameTitle' | 'sameInterest' | 'openThen'

/** Something else the guest could do instead of a plan line that clashes, was cancelled, or has no places left. */
export interface Alternative {
  id: string
  explorer: ExplorerKind
  venueId: string
  venueTitle: string
  title: string
  /** Ship time "HH:MM"; absent for a place that is open (a restaurant to try) rather than a timed event. */
  start?: string
  why: AlternativeWhy
}

const MIN = 60_000
const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Whether a plan line needs alternatives offered: it clashes with another, the ship cancelled or moved it, or (for an event) the places have run out. */
export const needsAlternatives = (item: PlanItem, clashes: ReadonlyMap<string, readonly PlanItem[]>): boolean =>
  item.status !== 'on' || (clashes.get(item.id)?.length ?? 0) > 0

const venueOf = (day: ExplorerDay, id: string): ExplorerVenueInfo | undefined => day.venues.find((v) => v.venue.id === id)?.venue

/**
 * Events that could stand in for `target`: another showing of the same series or title, then something of the same interest in the same Explorer.
 * Never the target itself, anything cancelled, full, already in the plan, already started, or overlapping another running plan line.
 */
export function eventAlternatives(target: PlanItem, explorers: readonly ExplorerDay[], plan: readonly PlanItem[], now: number, max = MAX_ALTERNATIVES): Alternative[] {
  const day = explorers.find((d) => d.explorer === target.explorer)
  if (!day) return []
  const source = day.venues.flatMap((v) => v.events).find((e) => e.id === target.id)
  const others = plan.filter((p) => p.id !== target.id && p.status !== 'cancelled')
  const planned = new Set(plan.map((p) => p.id))
  const scored: { e: ExplorerEvent; why: AlternativeWhy; rank: number }[] = []
  for (const v of day.venues) {
    for (const e of v.events) {
      if (e.id === target.id || e.status === 'cancelled' || e.left === 0 || planned.has(e.id) || e.startAt <= now) continue
      if (others.some((p) => p.startAt < e.endAt && e.startAt < p.endAt)) continue
      const sameSeries = !!source?.series && e.series === source.series
      const sameTitle = e.title === target.title
      const sameInterest = !!source && e.interest === source.interest
      if (!sameSeries && !sameTitle && !sameInterest) continue
      const why: AlternativeWhy = sameSeries ? 'series' : sameTitle ? 'sameTitle' : 'sameInterest'
      scored.push({ e, why, rank: sameSeries || sameTitle ? 0 : 1 })
    }
  }
  scored.sort((a, b) => a.rank - b.rank || Math.abs(a.e.startAt - target.startAt) - Math.abs(b.e.startAt - target.startAt) || a.e.id.localeCompare(b.e.id))
  return scored.slice(0, max).map(({ e, why }) => ({ id: e.id, explorer: day.explorer, venueId: e.venueId, venueTitle: venueOf(day, e.venueId)?.title ?? e.venueId, title: e.title, start: e.start, why }))
}

/**
 * Other places to eat when a reservation clashes or its restaurant changed: restaurants that take bookings, are not the one the guest has, and are open for the whole meal.
 * The app has no live table availability for a place that is not booked, so these are places to look at, not tables held.
 */
export function diningAlternatives(target: PlanItem, dining: ExplorerDay | undefined, max = MAX_ALTERNATIVES): Alternative[] {
  if (!dining) return []
  const from = toMinutes(target.start)
  const to = from + Math.round((target.endAt - target.startAt) / MIN || DINNER_MINUTES)
  return dining.venues
    .filter((v) => v.venue.id !== target.venueId && v.venue.bookable === 'dining' && v.hours.windows.some(([a, b]) => toMinutes(a) <= from && to <= toMinutes(b)))
    .sort((a, b) => a.venue.order - b.venue.order)
    .slice(0, max)
    .map((v) => ({ id: v.venue.id, explorer: 'dining' as const, venueId: v.venue.id, venueTitle: v.venue.title, title: v.venue.title, why: 'openThen' as const }))
}

/** Suggestions for one plan line, by what it is. Spa, tours and anything else get none (nothing comparable is served for them). */
export function alternativesFor(target: PlanItem, explorers: readonly ExplorerDay[], plan: readonly PlanItem[], now: number): Alternative[] {
  if (target.kind === 'event') return eventAlternatives(target, explorers, plan, now)
  if (target.kind === 'dining') return diningAlternatives(target, explorers.find((d) => d.explorer === 'dining'))
  return []
}
