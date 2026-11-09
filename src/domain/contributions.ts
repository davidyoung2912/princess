/**
 * Invited payers (BOK-10): a booking's total split among the people invited to pay, each with an amount and a deadline. The organiser sees who has paid, who is
 * pending and whose payment failed; a payer sees only their own amount and deadline. No card details are kept or shown here, and nothing here charges anyone.
 */
export type ContributionStatus = 'pending' | 'paid' | 'failed'
export const STATUSES: readonly ContributionStatus[] = ['pending', 'paid', 'failed']

export interface Contribution { payer: string; name: string; cents: number; status: ContributionStatus }
export interface ContributionPlan { totalCents: number; due: string; rows: Contribution[] }

export const PAYERS_MAX = 8

/** Splits the total equally. The leftover cents go to the first payers, so the amounts always add up. */
export function planContributions(totalCents: number, payers: readonly { id: string; name: string }[], due: string): ContributionPlan | null {
  if (!Number.isInteger(totalCents) || totalCents <= 0 || payers.length < 2 || payers.length > PAYERS_MAX || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return null
  const base = Math.floor(totalCents / payers.length)
  let left = totalCents - base * payers.length
  const rows = payers.map((p): Contribution => ({ payer: p.id, name: p.name.slice(0, 40), cents: base + (left-- > 0 ? 1 : 0), status: 'pending' }))
  return { totalCents, due, rows }
}

export function setStatus(plan: ContributionPlan, payer: string, status: ContributionStatus): ContributionPlan {
  return { ...plan, rows: plan.rows.map((r) => (r.payer === payer ? { ...r, status } : r)) }
}

/** What one payer sees: their own row only. */
export const payerView = (plan: ContributionPlan, who: string): (Contribution & { due: string }) | null => {
  const r = plan.rows.find((x) => x.payer === who)
  return r ? { ...r, due: plan.due } : null
}

export function summary(plan: ContributionPlan): { paid: number; pending: number; failed: number; paidCents: number; leftCents: number } {
  const count = (s: ContributionStatus) => plan.rows.filter((r) => r.status === s).length
  const paidCents = plan.rows.filter((r) => r.status === 'paid').reduce((a, r) => a + r.cents, 0)
  return { paid: count('paid'), pending: count('pending'), failed: count('failed'), paidCents, leftCents: plan.totalCents - paidCents }
}

export function normalizeContributions(raw: unknown): ContributionPlan | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.totalCents !== 'number' || !Number.isInteger(o.totalCents) || o.totalCents <= 0 || typeof o.due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.due) || !Array.isArray(o.rows)) return null
  const rows = o.rows.flatMap((x): Contribution[] => {
    const r = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>
    return typeof r.payer === 'string' && typeof r.name === 'string' && typeof r.cents === 'number' && Number.isInteger(r.cents) && r.cents > 0
      ? [{ payer: r.payer, name: r.name.slice(0, 40), cents: r.cents, status: STATUSES.includes(r.status as ContributionStatus) ? (r.status as ContributionStatus) : 'pending' }]
      : []
  }).slice(0, PAYERS_MAX)
  return rows.length >= 2 ? { totalCents: o.totalCents, due: o.due, rows } : null
}
