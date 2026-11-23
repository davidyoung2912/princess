/** Chat bundles (docs/chat-bundles-plan.md, phase B1): something from the app sent into a chat as a card that reads on its own. Framework-free. */
import type { ChatBundle } from '../api/chatTypes'
import type { StringKey } from '../i18n'
import { openablePath } from './chatCards'
import { GAME_DATA_CHARS, GAME_DATA_MAX, SHAREABLE_GAMES, resultSeconds, type ShareMode } from './games/share'

/** The newest payload shape this app understands. A larger number is shown as its title and subtitle only. */
export const BUNDLE_VERSION = 1

export const BUNDLE_NOTE_MAX = 80

export interface BundleType {
  /** The word above the card ("Place", "Menu"). */
  label: StringKey
  /** The screen reader's name for the chat icon on this kind of thing. */
  family: 'venue' | 'menu' | 'event' | 'excursion' | 'dinner' | 'port' | 'place' | 'dish' | 'game'
  /** Phase B2: it has a day and a time, so it can be asked about (Going, Maybe, No) as well as just sent. */
  plannable?: boolean
  /** How a code for it is made: `direct` for public catalogue data (the address holds the ref, no signal needed), `handoff` for anything personal (a short code the server keeps for a short time). */
  qr: 'direct' | 'handoff'
}

/** Phase B11: which of the app's own icons a bundle card wears, so a card in chat looks like the same thing in the explorer. */
export type BundleIcon = 'dining' | 'entertainment' | 'shopping' | 'spa' | 'exercise' | 'activities' | 'excursions' | 'games' | 'port' | 'place' | 'menu'

/** The screen a bundle opens decides its icon (a show opens the entertainment explorer, a spa slot the spa explorer); a type with no explorer screen keeps its own. */
const ICON_BY_PATH: readonly (readonly [string, BundleIcon])[] = [
  ['/entertainment', 'entertainment'], ['/dining-today', 'dining'], ['/shopping-today', 'shopping'], ['/excursions-explorer', 'excursions'],
  ['/spa-explorer', 'spa'], ['/exercise-explorer', 'exercise'], ['/activities-explorer', 'activities'], ['/games-explorer', 'games'],
]
const ICON_BY_FAMILY: Readonly<Record<BundleType['family'], BundleIcon>> = {
  venue: 'dining', menu: 'menu', event: 'activities', excursion: 'excursions', dinner: 'dining', port: 'port', place: 'place', dish: 'dining', game: 'games',
}

/** The icon for a bundle, or null for a type this app does not know. */
export function bundleIcon(b: Pick<ChatBundle, 'type' | 'path'>): BundleIcon | null {
  const row = BUNDLE_TYPES[b.type]
  if (!row) return null
  const path = (b.path ?? '').split('?')[0]
  return ICON_BY_PATH.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? ICON_BY_FAMILY[row.family]
}

/** The registry: every type this app can draw and open. A later phase adds a row here and the card, the dialog and the link rules follow. */
export const BUNDLE_TYPES: Readonly<Record<string, BundleType>> = {
  venue: { label: 'bundle.type.venue', family: 'venue', qr: 'direct' },
  menu: { label: 'bundle.type.menu', family: 'menu', qr: 'direct' },
  // `event` is also the type of a ref for anything with a day and time; the bundle itself carries `excursion` for a tour and `dinner` for a dinner.
  event: { label: 'bundle.type.event', family: 'event', qr: 'direct', plannable: true },
  excursion: { label: 'bundle.type.excursion', family: 'excursion', qr: 'direct', plannable: true },
  dinner: { label: 'bundle.type.dinner', family: 'dinner', qr: 'direct', plannable: true },
  // Phase B7: nothing here has a day and a time of its own, so none is plannable; a place is one to find, not the live "Meet me here" card.
  port: { label: 'bundle.type.port', family: 'port', qr: 'direct' },
  place: { label: 'bundle.type.place', family: 'place', qr: 'direct' },
  dish: { label: 'bundle.type.dish', family: 'dish', qr: 'direct' },
  // Phase B8: a game is the one snapshot bundle (its puzzle text rides in `data`); a code for it is a handoff code that waits for a later phase, so nothing offers one yet.
  ...Object.fromEntries(SHAREABLE_GAMES.map((id) => [`game.${id}`, { label: 'bundle.type.game', family: 'game', qr: 'handoff' } satisfies BundleType])),
}

