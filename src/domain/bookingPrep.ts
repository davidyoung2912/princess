import { formatMoney, type Cents } from './pricing'
import type { ChecklistEntry } from './checklist'
import { addDays } from './timezones'
import { priceDrop, type PriceDrop, type WhatIfBooking } from './whatIf'

/**
 * Slice A of H8: booking and preparation, front end only (S2-02, S2-03, S2-04, S2-06, S2-08, S3-01, S3-13).
 * Pure. Everything is kept on the device; nothing here books, charges or sends.
 */

// ---- Short free hold (S2-03) ----
export const HOLD_HOURS = 48
export interface Hold { label: string; at: number }
export const HOLD_LABEL_MAX = 60
export type HoldState = { state: 'none' } | { state: 'active'; msLeft: number; until: number } | { state: 'lapsed'; since: number }

export function holdState(hold: Hold | null, now: number): HoldState {
  if (!hold) return { state: 'none' }
  const until = hold.at + HOLD_HOURS * 3_600_000
  return now < until ? { state: 'active', msLeft: until - now, until } : { state: 'lapsed', since: until }
}

/** "1 day 5 hours" / "5 hours 10 minutes" / "less than a minute": words, never a ticking clock. */
export function leftInWords(ms: number): string {
  const mins = Math.floor(ms / 60_000)
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60
  const part = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  if (d > 0) return h > 0 ? `${part(d, 'day')} ${part(h, 'hour')}` : part(d, 'day')
  if (h > 0) return m > 0 ? `${part(h, 'hour')} ${part(m, 'minute')}` : part(h, 'hour')
  return m > 0 ? part(m, 'minute') : 'less than a minute'
}

export const cleanHoldLabel = (v: string): string => v.replace(/\s+/g, ' ').trim().slice(0, HOLD_LABEL_MAX)

export function normalizeHold(raw: unknown): Hold | null {
  const o = (typeof raw === 'object' && raw !== null ? raw : null) as Record<string, unknown> | null
  if (!o || typeof o.label !== 'string' || typeof o.at !== 'number' || !Number.isFinite(o.at)) return null
  const label = cleanHoldLabel(o.label)
  return label === '' ? null : { label, at: o.at }
}

// ---- Accessibility-first profile (S2-06) ----
export const MOBILITY_DEVICES = ['none', 'cane', 'walker', 'wheelchair', 'scooter'] as const
export type MobilityDevice = (typeof MOBILITY_DEVICES)[number]
export const ACCESS_FLAGS = ['mobility', 'hearing', 'vision', 'sensory', 'serviceAnimal', 'companion'] as const
export type AccessFlag = (typeof ACCESS_FLAGS)[number]
export type AccessProfile = Record<AccessFlag, boolean> & { device: MobilityDevice }
export const EMPTY_ACCESS: AccessProfile = { mobility: false, hearing: false, vision: false, sensory: false, serviceAnimal: false, companion: false, device: 'none' }

export function normalizeAccess(raw: unknown): AccessProfile {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const out = { ...EMPTY_ACCESS }
  for (const f of ACCESS_FLAGS) out[f] = r[f] === true
  if (MOBILITY_DEVICES.some((d) => d === r.device)) out.device = r.device as MobilityDevice
  return out
}

/** The day-planner's mobility setting that fits the profile; the guest's own words in a question still win. */
export function assistantMobility(p: AccessProfile): 'any' | 'easy' | 'wheelchair' {
  if (p.device === 'wheelchair' || p.device === 'scooter') return 'wheelchair'
  return p.mobility || p.device !== 'none' ? 'easy' : 'any'
}

/** Whether the profile calls for a step-free stateroom (S2-06): any mobility need or device. */
export const needsStepFree = (p: AccessProfile): boolean => p.mobility || p.device !== 'none'

export const AREAS = ['cabin', 'dining', 'excursions', 'disembark'] as const
export type Area = (typeof AREAS)[number]

