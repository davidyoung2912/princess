import { placeById } from './deck'
import { buildDay, type DayWish, type Mobility } from './day'
import { EXCURSIONS, type Interest } from './excursions'
import { eventById, type EventInterest } from './program'
import { hhmmOf, minutesOf, type PlanRow } from './planChange'
import type { Cents } from './pricing'
import { itinerary, type PortId, type Sailing } from './sailings'

/**
 * The week optimiser (S4-01), gentle mode (S6-03) and slot watch (S4-02), plus the simulated sky they use.
 * Pure and deterministic. Nothing here books or charges: a watch can only end in a proposal the guest confirms.
 */
const MIN = 60_000

const hash = (text: string): number => {
  let h = 5381
  for (const ch of text) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  return h
}

/** The sky for a day (`source: 'sim'`): UV and heat from the port, and sometimes an afternoon of rain. */
export interface SimWeather { uv: number; tempF: number; rainFrom: string | null; rainTo: string | null; source: 'sim' }

export function simWeather(sailingId: string, day: number, port: PortId): SimWeather {
  const h = hash(`${sailingId}|${day}`)
  const rain = h % 4 === 0
  const start = 12 + (h % 4)
  return { uv: (port === 'sea' ? 7 : 9) + (h % 3), tempF: 80 + (h % 9), rainFrom: rain ? hhmmOf(start * 60) : null, rainTo: rain ? hhmmOf((start + 3) * 60) : null, source: 'sim' }
}

export type GentleKind = 'rest' | 'water' | 'sun' | 'walk'
export interface GentleNote { kind: GentleKind; /** "HH:MM". */ at: string; /** The item it relates to. */ about: string }

export const HOT_F = 85
export const STRONG_UV = 8
export const LONG_WALK_MIN = 8

/** Minutes to walk between two places on the ship, from the decks and sections between them (an estimate). */
export function walkMinutes(fromPlace: string | undefined, toPlace: string | undefined): number {
  const a = placeById(fromPlace)
  const b = placeById(toPlace)
  if (!a || !b || a.id === b.id) return 0
  const sec = { forward: 0, midship: 1, aft: 2 }
  return 2 + Math.abs(a.deck - b.deck) + Math.abs(sec[a.section] - sec[b.section]) * 2
}

/** Gentle mode: a rest after two items close together, a drink before a hot outdoor item, a sun reminder for strong UV, and a warning for a long walk with little time. */
export function gentleNotes(rows: readonly PlanRow[], w: SimWeather): GentleNote[] {
  const list = rows.filter((r) => r.state !== 'dropped').map((r) => r.entry)
  const out: GentleNote[] = []
  for (let i = 0; i < list.length; i++) {
    const e = list[i]
    const start = minutesOf(e.start)
    if (e.outdoor && w.tempF >= HOT_F) out.push({ kind: 'water', at: hhmmOf(Math.max(0, start - 15)), about: e.id })
    if (e.outdoor && w.uv >= STRONG_UV) out.push({ kind: 'sun', at: hhmmOf(Math.max(0, start - 10)), about: e.id })
    const next = list[i + 1]
    if (!next) continue
    const gap = minutesOf(next.start) - (start + e.minutes)
    const walk = walkMinutes(e.placeId, next.placeId)
    if (walk >= LONG_WALK_MIN && gap < walk + 10) out.push({ kind: 'walk', at: hhmmOf(start + e.minutes), about: next.id })
    const after = list[i + 2]
    if (e.kind !== 'dinner' && next.kind !== 'dinner' && gap < 45 && after && minutesOf(after.start) - (minutesOf(next.start) + next.minutes) < 45) out.push({ kind: 'rest', at: hhmmOf(minutesOf(next.start) + next.minutes), about: after.id })
  }
  return out.sort((a, b) => a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind))
}

export type Pace = 'relaxed' | 'balanced' | 'packed'
export const PACES: readonly Pace[] = ['relaxed', 'balanced', 'packed']
export const isPace = (v: unknown): v is Pace => PACES.includes(v as Pace)

