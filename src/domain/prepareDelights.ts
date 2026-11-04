import { itinerary, PORTS, portById, type PortId, type Sailing } from './sailings'
import { CURRENCIES } from './services'
import { inCurrencyAt, type RateTable } from './rates'
import type { Citizenship } from './documents'

/**
 * Small delights, phase DL5 (docs/small-delights.md): prepare. Pure helpers for the ready ring, one small thing a week, the passport check by
 * port, currency at home, a trip nickname, mood tiles, remind-me-in-a-week, saved travellers and the emailed recap. State is kept on this
 * device and travels in the memory document. Port entry rules are authored concept samples: the guest is always sent to the official source.
 */

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

// ---------------------------------------------------------------- D3-1: ready ring

export const RING_RADIUS = 42
/** The numbers an SVG ring needs for a percentage: the circle's length and how much of it to draw. */
export function ringDash(percent: number): { circumference: number; filled: number } {
  const p = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
  const circumference = Math.round(2 * Math.PI * RING_RADIUS * 100) / 100
  return { circumference, filled: Math.round((circumference * p) / 100 * 100) / 100 }
}

// ---------------------------------------------------------------- D3-2: one small thing this week

export interface SmallThing { id: string; /** The task is meant to be started this many weeks before sailing. */ weeksBefore: number; to: string | null }

export const SMALL_THINGS: readonly SmallThing[] = [
  { id: 'passport', weeksBefore: 26, to: '/me/documents' },
  { id: 'names', weeksBefore: 16, to: '/me/profile' },
  { id: 'insurance', weeksBefore: 12, to: '/plan/health-prep' },
  { id: 'copies', weeksBefore: 8, to: '/me/documents' },
  { id: 'medicine', weeksBefore: 6, to: '/plan/health-prep' },
  { id: 'phone', weeksBefore: 5, to: null },
  { id: 'home', weeksBefore: 4, to: '/plan/away' },
  { id: 'packing', weeksBefore: 3, to: '/plan/packing' },
  { id: 'money', weeksBefore: 2, to: '/home/clearance' },
  { id: 'charge', weeksBefore: 1, to: null },
]

/** Whole weeks left before sailing, rounded up: 7 days is one week, 8 days is two. */
export const weeksOut = (daysToDeparture: number): number => Math.max(0, Math.ceil(daysToDeparture / 7))

/**
 * The one small thing for this week: of the tasks not yet done whose time has come (their lead time is at least the weeks left), the oldest, so a
 * missed passport check comes before this week's packing. Null before the first task is due, after sailing, when all are done, or once the guest
 * turned it off for good.
 */
export function smallThing(daysToDeparture: number, done: readonly string[], off: boolean): SmallThing | null {
  if (off || daysToDeparture <= 0) return null
  const w = weeksOut(daysToDeparture)
  return SMALL_THINGS.filter((x) => !done.includes(x.id) && x.weeksBefore >= w).sort((a, b) => b.weeksBefore - a.weeksBefore)[0] ?? null
}

// ---------------------------------------------------------------- D3-3: passport check by port

export interface EntryRule {
  /** ISO country code, as the catalogue gives it. */
  country: string
  /** Months the passport must still be valid for beyond the day the ship is in that country, by citizenship (authored sample, served). */
  monthsUs: number
  monthsOther: number
  /** Whether a guest of another nationality should check for a visa. */
  visaCheckOther: boolean
  /** The official page to check this rule against (https), when the server gave one. */
  source?: string
  /** The date the sample was written ("YYYY-MM-DD"). It is not a date the rule was verified. */
  asOf?: string
}

const row = (country: string, monthsUs: number, monthsOther: number): EntryRule => ({ country, monthsUs, monthsOther, visaCheckOther: true })

/** The rules on the device until the server's table arrives (or without a server): the countries of the older route. The served table has a row for every country the catalogue sails to. */
export const AUTHORED_ENTRY_RULES: readonly EntryRule[] = [row('US', 0, 0), row('MX', 0, 0), row('BZ', 6, 6), row('HN', 6, 6)]

