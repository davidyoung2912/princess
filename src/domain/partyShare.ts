/**
 * Between people (next-level plan N4): what a party shares, the organiser's view the server builds from it, the log of changes to the shared plan, and the read-only
 * caregiver and advisor links. Framework-free. The server decides what each person may see; these functions only read what it sends and drop anything malformed.
 */
export const SHARING_FACETS = ['plans', 'status', 'spending', 'photos'] as const
export type SharingFacet = (typeof SHARING_FACETS)[number]
/** What a person shares with the rest of the party. Everything is off until they turn it on, and the medical card is never shared (it has no switch). */
export type Sharing = Record<SharingFacet, boolean>
export const NOTHING_SHARED: Sharing = { plans: false, status: false, spending: false, photos: false }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '')

export const normalizeSharing = (raw: unknown): Sharing => {
  const r = isObj(raw) ? raw : {}
  return { plans: r.plans === true, status: r.status === true, spending: r.spending === true, photos: r.photos === true }
}

export interface OrganiserGuest {
  id: string; name: string; child: boolean; isYou: boolean; sharesStatus: boolean
  /** Null when the person has not shared their status with the party. */
  checkin: { done: number; total: number } | null
  documents: number | null
}
export interface OrganiserMoney { paidCents: number; totalCents: number; paidInFull: boolean; finalDue: number }
export interface Organiser { number: string; ship: string; departure: number; daysToGo: number; youAreBooker: boolean; guests: OrganiserGuest[]; money: OrganiserMoney | null }

export function normalizeOrganiser(raw: unknown): Organiser | null {
  if (!isObj(raw) || typeof raw.number !== 'string') return null
  const guests = (Array.isArray(raw.guests) ? raw.guests : []).flatMap((g): OrganiserGuest[] => {
    if (!isObj(g) || typeof g.id !== 'string' || typeof g.name !== 'string') return []
    const c = isObj(g.checkin) ? { done: num(g.checkin.done), total: num(g.checkin.total) } : null
    return [{ id: g.id, name: str(g.name, 80), child: g.child === true, isYou: g.isYou === true, sharesStatus: g.sharesStatus === true, checkin: c, documents: typeof g.documents === 'number' ? g.documents : null }]
  })
  const m = isObj(raw.money) ? { paidCents: num(raw.money.paidCents), totalCents: num(raw.money.totalCents), paidInFull: raw.money.paidInFull === true, finalDue: num(raw.money.finalDueMs) } : null
  return { number: raw.number, ship: str(raw.ship, 60), departure: num(raw.departureMs), daysToGo: num(raw.daysToGo), youAreBooker: raw.youAreBooker === true, guests, money: m }
}

/** How a person's status reads in the roster: what they shared, or that they have not. */
export type GuestStatus = { kind: 'hidden' } | { kind: 'done' } | { kind: 'steps'; done: number; total: number }
export function guestStatus(g: OrganiserGuest): GuestStatus {
  if (!g.checkin) return { kind: 'hidden' }
  return g.checkin.total > 0 && g.checkin.done >= g.checkin.total ? { kind: 'done' } : { kind: 'steps', done: g.checkin.done, total: g.checkin.total }
}

export interface PartyLogEntry { kind: string; label: string; at: number; deleted: boolean }
export const normalizeLog = (raw: unknown): PartyLogEntry[] =>
  (Array.isArray(raw) ? raw : []).flatMap((e): PartyLogEntry[] => (isObj(e) && typeof e.kind === 'string' && typeof e.at === 'number' ? [{ kind: e.kind, label: str(e.label, 60), at: e.at, deleted: e.deleted === true }] : [])).slice(0, 30)

export type ShareKind = 'caregiver' | 'advisor'
export interface ShareLink { id: string; kind: ShareKind; label: string; createdAt: number; expiresAt: number; lastCheckInAt: number | null; note: string; /** The page address; only the server's answer to "make" has it. */ path: string | null }
export const SHARE_LINKS_MAX = 6

export function normalizeShareLink(raw: unknown): ShareLink | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || (raw.kind !== 'caregiver' && raw.kind !== 'advisor')) return null
  return { id: raw.id, kind: raw.kind, label: str(raw.label, 40), createdAt: num(raw.createdAt), expiresAt: num(raw.expiresAt), lastCheckInAt: typeof raw.lastCheckInAt === 'number' ? raw.lastCheckInAt : null, note: str(raw.note, 200), path: typeof raw.path === 'string' ? raw.path : null }
}
export const normalizeShareLinks = (raw: unknown): ShareLink[] =>
  (Array.isArray(raw) ? raw : []).flatMap((l) => { const x = normalizeShareLink(l); return x ? [x] : [] }).slice(0, SHARE_LINKS_MAX)

/** What someone holding a link sees. Never a position. */
export interface SharedView {
  kind: ShareKind; label: string; guestFirstName: string; ship: string; departure: number; nights: number; daysToGo: number
  lastCheckInAt: number | null; note: string
  /** Caregiver only: whether the guest has finished check-in. */
  checkinDone: boolean | null
  /** Advisor only. */
  paidInFull: boolean | null; progress: { done: number; total: number } | null; guests: number | null
}
export function normalizeSharedView(raw: unknown): SharedView | null {
  if (!isObj(raw) || (raw.kind !== 'caregiver' && raw.kind !== 'advisor')) return null
  return {
    kind: raw.kind, label: str(raw.label, 40), guestFirstName: str(raw.guestFirstName, 40), ship: str(raw.ship, 60), departure: num(raw.departureMs), nights: num(raw.nights), daysToGo: num(raw.daysToGo),
    lastCheckInAt: typeof raw.lastCheckInAt === 'number' ? raw.lastCheckInAt : null, note: str(raw.note, 200),
    checkinDone: typeof raw.checkinDone === 'boolean' ? raw.checkinDone : null, paidInFull: typeof raw.paidInFull === 'boolean' ? raw.paidInFull : null,
    progress: isObj(raw.progress) ? { done: num(raw.progress.done), total: num(raw.progress.total) } : null, guests: typeof raw.guests === 'number' ? raw.guests : null,
  }
}

/** A link past its end, or ending within a week, so the list can say so. */
export const linkState = (l: Pick<ShareLink, 'expiresAt'>, now: number): 'ended' | 'soon' | 'live' => (l.expiresAt <= now ? 'ended' : l.expiresAt - now < 7 * 86_400_000 ? 'soon' : 'live')

/** The plain-words kind of change a log line is about. */
export const LOG_KINDS = ['poll', 'idea', 'meet', 'item', 'party'] as const
