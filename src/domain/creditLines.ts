import type { Cents } from './money'

/**
 * Credits at booking (BOK-12): each credit shows where it came from, its amount, whether it can be used on this booking and what is left afterwards.
 * An unusable credit says why. Only future cruise credit exists today; other sources add a line here.
 */
export type CreditSource = 'futureCruise'
export type CreditWhy = 'none' | 'notChosen' | 'minimumPaid'

export interface CreditLine {
  source: CreditSource
  /** What the guest holds. */
  amount: Cents
  /** What this booking uses. */
  applied: Cents
  /** What stays for later. */
  residual: Cents
  eligible: boolean
  /** Why it is not (fully) used, when it is not. */
  why: CreditWhy
}

/** `applied` is what the quote used and `chosen` whether the guest ticked the credit. A ticked credit that the quote could not use (or only part of) is explained as the part of each booking that must be paid by card. */
export function creditLine(held: Cents, applied: Cents, chosen: boolean): CreditLine | null {
  if (held <= 0) return null
  const used = chosen ? applied : 0
  const why: CreditWhy = !chosen ? 'notChosen' : used < held ? 'minimumPaid' : 'none'
  return { source: 'futureCruise', amount: held, applied: used, residual: held - used, eligible: !chosen || used > 0, why }
}
