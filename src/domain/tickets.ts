import type { DatedEvent } from './program'
import { limit } from './limits'

/** Shows and classes with limited seats (ENT-01). Capacity is authored; seats already taken by other guests are worked out the same way every time. */
export const TICKETED: Readonly<Record<string, { capacity: number }>> = {
  'welcome-show': { capacity: 900 },
  'stage-show': { capacity: 700 },
  'stage-early': { capacity: 700 },
  'port-show': { capacity: 700 },
  'farewell-show': { capacity: 900 },
  'dome-show': { capacity: 300 },
  'late-show': { capacity: 300 },
  cooking: { capacity: 40 },
  'art-talk': { capacity: 80 },
  'spa-tour': { capacity: 20 },
  wine: { capacity: 24 },
  'port-quiet': { capacity: 12 },
}

export let MAX_SEATS = 8

/** The assistance requests that matter at a show or class (PRE-10). Requests belong to the booking, not to one ticket. */
export const SEAT_ACCOMMODATIONS: readonly string[] = ['wheelchair', 'assistiveListening', 'largePrint']

export interface AccommodationRequest { kind: string; guest: string; status: string }

/** The accommodation request status for each guest on a ticket: what they asked for and where it stands. Guests with no such request are left out. */
export function accommodationStatus<G extends { id: string }>(guests: readonly G[], requests: readonly AccommodationRequest[]): { guest: G; kind: string; status: string }[] {
  return guests.flatMap((guest) => requests.filter((r) => r.guest === guest.id && SEAT_ACCOMMODATIONS.includes(r.kind)).map((r) => ({ guest, kind: r.kind, status: r.status })))
}

export const isTicketed = (eventId: string): boolean => eventId in TICKETED

const hash = (text: string): number => {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

/** Events that are always full, so the sold-out state can be seen (authored). */
const FULL: ReadonlySet<string> = new Set(['wine|6', 'cooking|7', 'dome-show|3'])

/** Seats other guests hold: between 55% and 100% of the room. */
export function takenByOthers(eventId: string, day: number): number {
  const cap = TICKETED[eventId]?.capacity ?? 0
  if (FULL.has(`${eventId}|${day}`)) return cap
  const share = 55 + (hash(`${eventId}|${day}`) % 46)
  return Math.min(cap, Math.floor((cap * share) / 100))
}

export const seatsLeft = (eventId: string, day: number, heldByUs: number): number => Math.max(0, (TICKETED[eventId]?.capacity ?? 0) - takenByOthers(eventId, day) - heldByUs)

export type TicketProblem = 'notTicketed' | 'cancelled' | 'started' | 'age' | 'soldOut' | 'duplicate' | 'party'

export interface TicketCheck {
  event: Pick<DatedEvent, 'id' | 'status' | 'startAt' | 'age'>
  now: number
  guests: readonly { id: string; age: number }[]
  /** People who already hold a seat for this event on this day. */
  holders: readonly string[]
  /** Seats held by this booking on this event. */
  held: number
}

/** The first reason a seat cannot be reserved, or null. */
export function ticketProblem(c: TicketCheck): TicketProblem | null {
  if (!isTicketed(c.event.id)) return 'notTicketed'
  if (c.event.status === 'cancelled') return 'cancelled'
  if (c.now >= c.event.startAt) return 'started'
  if (c.guests.length === 0 || c.guests.length > MAX_SEATS) return 'party'
  if (c.event.age === 'adults' && c.guests.some((g) => g.age < 18)) return 'age'
  if (c.guests.some((g) => c.holders.includes(g.id))) return 'duplicate'
  return null
}

/** A seat can be given back up to the start. */
export const canReturn = (e: Pick<DatedEvent, 'startAt'>, now: number): boolean => now < e.startAt

// Served limits (`GET /reference/limits`) replace these defaults in place.
limit('MAX_SEATS', (v) => { MAX_SEATS = v }, MAX_SEATS)
