import { parseMoney } from '../domain/money'

/**
 * Entitlement, spend and loyalty coach (docs/stanley-gap-analysis-and-plan.md, phase 12), device side. Every figure is worked out on the server from the services that hold it; nothing here adds, rounds,
 * compares or converts an amount. This module reads each answer defensively (anything that is not the agreed shape is dropped, never guessed), checks what the guest types before it is sent and keeps the
 * wording for an illustration honest. Framework-free, so it is tested in node.
 */
export const MONEY_ITEMS = ['drink', 'wifi', 'specialty', 'excursion', 'gratuity', 'laundry', 'priority'] as const
export type MoneyItem = (typeof MONEY_ITEMS)[number]
export const VERDICTS = ['included', 'partly', 'notIncluded', 'allUsed'] as const
export type Verdict = (typeof VERDICTS)[number]
export const PACE_STATES = ['noBudget', 'tooEarly', 'onTrack', 'near', 'over'] as const
export type PaceState = (typeof PACE_STATES)[number]
export const FOLIO_STATES = ['posted', 'pending', 'disputed', 'adjusted', 'refunded'] as const
export type FolioState = (typeof FOLIO_STATES)[number]
export const SCENARIO_STATES = ['noBudget', 'within', 'near', 'over'] as const
export type ScenarioState = (typeof SCENARIO_STATES)[number]
export const PACKAGE_VERDICTS = ['worth', 'notWorth', 'even', 'nobody'] as const
export type PackageVerdict = (typeof PACKAGE_VERDICTS)[number]

export const NOTE_MAX = 300
export const BUDGET_MAX = 100_000_000
export const PRICE_MAX = 500_000
export const SCENARIO_MAX = 5

export interface EntitlementAnswer { item: MoneyItem; traveller: string; verdict: Verdict; lines: string[]; basis: string; youPayCents: number | null }
export interface EntitlementResult { asOf: number; answers: EntitlementAnswer[]; note: string }

export interface ScenarioLine { kind: string; id: string; label: string; units: number; unitCents: number; totalCents: number; basis: string }
export interface Scenario {
  now: { packages: number; tours: number; dining: number }
  adds: ScenarioLine[]
  addedCents: number
  newTotalCents: number
  budgetCents: number | null
  leftCents: number | null
  state: ScenarioState
  lines: string[]
  notCounted: string[]
  illustrative: true
}

export interface Pace {
  state: PaceState
  budgetCents: number | null
  committedCents: number
  onboardCents: number
  pendingCents: number
  day: number
  nights: number
  projectedOnboardCents: number | null
  projectedTotalCents: number | null
  overCents: number | null
  lines: string[]
  illustrative: true
}

export interface FolioLineView { id: string; short: string; day: number; at: number; description: string; guest: string; category: string; cents: number; state: FolioState; why: string; caseReference: string | null }
export interface FolioGroup { state: FolioState; heading: string; meaning: string; cents: number; count: number; lines: FolioLineView[] }
export interface FolioExplain {
  asOf: number
  final: boolean
  throughDay: number
  postedCents: number
  pendingCents: number
  creditsCents: number
  coveredCents: number
  groups: FolioGroup[]
  estimate: { cents: number; text: string; illustrative: true } | null
  lines: string[]
}

export interface PackageRow { id: string; name: string; people: number; packageCents: number; payAsYouGoCents: number; differenceCents: number; verdict: PackageVerdict; basis: string; lines: string[] }
export interface PackageValue { asOf: number; rows: PackageRow[]; lines: string[]; illustrative: true }

export interface LoyaltyCredit { source: string; remainingCents: number; expiresOn: string; daysLeft: number; expired: boolean; expiresSoon: boolean }
export interface LoyaltyCoach {
  asOf: number
  tier: string
  days: number
  nextTier: string | null
  daysToNext: number | null
  counted: boolean
  credits: LoyaltyCredit[]
  usableCreditCents: number
  perks: string[]
  lines: string[]
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => list.find((x) => x === v) ?? null
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const strings = (v: unknown, max: number, each = 300): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, each)).slice(0, max) : [])
const list = <T,>(v: unknown, read: (x: unknown) => T | null, max: number): T[] => (Array.isArray(v) ? v.flatMap((x) => { const r = read(x); return r === null ? [] : [r] }).slice(0, max) : [])

// ---- entitlement ----

function readAnswer(raw: unknown): EntitlementAnswer | null {
  const o = obj(raw)
  const item = o ? oneOf(MONEY_ITEMS, o.item) : null
  const verdict = o ? oneOf(VERDICTS, o.verdict) : null
  if (!o || !item || !verdict) return null
  return { item, traveller: text(o.traveller, 40), verdict, lines: strings(o.lines, 6), basis: text(o.basis, 200), youPayCents: numOrNull(o.youPayCents) }
}

