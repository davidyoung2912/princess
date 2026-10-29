import type { Cents } from './pricing'
import { GRATUITY_PER_NIGHT, GRATUITY_PER_NIGHT_SUITE, NIGHTS } from './pricing'
import type { ScenarioId } from './scenarios'

/** Service requests, security reports, the drinks tracker, group bills, money, cabin parties, safeguards and system status (MSG-03, SAF-04, DIN-06, DIN-09, ACC-03, ACC-05, ACC-07, ROM-06, MSG-05, SUP-04). */
const MIN = 60_000

// ---- One-tap service requests (MSG-03) ----
export type RequestGroup = 'housekeeping' | 'maintenance'
export interface RequestItem { id: string; group: RequestGroup; etaMin: number; maxQty: number }

export const REQUEST_ITEMS: readonly RequestItem[] = [
  { id: 'towels', group: 'housekeeping', etaMin: 20, maxQty: 4 },
  { id: 'pillows', group: 'housekeeping', etaMin: 20, maxQty: 4 },
  { id: 'bedding', group: 'housekeeping', etaMin: 30, maxQty: 2 },
  { id: 'toiletries', group: 'housekeeping', etaMin: 20, maxQty: 3 },
  { id: 'ice', group: 'housekeeping', etaMin: 15, maxQty: 1 },
  { id: 'turndown', group: 'housekeeping', etaMin: 45, maxQty: 1 },
  { id: 'light', group: 'maintenance', etaMin: 60, maxQty: 1 },
  { id: 'aircon', group: 'maintenance', etaMin: 45, maxQty: 1 },
  { id: 'plumbing', group: 'maintenance', etaMin: 40, maxQty: 1 },
  { id: 'tv', group: 'maintenance', etaMin: 60, maxQty: 1 },
]

export const requestItem = (id: unknown): RequestItem | undefined => REQUEST_ITEMS.find((r) => r.id === id)

export type RequestStage = 'received' | 'onTheWay' | 'done' | 'cancelled'

/** Received, on the way after half the usual time, done after all of it. A person can cancel only while it is merely received. */
export function requestStage(placedAt: number, etaMin: number, now: number, cancelledAt?: number): RequestStage {
  if (cancelledAt !== undefined) return 'cancelled'
  const waited = now - placedAt
  if (waited >= etaMin * MIN) return 'done'
  return waited >= (etaMin * MIN) / 2 ? 'onTheWay' : 'received'
}

export const MAX_OPEN_REQUESTS = 6

// ---- Security and man-overboard reporting (SAF-04) ----
export type ReportKind = 'overboard' | 'theft' | 'harassment' | 'suspicious' | 'hazard'
export const REPORT_KINDS: readonly ReportKind[] = ['overboard', 'theft', 'harassment', 'suspicious', 'hazard']
/** These need a call at once, not a form. */
export const URGENT_REPORTS: readonly ReportKind[] = ['overboard']
export const MAX_REPORT_TEXT = 600

export type ReportProblem = 'badKind' | 'noWhere' | 'noNote' | 'tooLong'
export function reportProblem(kind: unknown, where: unknown, note: unknown): ReportProblem | null {
  if (!REPORT_KINDS.includes(kind as ReportKind)) return 'badKind'
  if (typeof where !== 'string' || where.trim().length < 2 || where.length > 120) return 'noWhere'
  if (typeof note !== 'string' || note.trim().length < 5) return 'noNote'
  if (note.length > MAX_REPORT_TEXT) return 'tooLong'
  return null
}

// ---- The drinks tracker (DIN-06) ----
export interface Drink { id: string; cents: Cents; alcohol: boolean }
export const BAR_MENU: readonly Drink[] = [
  { id: 'beer', cents: 800, alcohol: true },
  { id: 'wine', cents: 1200, alcohol: true },
  { id: 'mojito', cents: 1300, alcohol: true },
  { id: 'margarita', cents: 1400, alcohol: true },
  { id: 'premiumCocktail', cents: 1900, alcohol: true },
  { id: 'mocktail', cents: 700, alcohol: false },
  { id: 'soda', cents: 400, alcohol: false },
  { id: 'coffee', cents: 500, alcohol: false },
]
export const drinkById = (id: unknown): Drink | undefined => BAR_MENU.find((d) => d.id === id)

/** A drinks package covers this many drinks a day, up to a price per drink. */
export const DAILY_PACKAGE_DRINKS = 15
export const ALERT_AFTER = 4
export const ALERT_WINDOW_MIN = 180
export const STOP_AFTER = 6

export interface DrinkLog { id: string; drinkId: string; at: number }

export interface DrinkSummary {
  today: number
  covered: number
  /** Drinks left under the daily package limit, or null with no package. */
  left: number | null
  paid: Cents
  alcoholRecently: number
  alert: 'none' | 'slow' | 'stop'
}