export interface EntryReference { version: string; rules: EntryRule[] }
let servedEntry: EntryReference | null = null
export const entryRules = (): readonly EntryRule[] => servedEntry?.rules ?? AUTHORED_ENTRY_RULES
export const applyEntry = (ref: EntryReference | null): void => { servedEntry = ref }

/** The country of the older route's own ports, which the catalogue may not list. */
const LEGACY_COUNTRY: Record<string, string> = { fll: 'US', cozumel: 'MX', belize: 'BZ', roatan: 'HN' }
export const countryOfPort = (id: string): string | undefined => portById(id)?.countryCode ?? LEGACY_COUNTRY[id]

const months = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 12 ? v : null)

/** Reads the server's table; a bad row is dropped and an answer with no usable row gives null so the authored rules stay in use. */
export function normalizeEntry(raw: unknown): EntryReference | null {
  const r = rec(raw)
  if (typeof r.version !== 'string' || r.version === '' || !Array.isArray(r.rules)) return null
  const seen = new Set<string>()
  const rules = r.rules.flatMap((x): EntryRule[] => {
    const o = rec(x)
    const us = months(o.monthsUs)
    const other = months(o.monthsOther)
    if (typeof o.country !== 'string' || !/^[A-Z]{2}$/.test(o.country) || seen.has(o.country) || us === null || other === null) return []
    seen.add(o.country)
    const source = typeof o.source === 'string' && /^https:\/\/[^\s]+$/.test(o.source) && o.source.length <= 300 ? o.source : undefined
    const asOf = typeof o.asOf === 'string' && DATE.test(o.asOf) ? o.asOf : undefined
    return [{ country: o.country, monthsUs: us, monthsOther: other, visaCheckOther: o.visaCheckOther === true, ...(source ? { source } : {}), ...(asOf ? { asOf } : {}) }]
  })
  return rules.length === 0 ? null : { version: r.version, rules }
}

/** The cruise line's own rule, counted from the return date (see `PASSPORT_VALID_MONTHS` in `documents.ts`). */
export const addMonthsTo = (date: string, months: number): string => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

export type EntryStatus = 'ok' | 'tooSoon' | 'expired'
export interface PortPassportCheck { port: Exclude<PortId, 'sea'>; date: string; status: EntryStatus; /** The last expiry date that would still do for this port. */ needUntil: string; /** A guest of another nationality should check for a visa here. */ visaCheck: boolean; /** The official page for this stop's country, when known. */ source?: string; /** The date the rule sample was written. */ asOf?: string }

/** Whether a passport expiring on `expires` ("YYYY-MM-DD") is long enough for each stop of the sailing, for a citizen of the US or of another country. Null when the date is not a date. */
export function passportByPort(expires: string, sailing: Sailing, citizenship: Citizenship = 'us', rules: readonly EntryRule[] = entryRules()): PortPassportCheck[] | null {
  if (!DATE.test(expires)) return null
  const seen = new Set<string>()
  const out: PortPassportCheck[] = []
  for (const day of itinerary(sailing)) {
    if (day.port === 'sea' || seen.has(day.port)) continue
    seen.add(day.port)
    const rule = rules.find((r) => r.country === countryOfPort(day.port))
    if (!rule) continue
    const needUntil = addMonthsTo(day.date, citizenship === 'us' ? rule.monthsUs : rule.monthsOther)
    out.push({ port: day.port, date: day.date, needUntil, visaCheck: citizenship === 'other' && rule.visaCheckOther, ...(rule.source ? { source: rule.source } : {}), ...(rule.asOf ? { asOf: rule.asOf } : {}), status: expires < day.date ? 'expired' : expires < needUntil ? 'tooSoon' : 'ok' })
  }
  return out
}

/** The worst result across the stops, for a one-line answer. */
export function worstEntry(checks: readonly PortPassportCheck[]): EntryStatus {
  return checks.some((c) => c.status === 'expired') ? 'expired' : checks.some((c) => c.status === 'tooSoon') ? 'tooSoon' : 'ok'
}

// ---------------------------------------------------------------- D3-8: currency at home

export const HOME_AMOUNT = 10_000

export interface HomeRates { asOf: string; home: string; ports: { code: string; text: string }[] }