/** Which things each area should look out for, from the profile. An empty list means the profile asks nothing of that area. */
export function accessNotes(p: AccessProfile): Record<Area, string[]> {
  const wheels = p.device === 'wheelchair' || p.device === 'scooter'
  const out: Record<Area, string[]> = { cabin: [], dining: [], excursions: [], disembark: [] }
  if (p.mobility || p.device !== 'none') out.cabin.push('stepFree')
  if (wheels) out.cabin.push('wideDoor', 'rollIn')
  if (p.hearing) out.cabin.push('visualAlerts')
  if (p.serviceAnimal) out.cabin.push('relief')
  if (p.mobility || wheels || p.device === 'walker') out.dining.push('easyTable')
  if (p.vision) out.dining.push('readMenu')
  if (p.sensory) out.dining.push('quietTable')
  if (p.mobility || p.device !== 'none') out.excursions.push('gentle', 'seats')
  if (wheels) out.excursions.push('ramps')
  if (p.sensory) out.excursions.push('smallGroup')
  if (p.hearing) out.excursions.push('captions')
  if (p.serviceAnimal) out.excursions.push('animalRules')
  if (p.mobility || p.device !== 'none') out.disembark.push('assistedTender')
  if (p.vision || p.hearing || p.sensory) out.disembark.push('quietExit')
  if (p.companion) out.disembark.push('companionTogether')
  return out
}

// ---- Trip contract (S2-08) ----
export interface ContractInput {
  number: string
  name: string
  departure: string
  guests: number
  category: string
  plan: { total: Cents; deposit: Cents; balance: Cents; finalDue: string }
  balancePaid: boolean
  today: string
}

export interface ContractSection { id: 'booking' | 'paid' | 'notPaid' | 'rules' | 'deadlines' | 'contact'; lines: string[] }

/** One page: what was booked, what is paid and not, the rules that matter, the dates, and who to ask. */
export function tripContract(c: ContractInput): ContractSection[] {
  const paid = c.balancePaid ? c.plan.total : c.plan.deposit
  const owed = c.plan.total - paid
  return [
    { id: 'booking', lines: [`Booking ${c.number} for ${c.name}`, `${c.guests} ${c.guests === 1 ? 'guest' : 'guests'}, ${c.category}`, `Sailing ${c.departure}`, `Fare ${formatMoney(c.plan.total)}`] },
    { id: 'paid', lines: [`Paid ${formatMoney(paid)}`] },
    { id: 'notPaid', lines: owed > 0 ? [`Still to pay ${formatMoney(owed)}, due ${c.plan.finalDue}`] : ['Nothing is owed'] },
    { id: 'rules', lines: ['A cancellation keeps a fee that grows as sailing gets closer; see What happens if for the dollars on your dates.', 'A sailing change is free until the final payment date.', 'Rules are the concept rules of this app, not the cruise line’s real terms.'] },
    { id: 'deadlines', lines: [`Final payment ${c.plan.finalDue}`, `Fee-free changes end ${c.plan.finalDue}`, `Sailing ${c.departure}`] },
    { id: 'contact', lines: ['Ask Guest Services through Contact us in the app.'] },
  ]
}

export const contractText = (sections: readonly ContractSection[], heading: (id: ContractSection['id']) => string): string =>
  sections.map((s) => `${heading(s.id).toUpperCase()}\n${s.lines.map((l) => `- ${l}`).join('\n')}`).join('\n\n')

// ---- Per-person readiness (S3-01) ----
export interface PersonReadiness { percent: number; open: { id: string; due: string; papers: boolean }[] }

/**
 * One number per traveller, weighted by deadline with papers first.
 * Each item weighs more the earlier it is due (1 plus its days before sailing over 30); papers count double.
 * Items the app sees for the whole booking count for everyone; the papers item is that person's own.
 */
export function personReadiness(entries: readonly ChecklistEntry[], papersBlocking: number): PersonReadiness {
  let total = 0, done = 0
  const open: PersonReadiness['open'] = []
  for (const e of entries) {
    const papers = e.id === 'documents'
    const w = (1 + e.daysBefore / 30) * (papers ? 2 : 1)
    const ok = papers ? papersBlocking === 0 : e.state === 'done'
    total += w
    if (ok) done += w
    else open.push({ id: e.id, due: e.due, papers })
  }
  open.sort((a, b) => Number(b.papers) - Number(a.papers) || a.due.localeCompare(b.due))
  return { percent: total === 0 ? 100 : Math.round((done / total) * 100), open }
}

