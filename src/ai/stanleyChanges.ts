import type { ActionKind } from './stanleyAction'
import type { StanleyLevel } from '../settings/settings'

/**
 * Voyage Autopilot v2 and Explain this change (docs/stanley-gap-analysis-and-plan.md, phase 11), device side. The server notices what changed, works out what it means for this guest and ranks it; the
 * delivery rules (alerts apart from suggestions, quiet hours, one proactive element per screen, three per session, a dismissed card stays dismissed until its facts change) are applied there too.
 * This module reads those answers defensively, maps the guest's proactivity to the server's levels and keeps the per-session count. No change is judged, ranked or worded here. Framework-free, so it is tested in node.
 */
export const CHANGE_KINDS = ['itinerary', 'portCall', 'venue', 'tender', 'weather', 'flight', 'reservation', 'order', 'case', 'spend'] as const
export type ChangeKind = (typeof CHANGE_KINDS)[number]
export const CHANGE_STATUSES = ['verified', 'provisional', 'forecast'] as const
export type ChangeStatus = (typeof CHANGE_STATUSES)[number]
export const CONSEQUENCES = ['safety', 'lostReservation', 'conflict', 'improvement', 'optional'] as const
export type Consequence = (typeof CONSEQUENCES)[number]
export const SCREENS = ['home', 'ship', 'port', 'plan', 'travel'] as const
export type ChangeScreen = (typeof SCREENS)[number]
export type DeliveryLevel = 'off' | 'affects' | 'suggest' | 'guide'

const ACTION_KINDS: readonly ActionKind[] = ['order_item', 'add_excursion', 'move_dinner', 'reserve_dinner', 'draft_case', 'plan_change', 'remind_me']

/** An action to preview and confirm (the phase 5 kinds). */
export interface ChangeAction { kind: ActionKind; args: Record<string, string> }
export interface ChangeOption { id: string; label: string; detail: string; action: ChangeAction | null; route: string | null }
export interface ChangeAffect { kind: string; name: string; day: number; time: string | null }
export interface ChangeCard {
  id: string
  fingerprint: string
  kind: ChangeKind
  status: ChangeStatus
  source: string
  sourceAt: number
  /** The time the source was read, on the ship's clock, as words. */
  sourceAtText: string
  consequence: Consequence
  critical: boolean
  day: number | null
  title: string
  what: string
  why: string
  recommended: ChangeOption
  others: ChangeOption[]
  affects: ChangeAffect[]
  ifNothing: string
  /** A quiet tip (the rough-seas companion), not a change to anything the guest holds. */
  tip: boolean
  where: ChangeScreen[]
  noticedAt: number
}
export interface ChangeList { asOf: number; asOfText: string; cards: ChangeCard[]; unread: string[] }
export interface Missed { since: number | null; cards: ChangeCard[]; total: number }
export interface Held { id: string; reason: string }
export interface Delivery { alerts: ChangeCard[]; suggestion: ChangeCard | null; held: Held[]; digest: Missed | null }
export interface Explanation { id: string; title: string; questions: { key: string; question: string; answer: string }[] }

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => list.find((x) => x === v) ?? null
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** A path inside the app and nothing else: no scheme, no host, no way out. */
export const safeRoute = (v: unknown): string | null => (typeof v === 'string' && /^\/(?!\/)[A-Za-z0-9/_-]{0,80}$/.test(v) ? v : null)

function normalizeAction(raw: unknown): ChangeAction | null {
  const o = obj(raw)
  const kind = o ? oneOf(ACTION_KINDS, o.kind) : null
  const args = o ? obj(o.args) : null
  if (!kind || !args) return null
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(args).slice(0, 20)) if (typeof v === 'string' && /^[A-Za-z]{1,20}$/.test(k)) clean[k] = v.slice(0, 300)
  return { kind, args: clean }
}

function normalizeOption(raw: unknown): ChangeOption | null {
  const o = obj(raw)
  if (!o) return null
  const id = text(o.id, 60)
  const label = text(o.label, 120)
  if (!id || !label) return null
  const action = o.action ? normalizeAction(o.action) : null
  // An option does one thing: an action to confirm or a screen to open. When both come, the action wins and the link is dropped.
  return { id, label, detail: text(o.detail, 400), action, route: action ? null : safeRoute(o.route) }
}

/** Reads one change card; anything that is not the agreed shape gives null. */
export function normalizeCard(raw: unknown): ChangeCard | null {
  const o = obj(raw)
  if (!o) return null
  const kind = oneOf(CHANGE_KINDS, o.kind)
  const status = oneOf(CHANGE_STATUSES, o.status)
  const consequence = oneOf(CONSEQUENCES, o.consequence)
  const recommended = normalizeOption(o.recommended)
  const id = text(o.id, 120)
  if (!kind || !status || !consequence || !recommended || !id) return null
  const others = Array.isArray(o.others) ? o.others.flatMap((x) => { const p = normalizeOption(x); return p ? [p] : [] }).slice(0, 8) : []
  const affects = Array.isArray(o.affects)
    ? o.affects.flatMap((x) => { const a = obj(x); return a && text(a.name, 80) ? [{ kind: text(a.kind, 20), name: text(a.name, 80), day: num(a.day), time: typeof a.time === 'string' ? text(a.time, 5) : null }] : [] }).slice(0, 8)
    : []
  const where = Array.isArray(o.where) ? o.where.flatMap((s) => { const w = oneOf(SCREENS, s); return w ? [w] : [] }) : []
  return {
    id, fingerprint: text(o.fingerprint, 16), kind, status, source: text(o.source, 60), sourceAt: num(o.sourceAt), sourceAtText: text(o.sourceAtText, 40), consequence,
    // Critical follows the consequence, so a card cannot ask to be an alert by itself.
    critical: consequence === 'safety' || consequence === 'lostReservation',
    day: typeof o.day === 'number' && Number.isInteger(o.day) ? o.day : null,
    title: text(o.title, 120), what: text(o.what, 500), why: text(o.why, 500), recommended, others, affects, ifNothing: text(o.ifNothing, 300), tip: o.tip === true, where, noticedAt: num(o.noticedAt),
  }
}