/** The types a ref can start with. A booked excursion or dinner (`excursion:<id>`, `dining:<id>`) is an older card and is not one, though a bundle may carry the type `excursion` (made from an `event:` ref). */
export const REF_TYPES: readonly string[] = ['venue', 'menu', 'event', 'port', 'place', 'dish']

/** The ref of a thing with a day and a time (`event:<eventId>:<day>`): the same `eventId:day` a plan uses, so it can also be sent as a plan. */
export const eventRef = (planRef: string): string => `event:${planRef}`

/** The plan ref (`eventId:day`) inside an `event:` ref, or null for any other ref. */
export const planRefOf = (shareRef: string): string | null => (shareRef.startsWith('event:') && shareRef.length > 6 ? shareRef.slice(6) : null)

/** The event id of an excursion in a plan ref. */
export const tourEventId = (excursionId: string): string => `tour~${excursionId}`

/** Whether a bundle has a day and a time and can be asked about (a type in the registry that is plannable, with a day). */
export const isPlannable = (b: Pick<ChatBundle, 'type' | 'day'>): boolean => BUNDLE_TYPES[b.type]?.plannable === true && b.day !== undefined

const MAX_TEXT = 200

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.slice(0, MAX_TEXT) : undefined)
const whole = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1000 ? v : undefined)

/** A bundle from anything the server sent, or null when it is not one (no type or no title). Total: it never throws, and it keeps only the plain fields. */
export function parseBundle(raw: unknown): ChatBundle | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const type = text(r.type)
  const title = text(r.title)
  if (!type || !title) return null
  const out: ChatBundle = { type, v: whole(r.v) ?? 1, title }
  for (const key of ['subtitle', 'path', 'time', 'place', 'ref', 'note', 'from'] as const) {
    const value = text(r[key])
    if (value !== undefined) out[key] = value
  }
  const day = whole(r.day)
  if (day !== undefined) out.day = day
  if (typeof r.data === 'string' && r.data.length <= GAME_DATA_MAX && GAME_DATA_CHARS.test(r.data)) out.data = r.data
  return out
}

/** Whether this app can open the bundle: a type in the registry and a payload no newer than it knows. Anything else shows the title and subtitle and "Update the app to open this". */
export const isKnownBundle = (b: Pick<ChatBundle, 'type' | 'v'>): boolean => b.type in BUNDLE_TYPES && b.v <= BUNDLE_VERSION

/** The game, the way it was sent and the puzzle text in a game bundle, or null for any other bundle (or a game bundle with no puzzle text). Whether the text is a puzzle is for `decodeGame` to say. */
export function gameOfBundle(b: Pick<ChatBundle, 'type' | 'ref' | 'data'>): { game: string; mode: ShareMode | 'result'; data: string; seconds?: number } | null {
  if (!b.type.startsWith('game.') || !b.data) return null
  const game = b.type.slice(5)
  const parts = (b.ref ?? '').split(':')
  const mode = parts[2]
  if (parts.length !== 3 || parts[0] !== 'game' || parts[1] !== game) return null
  if (mode === 'start' || mode === 'current') return { game, mode, data: b.data }
  // Phase B10: a result is the starting position and a time; it opens as "Beat it" on the same puzzle.
  const seconds = mode === 'result' ? resultSeconds(b.data) : null
  return seconds ? { game, mode: 'result', data: b.data, seconds } : null
}

