/** Typed chat messages (docs/chat-features-research.md, section 11, phase 3): cards shared from the app, place cards, the pin bar and mentions. Framework-free. */
import type { ChatCard, ChatCardType, ChatMessage, ChatPlace, ChatShareable } from '../api/chatTypes'
import { safeNoticePath } from './stanleyThread'

export const MAX_PINS = 3
export const NOTE_MAX = 80

/** A card is current until its time passes. The server marks a place `expired` when it reads the thread; a copy held on the device also stops being current by its own `expiresAt`, so offline it does not claim a stale meeting point is live. */
export const isExpired = (card: Pick<ChatCard, 'expired' | 'expiresAt'>, now: number): boolean => card.expired === true || (card.expiresAt !== undefined && card.expiresAt <= now)

/** The screens a card may open. Anything else (a path the app does not have, or one built by something other than the server) is "no longer available". */
const CARD_PATH = /^\/(plan\/(excursions|dining|reservations|ahead)|home\/ports\/[\w-]+)$/

/** Where a card goes, or null when it points nowhere the app knows: the card then says it is no longer available instead of linking. */
export function cardLink(card: Pick<ChatCard, 'type' | 'path' | 'gone'>): string | null {
  if (card.type === 'place' || card.gone) return null
  const path = safeNoticePath(card.path)
  return path && CARD_PATH.test(path) ? path : null
}

/** A card or place needs its own drawing; a plain message does not. */
export const isTyped = (m: Pick<ChatMessage, 'kind' | 'card'>): boolean => (m.kind === 'card' || m.kind === 'place') && m.card !== undefined

/** Only plain text can be reworded; a card is deleted and sent again. Mirrors the server. */
export const canEditKind = (m: Pick<ChatMessage, 'kind'>): boolean => m.kind === undefined

/** The line a screen reader and a list preview use for a card: the title, and when and where when the card says. */
export function cardSummary(card: ChatCard, clock: (time: string) => string): string {
  const when = [card.day !== undefined ? `day ${card.day}` : '', card.time ? clock(card.time) : ''].filter(Boolean).join(', ')
  return [card.title, when, card.place && card.place !== card.title ? card.place : ''].filter(Boolean).join(' · ')
}

const TYPE_ORDER: Record<Exclude<ChatCardType, 'place' | 'plan'>, number> = { booking: 0, portDay: 1, excursion: 2, dining: 3 }

/** The share list in a steady order: the booking, then port days, excursions and dinners, each by day and time. */
export function sortShareables(items: readonly ChatShareable[]): ChatShareable[] {
  return [...items].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || (a.day ?? 0) - (b.day ?? 0) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title))
}

/** Places by deck then name, so "Deck 5" places sit together. */
export const sortPlaces = (places: readonly ChatPlace[]): ChatPlace[] => [...places].sort((a, b) => a.deck - b.deck || a.name.localeCompare(b.name))

/** A place note as typed: one line, cut at the limit. */
export const cleanNote = (v: string): string => v.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX)

// ---- Pins ----

/** Whether another pin fits. */
export const canAddPin = (pinned: number): boolean => pinned < MAX_PINS

/** Whether the Pin or Unpin button is offered on a message: the server allows pinning here (`canPin`), it is a person's message and not deleted, and, to pin, there is room. */
export function pinOffer(m: Pick<ChatMessage, 'system' | 'stanley' | 'deleted' | 'pinned'>, canPin: boolean, pinned: number): 'pin' | 'unpin' | null {
  if (!canPin || m.system || m.stanley || m.deleted) return null
  if (m.pinned) return 'unpin'
  return canAddPin(pinned) ? 'pin' : null
}

// ---- Mentions ----

export interface MentionPerson { id: string; name: string }

const TOKEN = /(^|\s)@([\p{L}\p{N}'-]*)$/u

/** The `@word` being typed at the caret, or null: where it starts (at the `@`) and what has been typed after it. */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const m = TOKEN.exec(before)
  return m ? { start: before.length - m[2].length - 1, query: m[2] } : null
}

/** People whose first name starts with what was typed (case and accents aside), in the order given, at most `limit`. An empty query lists everyone. */
export function matchPeople(people: readonly MentionPerson[], query: string, limit = 6): MentionPerson[] {
  const q = query.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return people.filter((p) => p.name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().startsWith(q)).slice(0, limit)
}

/** The text with the `@word` at `start` (up to the caret) replaced by `@Name `, and where the caret goes. */
export function insertMention(text: string, caret: number, start: number, person: MentionPerson): { text: string; caret: number } {
  const token = `@${person.name} `
  return { text: text.slice(0, start) + token + text.slice(caret), caret: start + token.length }
}

/** The members a message names: each person whose `@Name` is in the text. A name that is not followed by a letter, so "@Sam R." does not also name "@Sam". */
export function mentionedIds(text: string, people: readonly MentionPerson[]): string[] {
  const ids: string[] = []
  for (const p of people) {
    const at = `@${p.name}`
    let from = text.indexOf(at)
    while (from !== -1) {
      const next = text[from + at.length]
      if (!next || !/[\p{L}\p{N}]/u.test(next)) { if (!ids.includes(p.id)) ids.push(p.id); break }
      from = text.indexOf(at, from + 1)
    }
  }
  return ids
}

export interface TextPart { text: string; mention: boolean }

/** The text cut into plain parts and `@Name` parts, so a name can be drawn in strong type and a screen reader still reads it as words. */
export function mentionParts(text: string): TextPart[] {
  const parts: TextPart[] = []
  const re = /@[\p{L}][\p{L}'-]*(?: \p{L}\.)?/gu
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), mention: false })
    parts.push({ text: m[0], mention: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false })
  return parts
}
