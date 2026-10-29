import type { Cents } from './pricing'
import { DEFAULT_FINAL_PAYMENT_DAYS } from './trip'

/** Cancellation and change rules (BOK-08), and the legal documents a guest accepts (BOK-19). All authored concept content, not Princess's terms. */
export type CancelTier = 'free24h' | 'early' | 'mid' | 'late' | 'final'

export interface CancelRow {
  tier: Exclude<CancelTier, 'free24h'>
  /** Days before sailing, inclusive; `max` is null for "more than". */
  min: number
  max: number | null
  /** The share of the total kept as a fee, or 'deposit' for the deposit only. */
  share: number | 'deposit'
}

export const CANCEL_ROWS: readonly CancelRow[] = [
  { tier: 'early', min: 91, max: null, share: 'deposit' },
  { tier: 'mid', min: 46, max: 90, share: 0.5 },
  { tier: 'late', min: 15, max: 45, share: 0.75 },
  { tier: 'final', min: 0, max: 14, share: 1 },
]

/** Free cancellation for a day after booking, if sailing is at least this many days away. */
export const FREE_CANCEL_HOURS = 24
export const FREE_CANCEL_MIN_DAYS = 7

export interface CancelInput {
  total: Cents
  /** What has been paid so far. */
  paid: Cents
  /** The deposit amount (a fifth of the total), the fee for cancelling early. */
  deposit: Cents
  daysToDeparture: number
  hoursSinceBooking: number
}

export interface CancelTerms {
  tier: CancelTier
  fee: Cents
  refund: Cents
}

export function cancelTerms(i: CancelInput): CancelTerms {
  if (i.hoursSinceBooking < FREE_CANCEL_HOURS && i.daysToDeparture >= FREE_CANCEL_MIN_DAYS) return { tier: 'free24h', fee: 0, refund: i.paid }
  const row = CANCEL_ROWS.find((r) => i.daysToDeparture >= r.min && (r.max === null || i.daysToDeparture <= r.max)) ?? CANCEL_ROWS[CANCEL_ROWS.length - 1]
  const fee = Math.min(i.total, row.share === 'deposit' ? i.deposit : Math.round((i.total * row.share) / 100) * 100)
  return { tier: row.tier, fee, refund: Math.max(0, i.paid - fee) }
}

export type ChangeCheck = 'ok' | 'tooLate' | 'newTooSoon' | 'same'

/** A date change is free until the final payment date; the new date must also be outside it, so the payment schedule stays simple. Anything else goes through Guest Services. */
export function changeCheck(daysToDeparture: number, newDaysToDeparture: number, sameSailing: boolean, finalDays: number = DEFAULT_FINAL_PAYMENT_DAYS): ChangeCheck {
  if (sameSailing) return 'same'
  if (daysToDeparture <= finalDays) return 'tooLate'
  return newDaysToDeparture > finalDays ? 'ok' : 'newTooSoon'
}

export type LegalId = 'terms' | 'health' | 'age' | 'pregnancy'
export const LEGAL_IDS: readonly LegalId[] = ['terms', 'health', 'age', 'pregnancy']

export interface LegalDoc {
  id: LegalId
  /** Changes when the text changes, and is recorded with each acceptance. */
  version: string
  title: string
  /** The line the guest agrees to. */
  statement: string
  body: readonly string[]
}

export const LEGAL: readonly LegalDoc[] = [
  {
    id: 'terms', version: '2026-10', title: 'Booking terms and ticket contract',
    statement: 'I have read the booking terms and ticket contract, and I accept them for everyone on this booking.',
    body: [
      'This is concept text for a demonstration, not a real contract.',
      'The cruise fare, taxes and fees, and any package are due as shown at booking. A deposit holds the stateroom; the balance is due 90 days before sailing.',
      'Itineraries, ports and times can change for weather, safety or operational reasons. When they do, we will tell you as soon as we can.',
      'The cancellation and change terms shown before payment are part of this contract.',
    ],
  },
  {
    id: 'health', version: '2026-10', title: 'Health requirements',
    statement: 'I understand the health requirements, and I will tell Guest Services if anyone on this booking is unwell before sailing.',
    body: [
      'Guests who have symptoms of an infectious illness before boarding may be asked to see the medical team, and may be refused boarding.',
      'You must tell us about any medical equipment, such as oxygen or a CPAP machine, so we can plan for it. Bring enough of any medicine you take, in its original packaging.',
      'Medical care on board is available, but it is not a hospital. Travel insurance that covers medical care and evacuation is strongly recommended.',
    ],
  },
  {
    id: 'age', version: '2026-10', title: 'Minimum age',
    statement: 'I confirm that every guest meets the minimum age, and that at least one guest in each stateroom is 21 or older on the day of sailing.',
    body: [
      'Babies must be at least 6 months old on the first day of the cruise.',
      'At least one guest in each stateroom must be 21 or older on the day of sailing. Guests under 18 must sail with an adult.',
      'You will need to show proof of age for every guest at check-in.',
    ],
  },
  {
    id: 'pregnancy', version: '2026-10', title: 'Pregnancy policy',
    statement: 'I understand the pregnancy policy.',
    body: [
      'A guest who will be 24 weeks pregnant or more at any time during the cruise cannot sail.',
      'A guest who is pregnant must bring a note from their doctor that says they are fit to travel and gives the due date.',
      'If you cannot sail because of this policy, tell us before you travel and ask Guest Services about your options.',
    ],
  },
]

export const legalById = (id: unknown): LegalDoc | undefined => LEGAL.find((l) => l.id === id)

export interface Acceptance { id: LegalId; version: string; at: number }

/** The log written when someone books: one entry per document, with the version they were shown. */
export const acceptanceLog = (accepted: Partial<Record<LegalId, boolean>>, at: number): Acceptance[] =>
  LEGAL.filter((l) => accepted[l.id] === true).map((l) => ({ id: l.id, version: l.version, at }))