// ---- Allergy pre-flag (S3-13) ----
export const ALLERGY_MAX = 8
export const GALLEY_HOURS = 12
export interface AllergyFlag { items: string[]; at: number | null }
export const EMPTY_ALLERGY: AllergyFlag = { items: [], at: null }
export const cleanAllergy = (v: string): string => v.replace(/\s+/g, ' ').trim().slice(0, 40)

export function normalizeAllergy(raw: unknown): AllergyFlag {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const items: string[] = []
  for (const x of Array.isArray(r.items) ? r.items : []) {
    const s = typeof x === 'string' ? cleanAllergy(x) : ''
    if (s !== '' && items.length < ALLERGY_MAX && !items.some((i) => i.toLowerCase() === s.toLowerCase())) items.push(s)
  }
  return { items, at: items.length > 0 && typeof r.at === 'number' && Number.isFinite(r.at) ? r.at : null }
}

export type GalleyStatus = 'notSent' | 'noted' | 'acknowledged'
/** A simulated reply: noted at once, acknowledged by the galley after twelve hours. The screen says it is simulated. */
export function galleyStatus(flag: AllergyFlag, now: number): GalleyStatus {
  if (flag.items.length === 0 || flag.at === null) return 'notSent'
  return now - flag.at >= GALLEY_HOURS * 3_600_000 ? 'acknowledged' : 'noted'
}

// ---- Pay-your-share ledger (S2-04) ----
export interface Share { id: string; name: string; amount: Cents; paid: boolean }
export const SHARES_MAX = 12

export function normalizeShares(raw: unknown): Share[] {
  return (Array.isArray(raw) ? raw : []).flatMap((x): Share[] => {
    const o = x as Record<string, unknown> | null
    if (!o || typeof o.id !== 'string' || typeof o.name !== 'string' || o.name.trim() === '' || typeof o.amount !== 'number' || !Number.isFinite(o.amount)) return []
    return [{ id: o.id, name: o.name.replace(/\s+/g, ' ').trim().slice(0, 40), amount: Math.max(0, Math.min(100_000_000, Math.round(o.amount))), paid: o.paid === true }]
  }).slice(0, SHARES_MAX)
}

/** Splits a total in whole cents; the odd cents go to the first people so the shares add up exactly. */
export function splitEven(total: Cents, names: readonly string[]): { name: string; amount: Cents }[] {
  if (names.length === 0) return []
  const base = Math.floor(total / names.length), extra = total - base * names.length
  return names.map((name, i) => ({ name, amount: base + (i < extra ? 1 : 0) }))
}

export const ledgerSummary = (shares: readonly Share[]): { paid: Cents; owed: Cents; total: Cents } => {
  const paid = shares.filter((s) => s.paid).reduce((a, s) => a + s.amount, 0)
  const total = shares.reduce((a, s) => a + s.amount, 0)
  return { paid, owed: total - paid, total }
}

// ---- Price-drop watch (S2-02) ----
export interface FarePoint { date: string; total: Cents }

/** A simulated weekly fare for the same cabin since booking: a gentle wander around the booked fare, the same every time for the same booking. */
export function fareHistory(b: Pick<WhatIfBooking, 'plan' | 'today'>, number: string): FarePoint[] {
  let seed = 0
  for (const ch of number) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  const points: FarePoint[] = []
  let fare = b.plan.total
  for (let d = b.plan.booked, n = 0; d <= b.today && n < 26; d = addDays(d, 7), n++) {
    fare = Math.max(Math.round((b.plan.total * 0.7) / 100) * 100, Math.round((fare * (0.96 + next() * 0.09)) / 100) * 100)
    points.push({ date: d, total: n === 0 ? b.plan.total : fare })
  }
  return points
}

export interface PriceWatch { latest: FarePoint; lowest: FarePoint; drop: PriceDrop; steps: ('ask' | 'review' | 'confirm')[] }

export function priceWatch(b: WhatIfBooking, history: readonly FarePoint[]): PriceWatch | null {
  if (history.length === 0) return null
  const latest = history[history.length - 1]
  const lowest = history.reduce((m, p) => (p.total < m.total ? p : m))
  const drop = priceDrop(b, latest.total)
  return { latest, lowest, drop, steps: drop.ok ? ['ask', 'review', 'confirm'] : [] }
}
