import { cabinsFor, type Cabin } from './cabins'
import { ELEVATORS, PLACES, type Place } from './deck'
import type { ClubId } from './family'
import { inQuietHours, type Category } from './notifications'
import { SAILINGS } from './sailings'
import { CATEGORIES } from './ship'

/**
 * H8 slice C: on board (S6-08, S6-09, S6-10, S6-13 to S6-21, S6-25). Pure. Everything is single-device and simulated where it says so;
 * reminders and checks are shown on the screen and nothing is sent to anyone.
 */
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const num = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : null)
const hash = (s: string): number => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const MIN = 60_000

// ---- S6-09: seasickness first aid ----
/** The calmest places: midship, low decks, no stairs to reach, away from the loud venues. Same rule as the cabin motion score. */
export const calmestPlaces = (): Place[] => PLACES.filter((p) => p.section === 'midship' && p.deck <= 8 && p.stepFree && p.kind !== 'bar' && p.kind !== 'show').slice(0, 4)
export const SEASICK_HELPS = ['horizon', 'air', 'ginger', 'small', 'midship'] as const
export const SEASICK_DOCTOR = ['keepDown', 'faint', 'long', 'chest'] as const
export const SEASICK_SEEN_MIN = 30
export type SeasickStatus = 'none' | 'asked' | 'seen'
/** A request for tablets or a visit is logged on this device; "seen" is a simulated crew reply after 30 minutes. */
export const seasickStatus = (at: number | null, now: number): SeasickStatus => (at === null ? 'none' : now - at >= SEASICK_SEEN_MIN * MIN ? 'seen' : 'asked')

// ---- S6-10: lounger fair use ----
export const LOUNGERS = 8
export const HOLD_MINUTES = 40
export interface LoungerHold { id: number; start: number }
export type LoungerState = 'free' | 'held' | 'mine' | 'overdue' | 'reported' | 'lapsed'
export interface LoungerRow { id: number; state: LoungerState; /** Minutes until a held lounger is due back, or null. */ returnsIn: number | null }
/** The other loungers as the server reports them: free, held or left too long. Yours is real on this device. */
export interface LoungerOther { id: number; state: 'free' | 'held' | 'overdue'; returnsIn: number | null }
/** The board: the feed's others, with the guest's own hold and reports (which stay on their device) laid over it. */
export function loungerBoard(now: number, mine: LoungerHold | null, reported: readonly number[], others: readonly LoungerOther[]): LoungerRow[] {
  return others.map((o) => {
    if (mine && mine.id === o.id) {
      const left = HOLD_MINUTES - Math.floor((now - mine.start) / MIN)
      return left > 0 ? { id: o.id, state: 'mine' as const, returnsIn: left } : { id: o.id, state: 'lapsed' as const, returnsIn: null }
    }
    return o.state === 'overdue' && reported.includes(o.id) ? { id: o.id, state: 'reported' as const, returnsIn: null } : o
  })
}
/** Take a lounger: only a free one, and only one at a time. */
export function takeLounger(board: readonly LoungerRow[], mine: LoungerHold | null, id: number, now: number): LoungerHold | null {
  const row = board.find((r) => r.id === id)
  const active = mine && now - mine.start < HOLD_MINUTES * MIN
  return row && row.state === 'free' && !active ? { id, start: now } : mine
}

// ---- S6-13: kids' daily report ----
const DID = ['painted a big picture', 'built a tower out of blocks', 'played a parachute game', 'made a bracelet', 'did a treasure hunt', 'danced in a circle']
const ATE = ['ate all their lunch', 'ate most of their snack', 'tried a new fruit', 'drank lots of water']
const FELT = ['happy all morning', 'a bit shy at first, then joined in', 'full of energy', 'tired by the end and ready for a rest']
/** A simulated summary from the club for one child and day, the same each time. Only built once a parent has agreed. */
export function kidsReport(name: string, club: ClubId, day: number): string[] {
  const n = clean(name, 30) || 'Your child'
  const h = hash(`${club}|${day}|${n}`)
  return [`${n} ${DID[h % DID.length]}.`, `${n} ${ATE[(h >> 3) % ATE.length]}.`, `${n} was ${FELT[(h >> 6) % FELT.length]}.`]
}

// ---- S6-14, S6-15, S6-17: teen agreement, "I'm OK" tap, solo safety timer ----
export const TEEN_RULES = ['checkin', 'curfew', 'phone', 'zones', 'together'] as const
export interface Teen { name: string; agreed: string[]; teenSigned: boolean; parentSigned: boolean }
export const EMPTY_TEEN: Teen = { name: '', agreed: [], teenSigned: false, parentSigned: false }
export const teenComplete = (t: Teen): boolean => t.name !== '' && t.agreed.length === TEEN_RULES.length && t.teenSigned && t.parentSigned

