/** The trip huddle (docs/chat-features-research.md, phase 15): a private chat around a shortlist, before anyone has booked. Framework-free; the server decides, this only builds the link, checks what to offer and words what it said. */
import type { HuddleCardKind } from '../api/chatTypes'

export const HUDDLE_CARD_KINDS: readonly HuddleCardKind[] = ['sailing', 'cabinType', 'port', 'costBreakdown']
export const HUDDLE_MAX_FIELDS = 12
export const HUDDLE_MAX_VALUE = 140
export const HUDDLE_MAX_TITLE = 120

/** The invite link. The token sits after the `#`, so it is never sent to a server or kept in an access log; it is shown once and a refresh replaces it. */
export const huddleLink = (origin: string, token: string): string => `${origin}/chat#huddle=${token}`

/** The token in an address's hash, or null. A malformed or oversized one is not a token. */
export function tokenFromHash(hash: string): string | null {
  const m = /^#huddle=([A-Za-z0-9_-]{20,100})$/.exec(hash)
  return m ? m[1] : null
}

/** Label and value rows from the form into the fields the server takes: trimmed, empty rows dropped, repeated labels keep the last, at most 12. */
export function cardFields(rows: readonly { label: string; value: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    const label = r.label.trim()
    const value = r.value.trim().slice(0, HUDDLE_MAX_VALUE)
    if (label !== '' && value !== '' && (label in out || Object.keys(out).length < HUDDLE_MAX_FIELDS)) out[label] = value
  }
  return out
}

/** A card can be added once it has a kind and a title. */
export const cardReady = (kind: string, title: string): boolean => (HUDDLE_CARD_KINDS as readonly string[]).includes(kind) && title.trim() !== '' && title.trim().length <= HUDDLE_MAX_TITLE

/** Whether the guest may press Join: they have said they are 18 or over, and there is a seat. */
export const mayJoin = (adult: boolean, seatsLeft: number): boolean => adult && seatsLeft > 0

export type HuddleProblem = 'supervised' | 'underage' | 'needAge' | 'openAlready' | 'tooMany' | 'invalidLink' | 'alreadyIn' | 'full' | 'creator' | 'limit' | 'card' | 'noBooking' | 'name' | 'blocked' | 'offline' | 'other'

const CODES: readonly string[] = ['supervised', 'underage', 'needAge', 'openAlready', 'tooMany', 'invalidLink', 'alreadyIn', 'full', 'creator', 'limit', 'card', 'noBooking', 'name', 'blocked']

export function huddleProblem(code: string, message: string | undefined): HuddleProblem {
  if (code === 'offline' || code === 'network' || code === 'timeout') return 'offline'
  return message !== undefined && CODES.includes(message) ? (message as HuddleProblem) : 'other'
}

/** Whole days from now to a time, never below zero. */
export const daysUntil = (at: number, now: number): number => Math.max(0, Math.ceil((at - now) / 86_400_000))

/** The people who are not on the booking stay; this is a count only, nobody is named. */
export const convertSummary = (moved: number, stayed: number): { moved: number; stayed: number } => ({ moved, stayed })

/** What a screen offers to add to a huddle: only public catalogue facts, never a personal money figure or a booking, cabin or document number. */
export interface HuddleOffer { kind: HuddleCardKind; title: string; fields: Record<string, string> }

const clip = (s: string, n: number): string => s.trim().slice(0, n)

/** A sailing: its dates, length and ports. */
export function sailingOffer(title: string, range: string, nights: number, ports: readonly string[]): HuddleOffer {
  return { kind: 'sailing', title: clip(title, HUDDLE_MAX_TITLE), fields: cardFields([{ label: 'Dates', value: range }, { label: 'Nights', value: String(nights) }, { label: 'Ports', value: ports.join(', ') }]) }
}

/** A port: its name and, when the sailing calls there, the date. */
export function portOffer(name: string, calls?: string): HuddleOffer {
  return { kind: 'port', title: clip(name, HUDDLE_MAX_TITLE), fields: cardFields([{ label: 'Calls', value: calls ?? '' }]) }
}

/** The cruise fare of each fare type for one room and party size (the catalogue price, with none of the guest's own flights, hotel, budget or extras). */
export function costOffer(sailingTitle: string, room: string, guests: number, fares: readonly { name: string; cruise: string }[]): HuddleOffer {
  return { kind: 'costBreakdown', title: clip(sailingTitle, HUDDLE_MAX_TITLE), fields: cardFields([{ label: 'Room type', value: room }, { label: 'Guests', value: String(guests) }, ...fares.map((f) => ({ label: `Cruise fare, ${f.name}`, value: f.cruise }))]) }
}

/** The open huddles a guest can add to: kind `huddle`, not closed. */
export const openHuddles = <T extends { kind: string; closed?: boolean }>(list: readonly T[]): T[] => list.filter((c) => c.kind === 'huddle' && !c.closed)

/** A room type on a sailing's ship: the room, the sailing, the party size and the fare type. No price, no cabin number. */
export function cabinOffer(room: string, sailingTitle: string, guests: number, fare: string): HuddleOffer {
  return { kind: 'cabinType', title: clip(room, HUDDLE_MAX_TITLE), fields: cardFields([{ label: 'Sailing', value: sailingTitle }, { label: 'Guests', value: String(guests) }, { label: 'Fare type', value: fare }]) }
}
