import { placeById } from './deck'
import type { DatedEvent, EventInterest } from './program'

/** The order the entertainment page lists a day in: latest start first (the default) or earliest first. */
export type EntertainmentOrder = 'latest' | 'earliest'

export interface EntertainmentFilter {
  /** Interest categories to show; none chosen means all. */
  interests: readonly EventInterest[]
  /** One venue (a place id), or null for all. */
  placeId: string | null
}

export const NO_ENTERTAINMENT_FILTER: EntertainmentFilter = { interests: [], placeId: null }

/** The venues that host something in the list, by name, for the venue picker. */
export function venuesOf(list: readonly DatedEvent[]): { id: string; name: string }[] {
  const seen = new Map<string, string>()
  for (const e of list) if (!seen.has(e.placeId)) seen.set(e.placeId, placeById(e.placeId)?.name ?? e.placeId)
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

/** The interest categories that have something in the list, in the order given. */
export const interestsOf = (list: readonly DatedEvent[], all: readonly EventInterest[]): EventInterest[] => all.filter((i) => list.some((e) => e.interest === i))

/** Applies the category and venue choices, then the order. Cancelled events stay in the list (the page shows them struck through). */
export function arrangeDay(list: readonly DatedEvent[], f: EntertainmentFilter, order: EntertainmentOrder): DatedEvent[] {
  const kept = list.filter((e) => (f.interests.length === 0 || f.interests.includes(e.interest)) && (f.placeId === null || e.placeId === f.placeId))
  return [...kept].sort((a, b) => (order === 'latest' ? b.startAt - a.startAt : a.startAt - b.startAt) || a.title.localeCompare(b.title))
}

/**
 * Where each listed event stands against the clock: `over` ended already (or was cancelled), `now` is on, `next` is the earliest group of events still
 * to start (everything starting at that same minute), `later` is the rest.
 */
export type Standing = 'over' | 'now' | 'next' | 'later'

export function standings(list: readonly DatedEvent[], now: number): Map<string, Standing> {
  const upcoming = list.filter((e) => e.status !== 'cancelled' && e.startAt > now)
  const first = upcoming.reduce<number | null>((m, e) => (m === null || e.startAt < m ? e.startAt : m), null)
  const out = new Map<string, Standing>()
  for (const e of list) {
    if (e.status === 'cancelled' || e.endAt <= now) out.set(e.id, 'over')
    else if (e.startAt <= now) out.set(e.id, 'now')
    else out.set(e.id, e.startAt === first ? 'next' : 'later')
  }
  return out
}