const cards = (raw: unknown): ChangeCard[] => (Array.isArray(raw) ? raw.flatMap((c) => { const k = normalizeCard(c); return k ? [k] : [] }).slice(0, 20) : [])

export function normalizeList(raw: unknown): ChangeList | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.cards)) return null
  return { asOf: num(o.asOf), asOfText: text(o.asOfText, 40), cards: cards(o.cards), unread: Array.isArray(o.unread) ? o.unread.filter((u): u is string => typeof u === 'string').map((u) => u.slice(0, 40)).slice(0, 8) : [] }
}

/** The card a thread notice is about, from the change list, or null when it is no longer open (resolved, dismissed or replaced by a card with other facts). */
export const cardFor = (list: ChangeList | null, subject: string | undefined): ChangeCard | null => (subject ? list?.cards.find((c) => c.id === subject) ?? null : null)

export function normalizeMissed(raw: unknown): Missed | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.cards)) return null
  return { since: typeof o.since === 'number' ? o.since : null, cards: cards(o.cards).slice(0, 5), total: Math.max(0, Math.floor(num(o.total))) }
}

export function normalizeDelivery(raw: unknown): Delivery | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.alerts)) return null
  const alerts = cards(o.alerts).filter((c) => c.critical).slice(0, 3)
  // A suggestion is never critical; a critical card in that slot is an alert and is kept apart.
  const suggestion = o.suggestion ? normalizeCard(o.suggestion) : null
  return {
    alerts, suggestion: suggestion && !suggestion.critical ? suggestion : null,
    held: Array.isArray(o.held) ? o.held.flatMap((h) => { const x = obj(h); return x && text(x.id, 120) ? [{ id: text(x.id, 120), reason: text(x.reason, 20) }] : [] }).slice(0, 40) : [],
    digest: o.digest ? normalizeMissed(o.digest) : null,
  }
}

export function normalizeExplanation(raw: unknown): Explanation | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.questions)) return null
  const questions = o.questions.flatMap((q) => { const x = obj(q); return x && text(x.key, 20) && text(x.answer, 800) ? [{ key: text(x.key, 20), question: text(x.question, 120), answer: text(x.answer, 800) }] : [] })
  return questions.length === 0 ? null : { id: text(o.id, 120), title: text(o.title, 120), questions }
}

/** The guest's Stanley level as the server's proactivity: what is said unprompted. "Off" turns it all off. */
export const deliveryLevel = (level: StanleyLevel): DeliveryLevel => (level === 'off' ? 'off' : level === 'asked' ? 'affects' : level === 'helpful' ? 'suggest' : 'guide')

/** Whether a card needs a confirm (it would change something) or only a look. */
export const needsConfirm = (c: ChangeCard): boolean => c.recommended.action !== null

/** The words that mark how sure a change is, as a key suffix; a forecast never reads as a fact. */
export const certainty = (c: ChangeCard): ChangeStatus => c.status

// ---- the session: one proactive element on a screen, three in all ----

/** The proactive suggestion (or digest) shown on each screen in this session, by screen. */
export interface Session { byScreen: Partial<Record<ChangeScreen, string>> }
export const emptySession = (): Session => ({ byScreen: {} })
export const DIGEST = 'digest'

/**
 * What the server is told has been shown: the elements on the other screens. The one on this screen is left out so it can be drawn again here (one element stays on its screen for the session)
 * while still counting toward the three.
 */
export const shownElsewhere = (s: Session, screen: ChangeScreen): string[] => Object.entries(s.byScreen).filter(([k, id]) => k !== screen && !!id).map(([, id]) => id as string)

export const recordShown = (s: Session, screen: ChangeScreen, id: string | null): Session => {
  const byScreen = { ...s.byScreen }
  if (id) byScreen[screen] = id
  else delete byScreen[screen]
  return { byScreen }
}

const KEY = 'stanley-changes-session'

/** Reads the session from a storage that lasts as long as the visit (sessionStorage); a missing or broken one is an empty session. */
export function loadSession(storage: Pick<Storage, 'getItem'> | null): Session {
  try {
    const raw = storage?.getItem(KEY)
    const o = raw ? obj(JSON.parse(raw)) : null
    const by = o ? obj(o.byScreen) : null
    if (!by) return emptySession()
    const byScreen: Session['byScreen'] = {}
    for (const s of SCREENS) if (typeof by[s] === 'string' && /^[A-Za-z0-9_:-]{1,120}$/.test(by[s] as string)) byScreen[s] = by[s] as string
    return { byScreen }
  } catch { return emptySession() }
}

export function saveSession(storage: Pick<Storage, 'setItem'> | null, s: Session): void {
  try { storage?.setItem(KEY, JSON.stringify(s)) } catch { /* the count simply restarts */ }
}

/** The ids sent for a screen, or undefined when there is nothing to send (kept short for the URL and the server's limit). */
export const savedParam = (ids: readonly string[]): string | undefined => {
  const clean = ids.filter((i) => /^[A-Za-z0-9_-]{1,40}$/.test(i)).slice(0, 30)
  return clean.length > 0 ? clean.join(',') : undefined
}