/** What $100 is worth at home and in the countries on the way, from one dated rate table. */
export function homeRates(table: RateTable, homeCode: string): HomeRates {
  const code = CURRENCIES.some((c) => c.code === homeCode) ? homeCode : 'USD'
  const ports = ['MXN', 'BZD', 'HNL'].map((c) => ({ code: c, text: inCurrencyAt(HOME_AMOUNT, c, table) }))
  return { asOf: table.asOf, home: inCurrencyAt(HOME_AMOUNT, code, table), ports }
}

export const isHomeCurrency = (v: unknown): v is string => CURRENCIES.some((c) => c.code === v)

// ---------------------------------------------------------------- D0-2: trip nickname

export const NICKNAME_MAX = 40
export const cleanNickname = (v: unknown): string => clean(v, NICKNAME_MAX).replace(/[<>]/g, '')
/** A title with the nickname in front when there is one: "Mum's 70th: 7 nights". */
export const withNickname = (nickname: string, title: string): string => (nickname ? `${nickname}: ${title}` : title)

// ---------------------------------------------------------------- D0-4: mood tiles

export const MOODS = ['quietBeach', 'market', 'history', 'reef', 'wildlife', 'seaDays'] as const
export type MoodId = (typeof MOODS)[number]
export const isMood = (v: unknown): v is MoodId => MOODS.some((m) => m === v)

type StopId = Exclude<PortId, 'sea' | 'fll'>
/** Authored: what each stop is known for. */
export const PORT_MOODS: Record<StopId, readonly MoodId[]> = {
  cozumel: ['quietBeach', 'market', 'history', 'reef'],
  belize: ['history', 'wildlife', 'reef'],
  roatan: ['quietBeach', 'reef', 'wildlife'],
}

export interface MoodMatch { port: StopId; name: string; matched: MoodId[] }

/** The stops in the order of how many of the picked moods they match (ties keep the order of the voyage). With nothing picked, the voyage order. */
export function rankPorts(picked: readonly MoodId[]): MoodMatch[] {
  const order = (Object.keys(PORT_MOODS) as StopId[])
  return order
    .map((port, i) => ({ port, i, name: PORTS[port].name, matched: PORT_MOODS[port].filter((m) => picked.includes(m)) }))
    .sort((a, b) => b.matched.length - a.matched.length || a.i - b.i)
    .map(({ i: _i, ...m }) => m)
}

/** True when sea days were picked: the ports cannot give that, the ship can. */
export const wantsSeaDays = (picked: readonly MoodId[]): boolean => picked.includes('seaDays')

// ---------------------------------------------------------------- D0-8: remind me in a week

export const REMIND_DAYS = 7
export interface Reminder { at: number; sailingId: string; /** The guest also asked for one email to the address on their account. */ email: boolean }

export const remindFrom = (now: number, sailingId: string, email = false): Reminder => ({ at: now + REMIND_DAYS * DAY_MS, sailingId, email })
/** Whether the app should ask the server to check for the reminder email: asked for, and the time has come. */
export const emailCheckDue = (r: Reminder | null, now: number): boolean => r !== null && r.email && now >= r.at
export type ReminderState = 'none' | 'waiting' | 'due'
export const reminderState = (r: Reminder | null, now: number): ReminderState => (r === null ? 'none' : now >= r.at ? 'due' : 'waiting')

// ---------------------------------------------------------------- D2-6: saved travellers

export const SAVED_MAX = 8
export interface SavedTraveller { id: string; firstName: string; lastName: string; /** "YYYY-MM-DD". */ dob: string; citizenship: Citizenship | '' }

const sameTraveller = (a: Pick<SavedTraveller, 'firstName' | 'lastName' | 'dob'>, b: Pick<SavedTraveller, 'firstName' | 'lastName' | 'dob'>): boolean =>
  a.firstName.toLowerCase() === b.firstName.toLowerCase() && a.lastName.toLowerCase() === b.lastName.toLowerCase() && a.dob === b.dob

/** Whether a guest on the form has enough to be worth saving: both names and a real date of birth. */
export const canSaveTraveller = (g: { firstName: string; lastName: string; dob: string }): boolean => clean(g.firstName, 40) !== '' && clean(g.lastName, 40) !== '' && DATE.test(g.dob)