export const OK_HOURS = [2, 4, 8] as const
export interface OkTap { lastAt: number | null; every: (typeof OK_HOURS)[number] }
export const EMPTY_OK: OkTap = { lastAt: null, every: 4 }
export type OkStatus = 'none' | 'ok' | 'due'
export const okStatus = (o: OkTap, now: number): OkStatus => (o.lastAt === null ? 'none' : now - o.lastAt >= o.every * 60 * MIN ? 'due' : 'ok')

export const SOLO_MINUTES = [30, 60, 120, 180] as const
export interface SoloTimer { label: string; dueAt: number }
export type SoloState = 'none' | 'running' | 'due' | 'overdue'
export const SOLO_GRACE_MIN = 15
export const startSolo = (label: string, minutes: number, now: number): SoloTimer | null => (SOLO_MINUTES.includes(minutes as 30) ? { label: clean(label, 60), dueAt: now + minutes * MIN } : null)
export const soloState = (s: SoloTimer | null, now: number): SoloState => (!s ? 'none' : now < s.dueAt ? 'running' : now < s.dueAt + SOLO_GRACE_MIN * MIN ? 'due' : 'overdue')

// ---- S6-16: words-only route to the cabin ----
export const findCabin = (number: string): Cabin | null => {
  for (const s of SAILINGS) for (const c of CATEGORIES) { const f = cabinsFor(s.id, c.id).find((x) => x.number === number.trim()); if (f) return f }
  return null
}
/** Steps in plain words from the nearest lift bank. Authored positions; check the signs on board. */
export function cabinWords(c: Cabin): { bank: string; steps: { key: 'bank' | 'deck' | 'side' | 'number'; params: Record<string, string | number> }[] } {
  const bank = ELEVATORS.find((e) => e.section === c.position && e.side === c.side) ?? ELEVATORS.find((e) => e.section === c.position)!
  return { bank: bank.bank, steps: [
    { key: 'bank', params: { bank: bank.bank, section: c.position } },
    { key: 'deck', params: { deck: c.deck } },
    { key: 'side', params: { side: c.side } },
    { key: 'number', params: { number: c.number } },
  ] }
}

// ---- S6-18: do-not-disturb schedules ----
export interface DndSchedule { id: string; from: string; to: string; on: boolean }
export const DND_MAX = 4
const hhmm = (v: unknown, d: string): string => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d)
/** True when any schedule that is on covers the time. Critical notices are never held back. */
export const dndNow = (list: readonly DndSchedule[], at: string, category: Category): boolean => list.some((s) => s.on && inQuietHours({ on: true, from: s.from, to: s.to }, at, category))

/** The guest's account quiet hours (kept on the server with the other notification choices) count as one more schedule, so both settings hold notices back the same way. */
export const withQuietHours = (list: readonly DndSchedule[], quiet: { on: boolean; from: string; to: string }): DndSchedule[] => [...list, { id: 'account-quiet', ...quiet }]

/** The notices list while a do-not-disturb schedule is running: critical notices stay in view, the rest wait in a held list until it ends (nothing is deleted). */
export function splitHeld<T extends { category: Category }>(notices: readonly T[], list: readonly DndSchedule[], at: string): { shown: T[]; held: T[] } {
  const shown: T[] = []
  const held: T[] = []
  for (const n of notices) (dndNow(list, at, n.category) ? held : shown).push(n)
  return { shown, held }
}

// ---- S6-19: you said, we did ----
export const YOU_SAID = ['pool', 'wifi', 'menu', 'kids', 'signs', 'tender'] as const

// ---- S6-20: dining favourites and table preferences ----
export interface TablePref { size: 'any' | '2' | '4' | '6'; quiet: boolean; time: 'any' | 'early' | 'late' }
export interface DiningPrefs { favourites: string[]; table: TablePref }
export const EMPTY_DINING: DiningPrefs = { favourites: [], table: { size: 'any', quiet: false, time: 'any' } }
export const diningPlaces = (): Place[] => PLACES.filter((p) => p.kind === 'dining')

// ---- S6-21: step and deck-lap challenge ----
export const STEP_GOAL = 7000
export const LAP_STEPS = 1200
export interface Challenge { total: number; daysMet: number; laps: number; toGoal: number }
export function challenge(byDay: Record<string, number>, today: number): Challenge {
  const v = Object.values(byDay)
  const total = v.reduce((a, b) => a + b, 0)
  return { total, daysMet: v.filter((n) => n >= STEP_GOAL).length, laps: Math.floor(total / LAP_STEPS), toGoal: Math.max(0, STEP_GOAL - (byDay[String(today)] ?? 0)) }
}

