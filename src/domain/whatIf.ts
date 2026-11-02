import { buildIcsCalendar } from './calendar'
import { cancelTerms, changeCheck, CANCEL_ROWS, FREE_CANCEL_HOURS, type CancelTier, type ChangeCheck } from './policy'
import { formatMoney, type Cents } from './money'
import { addDays } from './timezones'
import { daysBetween, type PaymentPlan } from './trip'

/**
 * The "what happens if" simulator (S2-01) and the payment schedule and calendar (S2-05).
 * Pure. It asks the same rules the cancel and change screens use (`policy.ts`) and shows dollars and dates, not policy text.
 * Concept rules, not Princess's terms. Nothing here cancels, changes or charges anything.
 */
export interface WhatIfBooking {
  plan: PaymentPlan
  guests: number
  /** Today, "YYYY-MM-DD" (ship home time). */
  today: string
  departure: string
  balancePaid: boolean
  /** Days before sailing when the final payment falls due. */
  finalDays: number
}

const daysLeft = (b: WhatIfBooking, on: string): number => daysBetween(on, b.departure)

/** What has been paid by `on`, if the guest keeps to the schedule: the deposit, and everything once the final date has passed. */
export const paidBy = (b: WhatIfBooking, on: string): Cents => (b.balancePaid || on >= b.plan.finalDue ? b.plan.total : b.plan.deposit)

export interface CancelOutcome { on: string; daysBefore: number; tier: CancelTier; fee: Cents; refund: Cents; paid: Cents }

/** Cancel the whole booking on a date (today or later). */
export function cancelOn(b: WhatIfBooking, on: string): CancelOutcome {
  const daysBefore = Math.max(0, daysLeft(b, on))
  const paid = paidBy(b, on)
  const t = cancelTerms({ total: b.plan.total, paid, deposit: b.plan.deposit, daysToDeparture: daysBefore, hoursSinceBooking: 24 * 365 })
  return { on, daysBefore, ...t, paid }
}

/** One traveller cannot go: their share of the fare is cancelled by the same rules and the rest of the party sails. */
export function oneCannotGo(b: WhatIfBooking, on: string): (CancelOutcome & { share: Cents; remaining: number }) | null {
  if (b.guests < 2) return null
  const share = Math.round(b.plan.total / b.guests / 100) * 100
  const deposit = Math.round(share * (b.plan.deposit / Math.max(1, b.plan.total)) / 100) * 100
  const daysBefore = Math.max(0, daysLeft(b, on))
  const paid = Math.min(share, paidBy(b, on) === b.plan.total ? share : deposit)
  const t = cancelTerms({ total: share, paid, deposit, daysToDeparture: daysBefore, hoursSinceBooking: 24 * 365 })
  return { on, daysBefore, ...t, paid, share, remaining: b.guests - 1 }
}

export type PriceDrop = { ok: true; saving: Cents; newTotal: Cents } | { ok: false; reason: 'notLower' | 'afterFinal' }

/** A lower fare on the same cabin: allowed up to the final payment date (concept rule); after it the fare is fixed. */
export function priceDrop(b: WhatIfBooking, newTotal: Cents): PriceDrop {
  if (newTotal >= b.plan.total) return { ok: false, reason: 'notLower' }
  if (b.today > b.plan.finalDue) return { ok: false, reason: 'afterFinal' }
  return { ok: true, saving: b.plan.total - newTotal, newTotal }
}

/** Move to a different sailing: free until the final payment date; the new date must also be outside it. */
export const moveCheck = (b: WhatIfBooking, newDeparture: string): ChangeCheck =>
  changeCheck(daysLeft(b, b.today), daysBetween(b.today, newDeparture), newDeparture === b.departure, b.finalDays)

export interface Threshold { from: string; tier: CancelTier; fee: Cents; refund: Cents }

/** The dates the cost of cancelling steps up, with the dollars at each, from today to sailing. */
export function cancelSteps(b: WhatIfBooking): Threshold[] {
  const dates = [b.today, ...CANCEL_ROWS.filter((r) => r.max !== null).map((r) => addDays(b.departure, -(r.max as number)))]
  const seen = new Set<string>()
  const out: Threshold[] = []
  for (const from of dates.filter((d) => d >= b.today && d <= b.departure).sort()) {
    const o = cancelOn(b, from)
    const key = `${o.tier}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ from, tier: o.tier, fee: o.fee, refund: o.refund })
  }
  return out
}

export const freeWindowNote = (): string => `A booking made less than ${FREE_CANCEL_HOURS} hours ago, with sailing at least a week away, can be cancelled with no fee.`

// ---- Payment schedule (S2-05) ----

export type InstalmentState = 'paid' | 'due' | 'overdue' | 'later'
export interface Instalment { id: 'deposit' | 'balance'; due: string; amount: Cents; state: InstalmentState }

export function paymentSchedule(b: WhatIfBooking): Instalment[] {
  const { plan } = b
  const deposit: Instalment = { id: 'deposit', due: plan.booked, amount: plan.deposit, state: 'paid' }
  if (plan.balance === 0) return [deposit]
  const state: InstalmentState = b.balancePaid ? 'paid' : b.today > plan.finalDue ? 'overdue' : daysBetween(b.today, plan.finalDue) <= 30 ? 'due' : 'later'
  return [deposit, { id: 'balance', due: plan.finalDue, amount: plan.balance, state }]
}

/** What happens if the final payment is missed, in dollars: the booking can be cancelled and the fee for that date applies. */
export function ifMissed(b: WhatIfBooking): string {
  const o = cancelOn({ ...b, balancePaid: false }, addDays(b.plan.finalDue, 1))
  return `If the balance of ${formatMoney(b.plan.balance)} is not paid by ${b.plan.finalDue}, the cabin can be released. A cancellation then keeps ${formatMoney(o.fee)} and returns ${formatMoney(o.refund)} of what you paid. Guest Services can help before that date.`
}

/** A calendar file with a reminder a week before, and on the day, for each instalment still to pay. */
export function paymentCalendar(b: WhatIfBooking, number: string, stamp: number): string {
  const rows = paymentSchedule(b).filter((i) => i.state !== 'paid')
  const events = rows.flatMap((i) => [7, 0].map((before) => {
    const date = addDays(i.due, -before)
    return { uid: `${number}-${i.id}-${before}@princess.concept`, summary: before ? `Payment due in a week: ${formatMoney(i.amount)}` : `Payment due today: ${formatMoney(i.amount)}`, description: `Booking ${number}. ${formatMoney(i.amount)} due ${i.due}.`, location: '', start: date, end: date, stamp }
  })).filter((e) => e.start >= b.today)
  return buildIcsCalendar(events)
}
