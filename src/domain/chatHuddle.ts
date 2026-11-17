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