export interface WeekPrefs {
  pace: Pace
  mobility: Mobility
  withKids: boolean
  tours: readonly Interest[]
  events: readonly EventInterest[]
  /** Most to spend on a tour per adult, or null for no limit. */
  maxTour: Cents | null
  /** Nothing before 09:00. */
  noEarly: boolean
}

/** The day wishes for a set of preferences. The excursion filter reads the tour limit in whole dollars even though DayWish documents cents. */
export const wishOf = (prefs: WeekPrefs, mobility: Mobility = prefs.mobility): DayWish => ({ tours: prefs.tours, events: prefs.events, mobility, withKids: prefs.withKids, maxTour: prefs.maxTour === null ? null : prefs.maxTour / 100 })

export const DEFAULT_PREFS: WeekPrefs = { pace: 'balanced', mobility: 'any', withKids: false, tours: [], events: [], maxTour: null, noEarly: false }

const EVENTS_PER_DAY: Record<Pace, { sea: number; port: number }> = { relaxed: { sea: 1, port: 0 }, balanced: { sea: 2, port: 1 }, packed: { sea: 3, port: 2 } }

export interface WeekItem { kind: 'tour' | 'event' | 'dinner'; id: string; title: string; start: string; why: string }
export interface WeekDay { day: number; port: PortId; items: WeekItem[]; restDay: boolean; /** What a different choice would have been, when there is one. */ alternative: string | null; tourCost: Cents }
export interface Week { days: WeekDay[]; totalTours: Cents; prefs: WeekPrefs }

/** One conflict-free plan for the whole week from the pace, mobility, budget and likes. A relaxed week keeps tours easy and leaves some port days free. */
export function optimiseWeek(s: Sailing, prefs: WeekPrefs): Week {
  const days: WeekDay[] = []
  for (const d of itinerary(s)) {
    const mobility: Mobility = prefs.pace === 'relaxed' && prefs.mobility === 'any' ? 'easy' : prefs.mobility
    const wish = wishOf(prefs, mobility)
    const plan = buildDay(s, d.day, wish)
    const port = d.port !== 'sea' && d.port !== 'fll'
    const limit = EVENTS_PER_DAY[prefs.pace][port ? 'port' : 'sea']
    let events = 0
    const items: WeekItem[] = []
    for (const i of plan.items) {
      if (i.kind === 'event') { if (events >= limit) continue; events++ }
      if (prefs.noEarly && minutesOf(i.start) < 9 * 60 && i.kind !== 'dinner') continue
      items.push({ kind: i.kind, id: i.id, title: i.title, start: i.start, why: i.why })
    }
    const tour = items.find((i) => i.kind === 'tour')
    const x = tour ? EXCURSIONS.find((e) => e.id === tour.id) : undefined
    const stronger = port && !tour ? plan.items.find((i) => i.kind === 'tour') : undefined
    days.push({
      day: d.day, port: d.port, items, restDay: port && !tour,
      alternative: stronger ? `${stronger.title}, if you want to go ashore` : tour && prefs.pace !== 'packed' ? 'A free day on board instead of the tour' : null,
      tourCost: x?.price ?? 0,
    })
  }
  return { days, totalTours: days.reduce((n, d) => n + d.tourCost, 0), prefs }
}

/** Anything in the week that crosses another item the same day. Always empty for a plan this module builds; checked in tests. */
export function weekProblems(week: Week): string[] {
  const out: string[] = []
  for (const d of week.days) {
    const spans = d.items.map((i) => ({ i, a: minutesOf(i.start), b: minutesOf(i.start) + (i.kind === 'dinner' ? 90 : i.kind === 'tour' ? (EXCURSIONS.find((e) => e.id === i.id)?.hours ?? 4) * 60 : (eventById(i.id)?.minutes ?? 60)) }))
    for (let x = 0; x < spans.length; x++) for (let y = x + 1; y < spans.length; y++) if (spans[x].a < spans[y].b && spans[y].a < spans[x].b) out.push(`day ${d.day}: ${spans[x].i.title} and ${spans[y].i.title}`)
  }
  return out
}

/** Slot watch (S4-02): the guest asks to be told when a full dinner, show or excursion opens. It ends in a proposal; the guest still confirms the booking. */
export type WatchKind = 'dinner' | 'show' | 'excursion'
export const WATCH_KINDS: readonly WatchKind[] = ['dinner', 'show', 'excursion']

