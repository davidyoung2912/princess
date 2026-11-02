import type { StringKey } from '../i18n'
import { isEmail } from './signup'
import { limit } from './limits'

/**
 * The family-at-home page (S3-08, S6-24, XD-07): a read-only page for named people, reached by a signed link that expires and can be revoked.
 * It shows ship-level facts only: never where the guest is. The link here is a simulation kept on the device: the signature is a
 * keyed hash, not real cryptography, and a real build checks a server-side signed token instead.
 */
export const MAX_CONTACTS = 5
export const LINK_DAY_CHOICES = [3, 7, 14] as const
export const DEFAULT_LINK_DAYS = 7
export let MAX_POSTCARDS = 30
export let MAX_POSTCARD_NOTE = 140
const DAY = 86_400_000

export interface FamilyContact { id: string; name: string; email: string }
export interface FamilyLink { id: string; contactId: string; issuedAt: number; expiresAt: number; revoked: boolean }

/** The ready-made messages a guest can send with one tap. */
export const POSTCARD_KINDS = ['ok', 'sea', 'port', 'late', 'love'] as const
export type PostcardKind = (typeof POSTCARD_KINDS)[number]
export const POSTCARD_TEXT: Record<PostcardKind, StringKey> = { ok: 'home.card.ok', sea: 'home.card.sea', port: 'home.card.port', late: 'home.card.late', love: 'home.card.love' }

/** A postcard waits in the queue until the guest has signal, then counts as sent. */
export interface Postcard { id: string; kind: PostcardKind; note: string; at: number; sent: boolean; sentAt: number | null }

export interface HomeState { secret: string; contacts: FamilyContact[]; links: FamilyLink[]; postcards: Postcard[] }
export const EMPTY_HOME: HomeState = { secret: '', contacts: [], links: [], postcards: [] }

export type ContactProblem = 'name' | 'email' | 'duplicate' | 'tooMany'
export type Change<P> = { state: HomeState; problem: null } | { state: HomeState; problem: P }

export function addContact(state: HomeState, name: string, email: string, id: string): Change<ContactProblem> {
  const n = name.trim().slice(0, 60)
  const e = email.trim().toLowerCase()
  if (!n) return { state, problem: 'name' }
  if (!isEmail(e)) return { state, problem: 'email' }
  if (state.contacts.some((c) => c.email === e)) return { state, problem: 'duplicate' }
  if (state.contacts.length >= MAX_CONTACTS) return { state, problem: 'tooMany' }
  return { state: { ...state, contacts: [...state.contacts, { id, name: n, email: e }] }, problem: null }
}

/** Removing a person also cancels their links, so a removed contact can never open the page. */
export const removeContact = (state: HomeState, id: string): HomeState => ({
  ...state, contacts: state.contacts.filter((c) => c.id !== id), links: state.links.map((l) => (l.contactId === id ? { ...l, revoked: true } : l)),
})

/* ---- Signed, expiring links ---- */

/** A keyed 53-bit hash (cyrb53). Good enough to show tampering in a simulation; not a security control. */
function keyedHash(text: string, secret: string): string {
  const s = `${secret}|${text}|${secret}`
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const SAFE = /^[A-Za-z0-9_-]+$/

/** The text a link is built from: owner, link id and expiry. */
const payload = (owner: string, link: FamilyLink) => `${owner}.${link.id}.${link.expiresAt.toString(36)}`

export const linkToken = (state: HomeState, owner: string, link: FamilyLink): string => `${payload(owner, link)}.${keyedHash(payload(owner, link), state.secret)}`

/** The owner named in a link, to find whose page it is. Not trusted until `verifyLink` passes. */
export function tokenOwner(token: string): string | null {
  const parts = token.split('.')
  return parts.length === 4 && SAFE.test(parts[0]) ? parts[0] : null
}

export function issueLink(state: HomeState, contactId: string, now: number, id: string, secret: string, days: number = DEFAULT_LINK_DAYS): { state: HomeState; link: FamilyLink | null } {
  if (!state.contacts.some((c) => c.id === contactId) || !SAFE.test(id)) return { state, link: null }
  const chosen = LINK_DAY_CHOICES.includes(days as (typeof LINK_DAY_CHOICES)[number]) ? days : DEFAULT_LINK_DAYS
  const link: FamilyLink = { id, contactId, issuedAt: now, expiresAt: now + chosen * DAY, revoked: false }
  // One live link per person: a new one replaces the old one.
  const links = state.links.map((l) => (l.contactId === contactId && !l.revoked ? { ...l, revoked: true } : l))
  return { state: { ...state, secret: state.secret || secret, links: [...links, link] }, link }
}

export const revokeLink = (state: HomeState, id: string): HomeState => ({ ...state, links: state.links.map((l) => (l.id === id ? { ...l, revoked: true } : l)) })
export const revokeAll = (state: HomeState): HomeState => ({ ...state, links: state.links.map((l) => ({ ...l, revoked: true })) })

export type LinkProblem = 'malformed' | 'signature' | 'unknown' | 'revoked' | 'expired'
export type LinkCheck = { ok: true; link: FamilyLink; contact: FamilyContact } | { ok: false; reason: LinkProblem }

/** Checks a link: well formed, signed by this device's secret, known, not revoked and not expired. */
export function verifyLink(token: string, owner: string, state: HomeState, now: number): LinkCheck {
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== owner || !parts.every((p) => SAFE.test(p))) return { ok: false, reason: 'malformed' }
  const [, id, exp, sig] = parts
  const expiresAt = parseInt(exp, 36)
  if (!state.secret || !Number.isFinite(expiresAt) || keyedHash(`${owner}.${id}.${exp}`, state.secret) !== sig) return { ok: false, reason: 'signature' }
  const link = state.links.find((l) => l.id === id)
  if (!link || link.expiresAt !== expiresAt) return { ok: false, reason: 'unknown' }
  if (link.revoked) return { ok: false, reason: 'revoked' }
  if (now >= link.expiresAt) return { ok: false, reason: 'expired' }
  const contact = state.contacts.find((c) => c.id === link.contactId)
  return contact ? { ok: true, link, contact } : { ok: false, reason: 'revoked' }
}