export function normalizeEntitlement(raw: unknown): EntitlementResult | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.answers)) return null
  return { asOf: num(o.asOf), answers: list(o.answers, readAnswer, 12), note: text(o.note, 400) }
}

/** The request for "is this included for me?", or null while what was typed cannot be sent. A price is dollars as typed; the server checks it again. */
export function entitlementRequest(item: MoneyItem, traveller: string, everyone: boolean, priceText: string, alcohol: boolean, sailingId: string): Record<string, unknown> | null {
  const priceTyped = priceText.trim() !== ''
  const price = priceTyped ? parseMoney(priceText) : null
  if (priceTyped && (price === null || price <= 0 || price > PRICE_MAX)) return null
  const body: Record<string, unknown> = { item, sailingId }
  if (everyone) body.everyone = true
  else if (traveller) body.traveller = traveller
  if (item === 'drink') { body.alcohol = alcohol; if (price !== null) body.priceCents = price }
  return body
}

export const priceTextIsValid = (priceText: string): boolean => priceText.trim() === '' || ((): boolean => { const c = parseMoney(priceText); return c !== null && c > 0 && c <= PRICE_MAX })()

// ---- the spend scenario ----

export function normalizeScenario(raw: unknown): Scenario | null {
  const o = obj(raw)
  const now = o ? obj(o.now) : null
  const state = o ? oneOf(SCENARIO_STATES, o.state) : null
  if (!o || !now || !state || !Array.isArray(o.adds)) return null
  const adds = list(o.adds, (x) => {
    const a = obj(x)
    return a && text(a.id, 60) ? { kind: text(a.kind, 20), id: text(a.id, 60), label: text(a.label, 80), units: num(a.units), unitCents: num(a.unitCents), totalCents: num(a.totalCents), basis: text(a.basis, 200) } : null
  }, SCENARIO_MAX)
  return {
    now: { packages: num(now.packages), tours: num(now.tours), dining: num(now.dining) }, adds, addedCents: num(o.addedCents), newTotalCents: num(o.newTotalCents),
    budgetCents: numOrNull(o.budgetCents), leftCents: numOrNull(o.leftCents), state, lines: strings(o.lines, 12), notCounted: strings(o.notCounted, 6), illustrative: true,
  }
}

export interface ScenarioPick { kind: 'addOn' | 'upgrade'; id: string }

/** The request for "if we book this": one to five distinct picks. */
export function scenarioRequest(picks: readonly ScenarioPick[], sailingId: string): Record<string, unknown> | null {
  const seen = new Set<string>()
  const items = picks.filter((p) => { const k = `${p.kind}:${p.id}`; if (seen.has(k) || !p.id) return false; seen.add(k); return true }).slice(0, SCENARIO_MAX)
  return items.length === 0 ? null : { sailingId, items: items.map((p) => ({ kind: p.kind, id: p.id })) }
}

// ---- budget and pace ----

/** The budget typed by the guest, in cents; null when empty or not an amount, or too large to be sensible. */
export function budgetFromText(textValue: string): number | null {
  const c = parseMoney(textValue)
  return c !== null && c > 0 && c <= BUDGET_MAX ? c : null
}

export function normalizeBudget(raw: unknown): number | null {
  const o = obj(raw)
  const c = o ? numOrNull(o.cents) : null
  return c !== null && c > 0 && c <= BUDGET_MAX ? c : null
}

export function normalizePace(raw: unknown): Pace | null {
  const o = obj(raw)
  const state = o ? oneOf(PACE_STATES, o.state) : null
  if (!o || !state) return null
  return {
    state, budgetCents: numOrNull(o.budgetCents), committedCents: num(o.committedCents), onboardCents: num(o.onboardCents), pendingCents: num(o.pendingCents), day: num(o.day), nights: num(o.nights),
    projectedOnboardCents: numOrNull(o.projectedOnboardCents), projectedTotalCents: numOrNull(o.projectedTotalCents), overCents: numOrNull(o.overCents), lines: strings(o.lines, 8), illustrative: true,
  }
}

// ---- the folio explainer ----

function readFolioLine(raw: unknown): FolioLineView | null {
  const o = obj(raw)
  const state = o ? oneOf(FOLIO_STATES, o.state) : null
  if (!o || !state || !text(o.id, 120)) return null
  return {
    id: text(o.id, 120), short: text(o.short, 20), day: num(o.day), at: num(o.at), description: text(o.description, 120), guest: text(o.guest, 40), category: text(o.category, 20), cents: num(o.cents), state,
    why: text(o.why, 200), caseReference: typeof o.caseReference === 'string' && o.caseReference ? text(o.caseReference, 20) : null,
  }
}