/** What a guest has had today (a ship day, judged by the caller) and whether to slow down: four alcoholic drinks in three hours is a nudge, six is a stop. */
export function drinkSummary(today: readonly DrinkLog[], capUsd: number, now: number): DrinkSummary {
  let covered = 0
  let paid = 0
  for (const log of [...today].sort((a, b) => a.at - b.at)) {
    const d = drinkById(log.drinkId)
    if (!d) continue
    if (capUsd > 0 && d.cents <= capUsd * 100 && covered < DAILY_PACKAGE_DRINKS) covered++
    else paid += d.cents
  }
  const alcoholRecently = today.filter((l) => drinkById(l.drinkId)?.alcohol && now - l.at <= ALERT_WINDOW_MIN * MIN && now >= l.at).length
  return { today: today.length, covered, left: capUsd > 0 ? Math.max(0, DAILY_PACKAGE_DRINKS - covered) : null, paid, alcoholRecently, alert: alcoholRecently >= STOP_AFTER ? 'stop' : alcoholRecently >= ALERT_AFTER ? 'slow' : 'none' }
}

// ---- Group dining and splitting the bill (DIN-09) ----
export const MAX_TABLE = 8
export interface Friend { name: string; cabin: string }

/** Dollars split fairly: shares add up to the total, with spare cents going to the first people. */
export function splitEvenly(total: Cents, people: number): Cents[] {
  const n = Math.max(1, Math.floor(people))
  const base = Math.floor(total / n)
  const extra = total - base * n
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0))
}

export type FriendProblem = 'noName' | 'badCabin' | 'full' | 'duplicate'
export function friendProblem(f: Friend, existing: readonly Friend[], partySize: number): FriendProblem | null {
  if (f.name.trim().length < 2 || f.name.length > 40) return 'noName'
  if (!/^\d{4,5}$/.test(f.cabin)) return 'badCabin'
  if (partySize + existing.length >= MAX_TABLE) return 'full'
  if (existing.some((x) => x.cabin === f.cabin && x.name.trim().toLowerCase() === f.name.trim().toLowerCase())) return 'duplicate'
  return null
}

// ---- Money: top-up, PIN, gratuities, currency (ACC-03, ACC-05, ACC-07) ----
export const TOPUP_MIN = 25
export const TOPUP_MAX = 1000
export const TOPUP_TOTAL_MAX = 2000
export const TOPUP_STEP = 25

export type TopUpProblem = 'badAmount' | 'tooMuch' | 'noCard'
export function topUpProblem(dollars: unknown, alreadyDollars: number): TopUpProblem | null {
  if (typeof dollars !== 'number' || !Number.isInteger(dollars) || dollars < TOPUP_MIN || dollars > TOPUP_MAX || dollars % TOPUP_STEP !== 0) return 'badAmount'
  if (alreadyDollars + dollars > TOPUP_TOTAL_MAX) return 'tooMuch'
  return null
}

/** Cash is handed in at Guest Services and counts after the desk has entered it: this long after the guest asks. */
export const CASH_DESK_MIN = 120