/** Whole days left on a link, at least 1 while it is live. */
export const daysLeft = (link: FamilyLink, now: number): number => Math.max(0, Math.ceil((link.expiresAt - now) / DAY))
export const isLive = (link: FamilyLink, now: number): boolean => !link.revoked && now < link.expiresAt

/** The live link for a person, if any. */
export const liveLinkFor = (state: HomeState, contactId: string, now: number): FamilyLink | undefined => state.links.find((l) => l.contactId === contactId && isLive(l, now))

/* ---- Links the server signed (REST mode) ---- */

/** A link as the server answers `POST /me/family-links`: its id, the token to share (shown once) and when it ends. */
export interface ServerLink { id: string; token: string; expiresAt: number }

export function normalizeServerLink(raw: unknown): ServerLink | null {
  if (!isObj(raw) || !str(raw.id) || !SAFE.test(raw.id) || !str(raw.token) || !raw.token || typeof raw.expiresAt !== 'number') return null
  return { id: raw.id, token: raw.token, expiresAt: raw.expiresAt }
}

/** Records a link the server made for a person (one live link per person, as with a link made here) without a secret: the server holds the signing key. */
export function adoptServerLink(state: HomeState, contactId: string, link: ServerLink, now: number): { state: HomeState; replaced: string[] } {
  if (!state.contacts.some((c) => c.id === contactId)) return { state, replaced: [] }
  const replaced = state.links.filter((l) => l.contactId === contactId && isLive(l, now)).map((l) => l.id)
  const links = state.links.map((l) => (replaced.includes(l.id) ? { ...l, revoked: true } : l))
  return { state: { ...state, links: [...links, { id: link.id, contactId, issuedAt: now, expiresAt: link.expiresAt, revoked: false }] }, replaced }
}

/** The links still live on a person, so removing them can stop each one on the server. */
export const liveLinkIds = (state: HomeState, now: number, contactId?: string): string[] =>
  state.links.filter((l) => isLive(l, now) && (contactId === undefined || l.contactId === contactId)).map((l) => l.id)

/** What `GET /public/family/{token}` answers: a page, or the reason a link does not work. */
export type PublicFamily =
  | { ok: true; guestFirst: string; expiresAt: number; postcards: { id: string; kind: PostcardKind; note: string; at: number }[]; scenarios: string[]; /** Minutes the guest is late, when they told their party and share it. */ delayedMinutes: number | null }
  | { ok: false; reason: LinkProblem }

export function normalizePublicFamily(raw: unknown): PublicFamily {
  if (!isObj(raw)) return { ok: false, reason: 'malformed' }
  if (raw.ok !== true) return { ok: false, reason: (['signature', 'unknown', 'revoked', 'expired'] as const).find((r) => r === raw.reason) ?? 'malformed' }
  const postcards = (Array.isArray(raw.postcards) ? raw.postcards : []).flatMap((x, i): { id: string; kind: PostcardKind; note: string; at: number }[] =>
    isObj(x) && POSTCARD_KINDS.includes(x.kind as PostcardKind) && typeof x.at === 'number' ? [{ id: `${i}`, kind: x.kind as PostcardKind, note: str(x.note) ? x.note.slice(0, MAX_POSTCARD_NOTE) : '', at: x.at }] : [])
  return {
    ok: true, guestFirst: str(raw.guestFirst) ? raw.guestFirst.slice(0, 60) : '', expiresAt: typeof raw.expiresAt === 'number' ? raw.expiresAt : 0, postcards: postcards.slice(-MAX_POSTCARDS),
    scenarios: (Array.isArray(raw.scenarios) ? raw.scenarios : []).filter(str).slice(0, 30),
    delayedMinutes: typeof raw.delayedMinutes === 'number' && raw.delayedMinutes > 0 ? Math.min(480, Math.round(raw.delayedMinutes)) : null,
  }
}

