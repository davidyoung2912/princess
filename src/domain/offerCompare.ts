import type { Cents } from './money'
import { formatMoney } from './money'

/** One offer as the guest reads it off an advert: a percentage off the fare, money off, or onboard credit. */
export type DealKind = 'percent' | 'off' | 'credit'

export interface Deal {
  kind: DealKind
  /** Percent (0 to 100) for `percent`; cents for the other two. */
  amount: number
}

/** What an offer is worth in money, against a fare total. Onboard credit is only worth what the guest would spend anyway, so it is capped at `willSpend`. */
export function dealValue(d: Deal, fare: Cents, willSpend: Cents): Cents {
  if (!Number.isFinite(d.amount) || d.amount <= 0) return 0
  if (d.kind === 'percent') return Math.round((fare * Math.min(d.amount, 100)) / 100)
  if (d.kind === 'off') return Math.min(Math.round(d.amount), fare)
  return Math.min(Math.round(d.amount), Math.max(0, willSpend))
}

export interface DealCompare {
  a: Cents
  b: Cents
  /** Which is worth more, or a tie. */
  better: 'a' | 'b' | 'tie'
  /** The gap in money, always zero or more. */
  gap: Cents
  /** Money off the fare for each guest. */
  gapPerPerson: Cents
  /** Fare total after each offer, counting credit as money off only where it will be spent. */
  netA: Cents
  netB: Cents
  /** True when a credit is worth less than its face value because the guest would not spend it all. */
  creditTrimmed: boolean
}

export function compareDeals(a: Deal, b: Deal, fare: Cents, guests: number, willSpend: Cents): DealCompare {
  const va = dealValue(a, fare, willSpend)
  const vb = dealValue(b, fare, willSpend)
  const gap = Math.abs(va - vb)
  const trimmed = (d: Deal) => d.kind === 'credit' && d.amount > Math.max(0, willSpend)
  return {
    a: va, b: vb, gap,
    better: va === vb ? 'tie' : va > vb ? 'a' : 'b',
    gapPerPerson: Math.round(gap / Math.max(1, guests)),
    netA: fare - va, netB: fare - vb,
    creditTrimmed: trimmed(a) || trimmed(b),
  }
}

/** One plain sentence for the result. */
export function dealVerdict(c: DealCompare, guests: number): string {
  if (c.better === 'tie') return 'The two offers are worth the same to you.'
  const who = c.better === 'a' ? 'Offer A' : 'Offer B'
  const each = guests > 1 ? ` (${formatMoney(c.gapPerPerson)} each)` : ''
  return `${who} is worth ${formatMoney(c.gap)} more to you${each}.`
}