export interface Watch {
  id: string
  kind: WatchKind
  title: string
  /** When the slot is. */
  slotAt: number
  priceCents: Cents
  /** The most the guest will let the app propose booking. */
  capCents: Cents
  /** Standing consent to watch and to propose; it never books by itself. */
  consent: boolean
  createdAt: number
  /** For a swap: the slot the guest has now, kept until the new one is booked. */
  current: { title: string; slotAt: number } | null
  stored: 'active' | 'stopped' | 'booked'
}

export type WatchState = 'watching' | 'ready' | 'overCap' | 'expired' | 'stopped' | 'booked'
export const WATCH_LEAD_MIN = 30

/** When a place opens in this simulation, or null if it never does before the slot. Stable for a watch. */
export function simulatedOpening(w: Pick<Watch, 'id' | 'createdAt' | 'slotAt'>): number | null {
  const first = Math.floor(w.createdAt / (60 * MIN)) + 1
  const last = Math.floor((w.slotAt - WATCH_LEAD_MIN * MIN) / (60 * MIN))
  for (let b = first; b <= last && b < first + 48; b++) if (hash(`${w.id}|${b}`) % 6 === 0) return b * 60 * MIN
  return null
}

export function watchState(w: Watch, now: number): WatchState {
  if (w.stored === 'booked') return 'booked'
  if (w.stored === 'stopped') return 'stopped'
  if (now >= w.slotAt - WATCH_LEAD_MIN * MIN) return 'expired'
  const opened = simulatedOpening(w)
  if (opened === null || now < opened) return 'watching'
  return w.priceCents > w.capCents ? 'overCap' : 'ready'
}

export type WatchProblem = 'consent' | 'cap' | 'title' | 'time'

/** A new watch, or why not: it needs the guest's consent, a spending cap above zero, a title and a time still ahead. */
export function newWatch(input: Omit<Watch, 'stored' | 'id'> & { id: string }, now: number): { ok: true; watch: Watch } | { ok: false; problem: WatchProblem } {
  if (!input.consent) return { ok: false, problem: 'consent' }
  if (!input.title.trim()) return { ok: false, problem: 'title' }
  if (!Number.isFinite(input.capCents) || input.capCents <= 0) return { ok: false, problem: 'cap' }
  if (input.slotAt - now < 60 * MIN) return { ok: false, problem: 'time' }
  return { ok: true, watch: { ...input, title: input.title.trim(), stored: 'active' } }
}

/** The guest confirms: the watch ends booked, and for a swap the old slot is released in the same step. A watch that is not ready cannot be booked. */
export function bookWatch(w: Watch, now: number): { ok: true; watch: Watch; release: Watch['current'] } | { ok: false } {
  if (watchState(w, now) !== 'ready') return { ok: false }
  return { ok: true, watch: { ...w, stored: 'booked' }, release: w.current }
}

export const stopWatch = (w: Watch): Watch => (w.stored === 'active' ? { ...w, stored: 'stopped' } : w)

export function normalizeWatches(raw: unknown): Watch[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((r): Watch[] => {
    if (typeof r !== 'object' || r === null) return []
    const o = r as Record<string, unknown>
    const cur = o.current && typeof o.current === 'object' ? (o.current as Record<string, unknown>) : null
    if (typeof o.id !== 'string' || typeof o.title !== 'string' || !WATCH_KINDS.includes(o.kind as WatchKind)) return []
    if (![o.slotAt, o.priceCents, o.capCents, o.createdAt].every((n) => typeof n === 'number' && Number.isFinite(n))) return []
    return [{
      id: o.id, kind: o.kind as WatchKind, title: o.title.slice(0, 80), slotAt: o.slotAt as number, priceCents: o.priceCents as number, capCents: o.capCents as number,
      consent: o.consent === true, createdAt: o.createdAt as number,
      current: cur && typeof cur.title === 'string' && typeof cur.slotAt === 'number' ? { title: cur.title.slice(0, 80), slotAt: cur.slotAt } : null,
      stored: o.stored === 'stopped' || o.stored === 'booked' ? o.stored : 'active',
    }]
  })
}
