import type { ExplorerEvent, ExplorerVenueInfo, HoursDay } from '../../api/explorerTypes'
import { dayPhase, eventPhase } from './upcoming'
import type { TimedEvent, Window } from './types'

const mins = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

export type OpenState =
  | { kind: 'openNow'; until: string }
  | { kind: 'opensAt'; at: string }
  | { kind: 'closedNow' }
  | { kind: 'alongside' }
  | { kind: 'closedDay' }
  | { kind: 'openAllDay' }
  | { kind: 'finished' }

const allDay = (w: readonly Window[]): boolean => w.length === 1 && w[0][0] === '00:00' && w[0][1] === '24:00'

/**
 * Whether a venue is open, for the chosen day. `now` is the ship's "HH:MM" and is used only when the chosen day is the ship's day.
 * A future day lists the first opening; a past day only says it has finished.
 */
export function openState(hours: HoursDay, chosenDay: number, currentDay: number, now: string): OpenState {
  if (hours.windows.length === 0) return hours.closedBecause === 'alongside' ? { kind: 'alongside' } : { kind: 'closedDay' }
  const phase = dayPhase(chosenDay, currentDay)
  if (phase === 'past') return { kind: 'finished' }
  if (allDay(hours.windows)) return { kind: 'openAllDay' }
  if (phase === 'future') return { kind: 'opensAt', at: hours.windows[0][0] }
  const at = mins(now)
  const inside = hours.windows.find(([a, b]) => at >= mins(a) && at < mins(b))
  if (inside) return { kind: 'openNow', until: inside[1] }
  const next = hours.windows.find(([a]) => mins(a) > at)
  return next ? { kind: 'opensAt', at: next[0] } : { kind: 'closedNow' }
}

/** Whether a meal's serving time has passed: any meal of an earlier day, none of a later day, and on the ship's day one whose end is at or before now. A meal that runs past midnight is not over until the day is. */
export function mealOver(meal: { from: string; to: string }, chosenDay: number, currentDay: number, now: string): boolean {
  const phase = dayPhase(chosenDay, currentDay)
  if (phase !== 'current') return phase === 'past'
  return mins(meal.to) > mins(meal.from) && mins(meal.to) <= mins(now)
}

/** A guest's reservation or event as the span of time it fills, in epoch ms. */
export interface Span { id: string; title: string; startAt: number; endAt: number }

/** The spans in `others` that overlap the event (touching ends do not count). */
export const clashesWith = (e: Pick<ExplorerEvent, 'id' | 'startAt' | 'endAt'>, others: readonly Span[]): Span[] =>
  others.filter((o) => o.id !== e.id && o.startAt < e.endAt && e.startAt < o.endAt)

export interface VenueFilter { kind: string | null; query: string }

/** Venues of the chosen kind whose title or text contains the words searched for. */
export function filterVenues<V extends Pick<ExplorerVenueInfo, 'kind' | 'title' | 'short' | 'long'>>(venues: readonly V[], f: VenueFilter): V[] {
  const words = f.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return venues.filter((v) => (f.kind === null || v.kind === f.kind) && words.every((w) => `${v.title} ${v.short} ${v.long}`.toLowerCase().includes(w)))
}

/** The kinds the venues have, in the order they first appear, for the filter chips. */
export const kindsOf = (venues: readonly { kind: string }[]): string[] => [...new Set(venues.map((v) => v.kind))]

/** Venue lists longer than this get a search box. */
export const SEARCH_FROM = 12

/** "Day 3 of 7": null outside the sailing. */
export const dayCount = (day: number, total: number): string => `${day} of ${total}`

/** "Tue, Nov 12" for a "YYYY-MM-DD" ship date. */
export const shortDate = (date: string): string => new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))

/** Cancelled events that would still be listed if they were running: shown struck through, never counted among a card's upcoming events. */
export function cancelledListed<E extends TimedEvent>(events: readonly E[], o: { chosenDay: number; currentDay: number; now: number }): E[] {
  const phase = dayPhase(o.chosenDay, o.currentDay)
  if (phase === 'past') return []
  return events.filter((e) => e.status === 'cancelled' && (phase === 'future' || eventPhase(e, o.now) !== 'over')).sort((a, b) => a.startAt - b.startAt)
}

/** Whether an event with limited places is nearly full (a quarter or fewer left, or three or fewer). */
export const fillingUp = (e: Pick<ExplorerEvent, 'capacity' | 'left'>): boolean => e.capacity !== undefined && e.left !== undefined && e.left > 0 && (e.left <= 3 || e.left * 4 <= e.capacity)
