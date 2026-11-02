import type { Cents } from './money'
import { BAR_SERVICE_RATE, type FolioLine } from './folio'
import { spentBy } from './budget'

/**
 * The money shield (Phase H1): plain explanations of every charge, where the money goes, a check before an optional charge,
 * a pace coach that informs and never scolds, and the promise that nothing renews by itself.
 */

// ---- Explain this charge (XT-02, S7-05) ----

export type ExplainId =
  | 'credit' | 'gratuity' | 'gratuityCovered' | 'barService' | 'cover' | 'dinnerCovered'
  | 'drink' | 'drinkCovered' | 'drinkOverCap' | 'wifi' | 'wifiCovered' | 'spa' | 'shop' | 'photo' | 'laundry' | 'excursion' | 'dining' | 'other'

export interface Explanation { id: ExplainId; params: Record<string, string | number> }

/** Why this line is on the account, in terms of an `explain.<id>` string. The same line always gives the same answer. */
export function explainCharge(l: FolioLine): Explanation {
  const params: Record<string, string | number> = { rate: Math.round(BAR_SERVICE_RATE * 100) }
  if (l.category === 'credit' || l.cents < 0) return { id: 'credit', params }
  if (l.category === 'gratuities') return { id: l.coveredBy ? 'gratuityCovered' : 'gratuity', params }
  if (l.category === 'tips') return { id: 'barService', params }
  if (l.category === 'dining') return { id: l.coveredBy ? 'dinnerCovered' : l.description.startsWith('Cover charge') ? 'cover' : 'dining', params }
  if (l.category === 'drinks') {
    if (l.coveredBy && l.cents === 0) return { id: 'drinkCovered', params }
    if (l.coveredBy) return { id: 'drinkOverCap', params: { ...params, cap: Math.max(0, (l.value ?? 0) - l.cents) / 100 } }
    return { id: 'drink', params }
  }
  if (l.category === 'internet') return { id: l.coveredBy ? 'wifiCovered' : 'wifi', params }
  const plain = { spa: 'spa', shops: 'shop', photos: 'photo', laundry: 'laundry', excursions: 'excursion' } as const
  return { id: plain[l.category as keyof typeof plain] ?? 'other', params }
}

/** Whether a line can be questioned: only something actually charged to the account. */
export const canQuestion = (l: FolioLine): boolean => l.cents > 0

export type FeeId = 'gratuities' | 'service' | 'cover' | 'purchases'
export interface FeeRow { id: FeeId; cents: Cents; percent: number }

/** Where the charged money went: nightly gratuities, bar service charges, cover charges, and everything the guest bought. Covered items and credits are not charged, so they are not here. */
export function feeLedger(lines: readonly FolioLine[]): { rows: FeeRow[]; total: Cents } {
  const charged = lines.filter((l) => l.cents > 0)
  const sum = (f: (l: FolioLine) => boolean) => charged.filter(f).reduce((n, l) => n + l.cents, 0)
  const parts: [FeeId, Cents][] = [
    ['gratuities', sum((l) => l.category === 'gratuities')],
    ['service', sum((l) => l.category === 'tips')],
    ['cover', sum((l) => l.category === 'dining' && l.description.startsWith('Cover charge'))],
  ]
  const fees = parts.reduce((n, [, c]) => n + c, 0)
  const total = charged.reduce((n, l) => n + l.cents, 0)
  parts.push(['purchases', total - fees])
  return { rows: parts.map(([id, cents]) => ({ id, cents, percent: total === 0 ? 0 : Math.round((cents / total) * 100) })), total }
}

// ---- Check before an optional charge (XT-03) ----

export type ChargeCheck = 'never' | 'over25' | 'over50' | 'over100' | 'always'
export const CHARGE_CHECKS: readonly ChargeCheck[] = ['never', 'over25', 'over50', 'over100', 'always']
export const DEFAULT_CHARGE_CHECK: ChargeCheck = 'over50'

export const isChargeCheck = (v: unknown): v is ChargeCheck => CHARGE_CHECKS.includes(v as ChargeCheck)

const LIMIT: Record<ChargeCheck, Cents | null> = { never: null, over25: 2500, over50: 5000, over100: 10000, always: 0 }

/** Whether an optional charge needs the guest's say-so first. Safety, a required payment and zero-dollar items never do. */
export function needsConfirm(cents: Cents, check: ChargeCheck): boolean {
  const limit = LIMIT[check]
  return limit !== null && cents > 0 && cents > limit
}

// ---- Pace coach (S6-06) ----

export type Pace = 'notYet' | 'noBudget' | 'onTrack' | 'close' | 'above'

export interface SpendCoach {
  pace: Pace
  spent: Cents
  /** Whole days of the cruise counted, at least 1 once it has begun. */
  days: number
  perDay: Cents
  /** A straight-line forecast to the last night. */
  forecast: Cents
  /** The budget, when set. */
  limit: Cents | null
  /** Value of what packages and the fare have covered so far. */
  covered: Cents
  /** Drinks the package covered on the latest day. */
  drinksToday: number
}

export const CRUISE_NIGHTS = 7

/** Where spending stands. A straight line from the days so far; informational, and the wording is tested to be free of blame. */
export function spendCoach(lines: readonly FolioLine[], throughDay: number, limit: Cents | null): SpendCoach {
  const spent = spentBy(lines)
  const covered = lines.filter((l) => l.coveredBy).reduce((n, l) => n + ((l.value ?? 0) - l.cents), 0)
  const days = Math.max(0, Math.min(throughDay, CRUISE_NIGHTS))
  const today = lines.filter((l) => l.day === Math.min(throughDay, CRUISE_NIGHTS) && l.category === 'drinks' && l.coveredBy === 'package').length
  if (days === 0) return { pace: 'notYet', spent, days, perDay: 0, forecast: 0, limit, covered, drinksToday: 0 }
  const perDay = Math.round(spent / days)
  const forecast = perDay * CRUISE_NIGHTS
  const pace: Pace = limit === null ? 'noBudget' : forecast > limit ? 'above' : forecast >= limit * 0.9 ? 'close' : 'onTrack'
  return { pace, spent, days, perDay, forecast, limit, covered, drinksToday: today }
}

/** The most package drinks a day for a drink cap, or null when there is no limit or no drinks package (authored concept values). */
export const drinkLimitPerDay = (drinkCapUsd: number): number | null => (drinkCapUsd > 0 && drinkCapUsd <= 15 ? 15 : null)

// ---- Nothing renews by itself (XT-06) ----

export interface Recurring { recurring?: boolean; nextChargeOn?: string; cents?: Cents }

/** An auto-renewing item may only exist with a dated notice and a one-tap cancel. Nothing in the app renews today, so this returns null for everything we sell. */
export function renewalNotice(item: Recurring): { date: string; cents: Cents } | null {
  if (!item.recurring) return null
  if (!item.nextChargeOn || typeof item.cents !== 'number') throw new Error('A renewing item needs a charge date and an amount')
  return { date: item.nextChargeOn, cents: item.cents }
}