// ---- S6-25: lost and found ----
export interface LostReport { id: string; what: string; where: string; at: number }
export const LOST_MAX = 5
export interface FoundItem { id: string; what: string; keywords: string[]; at: 'guest-services' | 'eatery' | 'lido-pool' }
export const matchFound = (r: Pick<LostReport, 'what'>, items: readonly FoundItem[]): FoundItem[] => {
  const words = r.what.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2)
  return items.filter((f) => f.keywords.some((k) => words.includes(k)))
}

// ---- S6-08: sightings log ----
export const SPECIES = ['dolphins', 'flyingFish', 'frigatebird', 'turtle', 'whale', 'ray'] as const
export interface Sighting { id: string; species: string; day: number }
export const SIGHTINGS_MAX = 30

// ---- State kept on the device ----
export interface AboardState {
  seasick: number | null; lounger: LoungerHold | null; reported: number[]
  kidsConsent: boolean; teen: Teen; ok: OkTap; solo: SoloTimer | null
  cabin: string; dnd: DndSchedule[]; dining: DiningPrefs; steps: Record<string, number>
  lost: LostReport[]; sightings: Sighting[]
}
export const EMPTY_ABOARD: AboardState = { seasick: null, lounger: null, reported: [], kidsConsent: false, teen: EMPTY_TEEN, ok: EMPTY_OK, solo: null, cabin: '', dnd: [], dining: EMPTY_DINING, steps: {}, lost: [], sightings: [] }

export function normalizeAboard(raw: unknown): AboardState {
  const r = rec(raw)
  const lg = rec(r.lounger), t = rec(r.teen), ok = rec(r.ok), solo = rec(r.solo), d = rec(r.dining), tb = rec(d.table)
  const steps: Record<string, number> = {}
  for (const [k, v] of Object.entries(rec(r.steps))) { const n = num(v, 0, 100_000); if (/^[1-8]$/.test(k) && n !== null) steps[k] = n }
  return {
    seasick: num(r.seasick, 0, Number.MAX_SAFE_INTEGER),
    lounger: num(lg.id, 1, LOUNGERS) !== null && num(lg.start, 0, Number.MAX_SAFE_INTEGER) !== null ? { id: num(lg.id, 1, LOUNGERS)!, start: num(lg.start, 0, Number.MAX_SAFE_INTEGER)! } : null,
    reported: arr(r.reported).filter((n): n is number => typeof n === 'number' && n >= 1 && n <= LOUNGERS).slice(0, LOUNGERS),
    kidsConsent: r.kidsConsent === true,
    teen: { name: clean(t.name, 30), agreed: arr(t.agreed).filter((k): k is string => (TEEN_RULES as readonly unknown[]).includes(k)), teenSigned: t.teenSigned === true, parentSigned: t.parentSigned === true },
    ok: { lastAt: num(ok.lastAt, 0, Number.MAX_SAFE_INTEGER), every: OK_HOURS.find((h) => h === ok.every) ?? 4 },
    solo: typeof solo.dueAt === 'number' ? { label: clean(solo.label, 60), dueAt: solo.dueAt } : null,
    cabin: clean(r.cabin, 6),
    dnd: arr(r.dnd).flatMap((x): DndSchedule[] => { const o = rec(x); return typeof o.id === 'string' ? [{ id: o.id, from: hhmm(o.from, '22:00'), to: hhmm(o.to, '07:00'), on: o.on === true }] : [] }).slice(0, DND_MAX),
    dining: {
      favourites: arr(d.favourites).filter((k): k is string => diningPlaces().some((p) => p.id === k)).slice(0, 12),
      table: { size: tb.size === '2' || tb.size === '4' || tb.size === '6' ? tb.size : 'any', quiet: tb.quiet === true, time: tb.time === 'early' || tb.time === 'late' ? tb.time : 'any' },
    },
    steps,
    lost: arr(r.lost).flatMap((x): LostReport[] => { const o = rec(x); return typeof o.id === 'string' && clean(o.what, 80) ? [{ id: o.id, what: clean(o.what, 80), where: clean(o.where, 80), at: typeof o.at === 'number' ? o.at : 0 }] : [] }).slice(0, LOST_MAX),
    sightings: arr(r.sightings).flatMap((x): Sighting[] => { const o = rec(x); const day = num(o.day, 1, 8); return typeof o.id === 'string' && (SPECIES as readonly unknown[]).includes(o.species) && day !== null ? [{ id: o.id, species: o.species as string, day }] : [] }).slice(0, SIGHTINGS_MAX),
  }
}