function readFolioGroup(raw: unknown): FolioGroup | null {
  const o = obj(raw)
  const state = o ? oneOf(FOLIO_STATES, o.state) : null
  if (!o || !state) return null
  return { state, heading: text(o.heading, 40), meaning: text(o.meaning, 200), cents: num(o.cents), count: num(o.count), lines: list(o.lines, readFolioLine, 400) }
}

export function normalizeFolio(raw: unknown): FolioExplain | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.groups)) return null
  const est = obj(o.estimate)
  return {
    asOf: num(o.asOf), final: o.final === true, throughDay: num(o.throughDay), postedCents: num(o.postedCents), pendingCents: num(o.pendingCents), creditsCents: num(o.creditsCents), coveredCents: num(o.coveredCents),
    groups: list(o.groups, readFolioGroup, 5), estimate: est ? { cents: num(est.cents), text: text(est.text, 300), illustrative: true } : null, lines: strings(o.lines, 8),
  }
}

/** A line can be questioned only while it is a charge no one has questioned yet; credits and lines with a case already open cannot. */
export const canQuestion = (l: FolioLineView): boolean => l.cents > 0 && l.caseReference === null && l.state !== 'refunded'

export interface DisputeInput { consent: boolean; note: string }
export const disputeReady = (i: DisputeInput): boolean => i.consent && i.note.length <= NOTE_MAX

export function disputeRequest(line: FolioLineView, i: DisputeInput, sailingId: string): { lineId: string; note: string; consent: true; sailingId: string } | null {
  return canQuestion(line) && disputeReady(i) ? { lineId: line.id, note: i.note.trim(), consent: true, sailingId } : null
}

// ---- package value ----

function readPackageRow(raw: unknown): PackageRow | null {
  const o = obj(raw)
  const verdict = o ? oneOf(PACKAGE_VERDICTS, o.verdict) : null
  if (!o || !verdict || !text(o.id, 40)) return null
  return {
    id: text(o.id, 40), name: text(o.name, 60), people: num(o.people), packageCents: num(o.packageCents), payAsYouGoCents: num(o.payAsYouGoCents), differenceCents: num(o.differenceCents), verdict, basis: text(o.basis, 200), lines: strings(o.lines, 4),
  }
}

export function normalizePackageValue(raw: unknown): PackageValue | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.rows)) return null
  return { asOf: num(o.asOf), rows: list(o.rows, readPackageRow, 5), lines: strings(o.lines, 8), illustrative: true }
}

/** Whole numbers inside a range, or null. The guest chooses their own use; nothing is filled in for them. */
export function usageCount(value: string, max: number): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null
  const n = Number(value)
  return n >= 0 && n <= max ? n : null
}

export const USE_LIMITS = { drinksPerDay: 12, wifiDays: 30, specialtyDinners: 10 } as const

export function packageUseRequest(drinks: string, wifi: string, dinners: string, sailingId: string): { drinksPerDay: number; wifiDays: number; specialtyDinners: number; sailingId: string } | null {
  const d = usageCount(drinks, USE_LIMITS.drinksPerDay)
  const w = usageCount(wifi, USE_LIMITS.wifiDays)
  const s = usageCount(dinners, USE_LIMITS.specialtyDinners)
  return d === null || w === null || s === null ? null : { drinksPerDay: d, wifiDays: w, specialtyDinners: s, sailingId }
}

// ---- Captain's Circle ----

export function normalizeLoyalty(raw: unknown): LoyaltyCoach | null {
  const o = obj(raw)
  if (!o || !text(o.tier, 20)) return null
  const credits = list(o.credits, (x) => {
    const c = obj(x)
    return c && text(c.source, 80) ? { source: text(c.source, 80), remainingCents: num(c.remainingCents), expiresOn: text(c.expiresOn, 10), daysLeft: num(c.daysLeft), expired: c.expired === true, expiresSoon: c.expiresSoon === true } : null
  }, 20)
  return {
    asOf: num(o.asOf), tier: text(o.tier, 20), days: num(o.days), nextTier: typeof o.nextTier === 'string' ? text(o.nextTier, 20) : null, daysToNext: numOrNull(o.daysToNext), counted: o.counted === true,
    credits, usableCreditCents: num(o.usableCreditCents), perks: strings(o.perks, 10, 40), lines: strings(o.lines, 12),
  }
}

// ---- tone ----

/** Which tag a verdict gets: a plain yes is good, anything that costs the guest something is a warning, and a partly is neutral. */
export const verdictTone = (v: Verdict): 'good' | 'warn' | 'neutral' => (v === 'included' ? 'good' : v === 'partly' ? 'neutral' : 'warn')