/* ---- Postcards ---- */

export function addPostcard(state: HomeState, kind: PostcardKind, note: string, at: number, id: string, online: boolean): HomeState {
  const card: Postcard = { id, kind, note: note.trim().slice(0, MAX_POSTCARD_NOTE), at, sent: online, sentAt: online ? at : null }
  return { ...state, postcards: [...state.postcards, card].slice(-MAX_POSTCARDS) }
}

/** Sends everything queued, once the guest has signal. */
export const flushPostcards = (state: HomeState, at: number): HomeState =>
  state.postcards.some((p) => !p.sent) ? { ...state, postcards: state.postcards.map((p) => (p.sent ? p : { ...p, sent: true, sentAt: at })) } : state

export const queuedPostcards = (state: HomeState): number => state.postcards.filter((p) => !p.sent).length

/* ---- What the page shows ---- */

export interface FamilyContext {
  guestFirst: string
  shipName: string
  itinerary: readonly { day: number; date: string; place: string }[]
  /** Where the ship is, by name, or null at sea. Ship-level only. */
  shipAt: string | null
  notices: readonly StringKey[]
  /** Set when the guest is delayed and shares it. */
  delayedMinutes: number | null
  now: number
}

export interface FamilyView {
  guestFirst: string
  shipName: string
  itinerary: readonly { day: number; date: string; place: string }[]
  shipAt: string | null
  notices: readonly StringKey[]
  postcards: readonly { id: string; kind: PostcardKind; note: string; at: number }[]
  delayedMinutes: number | null
  expiresAt: number
}

/** The only things a family member can see. Anything not listed here (cabin, location, bill, bookings) cannot reach the page. */
export function familyView(state: HomeState, link: FamilyLink, ctx: FamilyContext): FamilyView {
  return {
    guestFirst: ctx.guestFirst, shipName: ctx.shipName, itinerary: ctx.itinerary, shipAt: ctx.shipAt, notices: ctx.notices,
    postcards: state.postcards.filter((p) => p.sent).map((p) => ({ id: p.id, kind: p.kind, note: p.note, at: p.at })),
    delayedMinutes: ctx.delayedMinutes, expiresAt: link.expiresAt,
  }
}

/* ---- Reading saved state ---- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown): v is string => typeof v === 'string'

export function normalizeHome(raw: unknown): HomeState {
  if (!isObj(raw)) return EMPTY_HOME
  const contacts = (Array.isArray(raw.contacts) ? raw.contacts : []).flatMap((x): FamilyContact[] =>
    isObj(x) && str(x.id) && SAFE.test(x.id) && str(x.name) && x.name.trim() && str(x.email) && isEmail(x.email) ? [{ id: x.id, name: x.name.slice(0, 60), email: x.email.trim().toLowerCase() }] : []).slice(0, MAX_CONTACTS)
  const links = (Array.isArray(raw.links) ? raw.links : []).flatMap((x): FamilyLink[] =>
    isObj(x) && str(x.id) && SAFE.test(x.id) && str(x.contactId) && typeof x.issuedAt === 'number' && typeof x.expiresAt === 'number' ? [{ id: x.id, contactId: x.contactId, issuedAt: x.issuedAt, expiresAt: x.expiresAt, revoked: x.revoked === true }] : [])
  const postcards = (Array.isArray(raw.postcards) ? raw.postcards : []).flatMap((x): Postcard[] =>
    isObj(x) && str(x.id) && POSTCARD_KINDS.includes(x.kind as PostcardKind) && typeof x.at === 'number'
      ? [{ id: x.id, kind: x.kind as PostcardKind, note: str(x.note) ? x.note.slice(0, MAX_POSTCARD_NOTE) : '', at: x.at, sent: x.sent === true, sentAt: typeof x.sentAt === 'number' ? x.sentAt : null }] : []).slice(-MAX_POSTCARDS)
  return { secret: str(raw.secret) && SAFE.test(raw.secret) ? raw.secret : '', contacts, links, postcards }
}

// Served limits (`GET /reference/limits`) replace these defaults in place.
limit('MAX_POSTCARDS', (v) => { MAX_POSTCARDS = v }, MAX_POSTCARDS)
limit('MAX_POSTCARD_NOTE', (v) => { MAX_POSTCARD_NOTE = v }, MAX_POSTCARD_NOTE)