export type PinProblem = 'format' | 'weak'
export function pinProblem(pin: unknown): PinProblem | null {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return 'format'
  if (/^(\d)\1{3}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'weak'
  return null
}

/** A one-way scramble so the PIN itself is not kept. Enough for a concept; a real service hashes on its server. */
export function pinDigest(pin: string, salt: string): string {
  let h = 2166136261
  for (const ch of `${salt}|${pin}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return h.toString(36)
}

export const GRATUITY_REASON_MIN = 15

/** Gratuities due for the whole cruise for the guests who pay them (a package includes them for others). */
export function gratuityDue(guests: readonly { suite: boolean; included: boolean }[]): Cents {
  return guests.reduce((n, g) => n + (g.included ? 0 : (g.suite ? GRATUITY_PER_NIGHT_SUITE : GRATUITY_PER_NIGHT) * NIGHTS), 0)
}

export type GratuityChoice = 'standard' | 'prepaid' | 'removal'

export interface Currency { code: string; symbol: string; perUsd: number }
/** Authored sample rates, not live ones. */
export const CURRENCIES: readonly Currency[] = [
  { code: 'USD', symbol: '$', perUsd: 1 },
  { code: 'EUR', symbol: '€', perUsd: 0.92 },
  { code: 'GBP', symbol: '£', perUsd: 0.79 },
  { code: 'CAD', symbol: 'C$', perUsd: 1.36 },
  { code: 'MXN', symbol: 'MX$', perUsd: 17.1 },
  { code: 'BZD', symbol: 'BZ$', perUsd: 2 },
  { code: 'HNL', symbol: 'L', perUsd: 24.7 },
]
export const currencyByCode = (code: unknown): Currency | undefined => CURRENCIES.find((c) => c.code === code)
export const RATES_AS_OF = '2026-10-01'

export function inCurrency(cents: Cents, code: string): string {
  const c = currencyByCode(code) ?? CURRENCIES[0]
  const amount = (cents / 100) * c.perUsd
  const sign = amount < 0 ? '-' : ''
  return `${sign}${c.symbol}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ---- Cabin parties (ROM-06) ----
export const MAX_PARTY_CABINS = 6
export const QUIET_FROM = '23:00'
export interface PartyInput { title: string; day: number; time: string; cabins: readonly string[] }
export type PartyProblem = 'noTitle' | 'badDay' | 'badTime' | 'quiet' | 'noCabins' | 'tooMany' | 'badCabin'
export function partyProblem(p: PartyInput): PartyProblem | null {
  if (p.title.trim().length < 2 || p.title.length > 50) return 'noTitle'
  if (!Number.isInteger(p.day) || p.day < 1 || p.day > 7) return 'badDay'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)) return 'badTime'
  if (p.time >= QUIET_FROM || p.time < '08:00') return 'quiet'
  if (p.cabins.length === 0) return 'noCabins'
  if (p.cabins.length > MAX_PARTY_CABINS) return 'tooMany'
  if (!p.cabins.every((c) => /^\d{4,5}$/.test(c)) || new Set(p.cabins).size !== p.cabins.length) return 'badCabin'
  return null
}

/** Whether a neighbour has said yes, the same every time. */
export function rsvp(cabin: string, title: string): 'yes' | 'maybe' | 'no' {
  let h = 5381
  for (const ch of `${cabin}|${title}`) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  return (['yes', 'maybe', 'no'] as const)[h % 3]
}

// ---- Safeguards in chat (MSG-01, MSG-05) ----
export const PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_PHOTO_BYTES = 1_000_000
export const PHOTO_MIN_AGE = 18
/** Messages stay on the ship's servers this long after the cruise, then go (the retention rule in the privacy centre). */
export const CHAT_RETENTION_DAYS = 30

export type PhotoProblem = 'type' | 'size' | 'age' | 'empty'
export function photoProblem(type: string, bytes: number, age: number): PhotoProblem | null {
  if (age < PHOTO_MIN_AGE) return 'age'
  if (!PHOTO_TYPES.includes(type)) return 'type'
  if (bytes <= 0) return 'empty'
  if (bytes > MAX_PHOTO_BYTES) return 'size'
  return null
}

export const REPORT_REASONS = ['spam', 'rude', 'unsafe', 'photo'] as const
export type ChatReportReason = (typeof REPORT_REASONS)[number]

// ---- System status (SUP-04) ----
export type Health = 'ok' | 'slow' | 'down'
export interface StatusRow { id: string; health: Health; issue: boolean }

/** What each part of the service is doing, from the demo's scenarios and network. */
export function systemStatus(scenarios: readonly ScenarioId[], offline: boolean): StatusRow[] {
  const on = (...ids: ScenarioId[]) => ids.some((i) => scenarios.includes(i))
  const row = (id: string, health: Health): StatusRow => ({ id, health: offline ? 'down' : health, issue: (offline ? 'down' : health) !== 'ok' })
  return [
    row('booking', on('bookingLag') ? 'slow' : 'ok'),
    row('checkin', on('checkinDrop') ? 'down' : 'ok'),
    row('dining', on('dinnerReschedule') ? 'slow' : 'ok'),
    row('ordering', on('orderStock') ? 'slow' : 'ok'),
    row('chat', on('chatSlow') ? 'slow' : 'ok'),
    row('photos', on('photoFail') ? 'down' : 'ok'),
    row('account', 'ok'),
  ]
}

// ---- Port days (POR-05, POR-07, POR-13) ----
export const LAST_MINUTE_LEAD_MIN = 120

export interface PortContacts { consulate: string; emergency: string; agent: string }
/** Sample numbers: 555 numbers are reserved for fiction. */
export const PORT_CONTACTS: Record<'cozumel' | 'belize' | 'roatan', PortContacts> = {
  cozumel: { consulate: 'U.S. consular agency, Cozumel: 555-0141', emergency: '911 (Mexico)', agent: 'Ship’s agent, Cozumel pier: 555-0142' },
  belize: { consulate: 'U.S. Embassy, Belmopan: 555-0151', emergency: '911 (Belize)', agent: 'Ship’s agent, Belize tender pier: 555-0152' },
  roatan: { consulate: 'U.S. Embassy, Tegucigalpa: 555-0161', emergency: '911 (Honduras)', agent: 'Ship’s agent, Mahogany Bay: 555-0162' },
}

export interface ReadyItem { id: string; tender?: boolean; sun?: boolean }
export const PORT_READY: readonly ReadyItem[] = [
  { id: 'card' }, { id: 'id' }, { id: 'allAboard' }, { id: 'sun', sun: true }, { id: 'water' }, { id: 'cash' }, { id: 'phone' }, { id: 'tender', tender: true }, { id: 'shoes' },
]
export const readyFor = (tender: boolean): ReadyItem[] => PORT_READY.filter((r) => !r.tender || tender)

/** The list as plain text for one-tap sharing. */
export function readyText(title: string, lines: readonly { label: string; done: boolean }[]): string {
  return [title, ...lines.map((l) => `${l.done ? '[x]' : '[ ]'} ${l.label}`)].join('\n')
}

/** Under-18s cannot pass on a phone number or a link in chat (MSG-05). */
export function childSafeProblem(text: string, age: number): 'contactInfo' | null {
  return age < PHOTO_MIN_AGE && /(\d[\s.-]?){7,}|https?:\/\/|www\./i.test(text) ? 'contactInfo' : null
}
