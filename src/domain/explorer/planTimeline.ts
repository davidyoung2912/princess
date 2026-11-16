import { placeById, type Section } from '../deck'
import type { EventStatus, ExplorerKind } from './types'

export type PlanItemKind = 'event' | 'dining' | 'spa' | 'tour'
export type Period = 'morning' | 'afternoon' | 'evening'

/** One line of Today's Plan, whatever it came from: a planned event, a dinner reservation, a spa appointment or a booked shore excursion. */
export interface PlanItem {
  id: string
  kind: PlanItemKind
  /** Which Explorer it belongs to, for the link back. */
  explorer: ExplorerKind
  venueId: string
  title: string
  venueTitle: string
  /** The deck-plan place the venue is at, for the walking hint. */
  placeId: string
  /** Ship time "HH:MM". */
  start: string
  startAt: number
  endAt: number
  status: EventStatus
  was?: string
  reason?: string
  /** What the event is, in a sentence or two (events of the Explorers). */
  detail?: string
  /** Where the line links to when it is not an Explorer venue page (a shore excursion links to the excursions screen). */
  link?: string
}

const MIN = 60_000

/** Earliest first; ties by end, then id, so the order never jumps between renders. */
export const sortItems = <T extends Pick<PlanItem, 'id' | 'startAt' | 'endAt'>>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt || a.id.localeCompare(b.id))

/** Morning is before noon, afternoon before 5 pm, evening after. */
export function periodOf(start: string): Period {
  const h = Number(start.slice(0, 2))
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

export const PERIODS: readonly Period[] = ['morning', 'afternoon', 'evening']

/** Items in time order, grouped by part of the day; empty parts are left out. */
export function groupByPeriod<T extends Pick<PlanItem, 'id' | 'start' | 'startAt' | 'endAt'>>(items: readonly T[]): { period: Period; items: T[] }[] {
  const sorted = sortItems(items)
  return PERIODS.map((period) => ({ period, items: sorted.filter((i) => periodOf(i.start) === period) })).filter((g) => g.items.length > 0)
}

/** For each item, the other running items it overlaps (touching ends do not count). Cancelled items never clash. */
export function clashMap(items: readonly PlanItem[]): Map<string, PlanItem[]> {
  const live = items.filter((i) => i.status !== 'cancelled')
  const out = new Map<string, PlanItem[]>()
  for (const a of live) {
    const hits = live.filter((b) => b.id !== a.id && b.startAt < a.endAt && a.startAt < b.endAt)
    if (hits.length > 0) out.set(a.id, hits)
  }
  return out
}

/** Planned items the ship has moved or cancelled, with its reason, for the banner. */
export const disrupted = (items: readonly PlanItem[]): PlanItem[] => sortItems(items.filter((i) => i.status !== 'on'))

const SECTION: Record<Section, number> = { forward: 0, midship: 1, aft: 2 }

/**
 * About how many minutes it takes to walk between two places on the ship: a minute to find the lift or stairs, half a minute a deck, two minutes a section along.
 * An estimate from the deck plan, not a route. Null when either place is not on the plan, 0 for the same place.
 */
export function walkMinutes(fromPlaceId: string, toPlaceId: string): number | null {
  const a = placeById(fromPlaceId)
  const b = placeById(toPlaceId)
  if (!a || !b) return null
  if (a.id === b.id) return 0
  const decks = Math.abs(a.deck - b.deck)
  const sections = Math.abs(SECTION[a.section] - SECTION[b.section])
  return Math.max(1, Math.ceil((decks > 0 ? 1 : 0) + decks * 0.5 + sections * 2))
}

export interface WalkHint {
  /** The item the guest walks from. */
  from: PlanItem
  minutes: number
  /** When to set off to arrive as the next item starts. */
  leaveBy: number
  /** The gap does not cover the walk. */
  tight: boolean
}

/** The walk to each item from the running item before it, keyed by the later item's id. Only where the places are known and the two do not overlap. */
export function walkHints(items: readonly PlanItem[]): Map<string, WalkHint> {
  const live = sortItems(items.filter((i) => i.status !== 'cancelled'))
  const out = new Map<string, WalkHint>()
  for (let n = 1; n < live.length; n++) {
    const from = live[n - 1]
    const to = live[n]
    if (to.startAt < from.endAt) continue
    const minutes = walkMinutes(from.placeId, to.placeId)
    if (minutes === null || minutes === 0) continue
    out.set(to.id, { from, minutes, leaveBy: to.startAt - minutes * MIN, tight: to.startAt - from.endAt < minutes * MIN })
  }
  return out
}

/** The running items on now, with the minutes left in each (rounded up). Only meaningful on the ship's own day. */
export function happeningNow<E extends { id: string; startAt: number; endAt: number; status: EventStatus }>(events: readonly E[], now: number): { event: E; minutesLeft: number }[] {
  return sortItems(events.filter((e) => e.status !== 'cancelled' && e.startAt <= now && now < e.endAt)).map((event) => ({ event, minutesLeft: Math.ceil((event.endAt - now) / MIN) }))
}