/** Adds a traveller, or updates the same person (same names and date of birth). A full list refuses a new person. */
export function saveTraveller(list: readonly SavedTraveller[], g: Omit<SavedTraveller, 'id'>, id: string): SavedTraveller[] {
  if (!canSaveTraveller(g)) return [...list]
  const next: SavedTraveller = { id, firstName: clean(g.firstName, 40), lastName: clean(g.lastName, 40), dob: g.dob, citizenship: g.citizenship }
  const at = list.findIndex((x) => sameTraveller(x, next))
  if (at >= 0) return list.map((x, i) => (i === at ? { ...next, id: x.id } : x))
  return list.length >= SAVED_MAX ? [...list] : [...list, next]
}

export const forgetTraveller = (list: readonly SavedTraveller[], id: string): SavedTraveller[] => list.filter((x) => x.id !== id)

/** Saved people not already on the form, so each is offered once. */
export const unusedSaved = (list: readonly SavedTraveller[], onForm: readonly Pick<SavedTraveller, 'firstName' | 'lastName' | 'dob'>[]): SavedTraveller[] =>
  list.filter((s) => !onForm.some((g) => sameTraveller(g, s)))

// ---------------------------------------------------------------- D2-8: email this summary

export const MAIL_BODY_MAX = 1500
/** A `mailto:` link with the recap as the body. The address is used only if it looks like one; nothing is sent from here. */
export function recapMailto(to: string, subject: string, body: string): string {
  const addr = to.trim()
  const ok = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(addr) ? addr : ''
  const text = body.length > MAIL_BODY_MAX ? `${body.slice(0, MAIL_BODY_MAX - 1).trimEnd()}…` : body
  return `mailto:${encodeURIComponent(ok).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}

/** What the recap says is not in the price, in plain words (the Decide summary says it too; this is the one list both use). */
export const NOT_INCLUDED: readonly string[] = ['Drinks, Wi-Fi and speciality dining', 'Shore tours', 'Flights and hotels', 'Travel insurance']

// ---------------------------------------------------------------- State kept in the memory document

export interface PrepareState {
  /** Small things already done, and whether the guest turned the weekly one off for good. */
  smallDone: string[]
  smallOff: boolean
  homeCurrency: string
  nickname: string
  moods: MoodId[]
  remind: Reminder | null
  travellers: SavedTraveller[]
}
export const EMPTY_PREPARE: PrepareState = { smallDone: [], smallOff: false, homeCurrency: 'USD', nickname: '', moods: [], remind: null, travellers: [] }

export function normalizePrepare(raw: unknown): PrepareState {
  const r = rec(raw)
  const smallDone = (Array.isArray(r.smallDone) ? r.smallDone : []).filter((x): x is string => SMALL_THINGS.some((s) => s.id === x))
  const moods = (Array.isArray(r.moods) ? r.moods : []).filter(isMood).filter((m, i, a) => a.indexOf(m) === i)
  const rm = rec(r.remind)
  const remind = typeof rm.at === 'number' && Number.isFinite(rm.at) && typeof rm.sailingId === 'string' ? { at: rm.at, sailingId: clean(rm.sailingId, 40), email: rm.email === true } : null
  const travellers = (Array.isArray(r.travellers) ? r.travellers : []).flatMap((x): SavedTraveller[] => {
    const o = rec(x)
    const g = { firstName: clean(o.firstName, 40), lastName: clean(o.lastName, 40), dob: typeof o.dob === 'string' ? o.dob : '' }
    if (typeof o.id !== 'string' || !canSaveTraveller(g)) return []
    return [{ id: o.id, ...g, citizenship: o.citizenship === 'us' || o.citizenship === 'other' ? o.citizenship : '' }]
  }).slice(0, SAVED_MAX)
  return {
    smallDone: [...new Set(smallDone)], smallOff: r.smallOff === true,
    homeCurrency: isHomeCurrency(r.homeCurrency) ? r.homeCurrency : 'USD',
    nickname: cleanNickname(r.nickname), moods, remind, travellers,
  }
}