/** Where Open goes, or null: an unknown bundle, or a path that is not one of the screens a shared item may open (the path never decides by itself, the allow-list does). */
export function bundleLink(b: Pick<ChatBundle, 'type' | 'v' | 'path'>): string | null {
  return isKnownBundle(b) ? openablePath(b.path) : null
}

/** The line a screen reader and a list preview use for a bundle: the title, its subtitle, and when and where. */
export function bundleSummary(b: ChatBundle, clock: (time: string) => string): string {
  const when = [b.day !== undefined ? `day ${b.day}` : '', b.time ? clock(b.time) : ''].filter(Boolean).join(', ')
  return [b.title, b.subtitle, when, b.place && b.place !== b.title ? b.place : ''].filter(Boolean).join(' · ')
}

/** The bundle a shared thing becomes: venue and menu refs are sent as bundles, every older ref (an excursion, a dinner, a plan) keeps its own kind so the old cards are untouched. */
export function shareInput(shareRef: string, kind: 'card' | 'plan', note?: string): { kind: 'bundle' | 'card' | 'plan'; shareRef: string; note?: string } {
  const type = shareRef.split(':')[0] ?? ''
  if (kind === 'card' && REF_TYPES.includes(type)) return { kind: 'bundle', shareRef, ...(note ? { note } : {}) }
  return kind === 'plan' ? { kind, shareRef, ...(note ? { note } : {}) } : { kind, shareRef }
}

/** Phase B11: passing a bundle on. Only its `ref` (and a game's puzzle text) goes; the server builds the words again for the new chat, so nothing stale or private travels. Null when it has no ref or is not a type this app knows. */
export function forwardInput(b: Pick<ChatBundle, 'type' | 'v' | 'ref' | 'data'>, note?: string, from?: { conversationId: string; messageId: string }): { kind: 'bundle'; shareRef: string; note?: string; data?: string; forwardChat?: string; forwardMessage?: string } | null {
  if (!b.ref || !isKnownBundle(b)) return null
  return { kind: 'bundle', shareRef: b.ref, ...(b.data ? { data: b.data } : {}), ...(note ? { note } : {}), ...(from ? { forwardChat: from.conversationId, forwardMessage: from.messageId } : {}) }
}

/** The longest message the server accepts. */
const MAX_MESSAGE = 2000

/**
 * Phase B11: a Stanley answer passed on as plain words, under a label so it is plain who said it (and it can never start with "@Stanley", which would ask him again).
 * Null when there is nothing to send or it is too long for a message.
 */
export function stanleyAnswerInput(answer: string, label: string, note?: string): { kind: 'text'; text: string } | null {
  const body = answer.trim()
  const extra = note?.trim()
  const text = `${label} ${body}${extra ? `\n\n${extra}` : ''}`
  return body === '' || text.length > MAX_MESSAGE ? null : { kind: 'text', text }
}

/** Conversations that match what was typed, case and accents aside; everything when nothing was typed. */
export function matchConversations<T extends { name: string }>(rows: readonly T[], query: string): T[] {
  const plain = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const q = plain(query.trim())
  return q === '' ? [...rows] : rows.filter((r) => plain(r.name).includes(q))
}

/** The search box appears once there are more conversations than this. */
export const SEARCH_FROM = 8

export type SendOutcome = { id: string; name: string; ok: true } | { id: string; name: string; ok: false; error: unknown }

/** Sends to each chosen conversation in turn, one message each with its own client id (so a retry never doubles), and reports each one: a failure in one chat does not stop the others. */
export async function sendToMany<T extends { id: string; name: string }>(targets: readonly T[], send: (target: T) => Promise<unknown>): Promise<SendOutcome[]> {
  const out: SendOutcome[] = []
  for (const target of targets) {
    try { await send(target); out.push({ id: target.id, name: target.name, ok: true }) } catch (error) { out.push({ id: target.id, name: target.name, ok: false, error }) }
  }
  return out
}
