import { statusOf, DEFAULT_ALERT, type BudgetStatus } from './budget'
import type { Cents } from './money'

/** The on-board spend forecast (N-P2): what is bought or planned before sailing, by category, against the guest's trip budget (the trip-cost page covers the estimate). Words and numbers, never a block. */
export type SpendCategory = 'packages' | 'upgrades' | 'excursions' | 'dining'

export const SPEND_CATEGORIES: readonly SpendCategory[] = ['packages', 'upgrades', 'excursions', 'dining']

export interface SpendLine {
  category: SpendCategory
  cents: Cents
  /** True for something in a cart, not yet paid for. */
  planned: boolean
}

export interface CategoryTotal { category: SpendCategory; bought: Cents; planned: Cents; total: Cents; share: number }

export interface SpendForecast {
  categories: CategoryTotal[]
  bought: Cents
  planned: Cents
  total: Cents
  /** The status of everything bought and planned against the budget. */
  status: BudgetStatus
}

/** Totals by category, the share of the whole each one is, and where the sum stands against the budget. Zero or negative lines are ignored. */
export function spendForecast(lines: readonly SpendLine[], budget: Cents | null): SpendForecast {
  const real = lines.filter((l) => Number.isFinite(l.cents) && l.cents > 0)
  const sum = (pick: (l: SpendLine) => boolean): Cents => real.filter(pick).reduce((s, l) => s + l.cents, 0)
  const total = sum(() => true)
  const categories = SPEND_CATEGORIES.map((category) => {
    const bought = sum((l) => l.category === category && !l.planned)
    const planned = sum((l) => l.category === category && l.planned)
    return { category, bought, planned, total: bought + planned, share: total === 0 ? 0 : Math.round(((bought + planned) / total) * 100) }
  }).filter((c) => c.total > 0)
  const limit = budget !== null && budget > 0 ? budget : null
  return {
    categories,
    bought: sum((l) => !l.planned),
    planned: sum((l) => l.planned),
    total,
    status: statusOf(total, limit, DEFAULT_ALERT),
  }
}
