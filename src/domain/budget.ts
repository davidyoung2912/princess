import type { Cents } from './pricing'
import type { FolioLine } from './folio'

/** A spending budget for the cruise (ACC-02): one for the booking, an optional limit for each child, and when to warn. Alerts only: nothing is ever refused at a till. */
export const ALERT_LEVELS = [50, 80, 100] as const
export type AlertLevel = (typeof ALERT_LEVELS)[number]
export const DEFAULT_ALERT: AlertLevel = 80
export const MAX_BUDGET: Cents = 1_000_000

export interface Budget {
  /** The limit for the whole booking, or null for none. */
  total: Cents | null
  alertAt: AlertLevel
  /** A limit per child, by person id. */
  kids: Record<string, Cents>
}

export const NO_BUDGET: Budget = { total: null, alertAt: DEFAULT_ALERT, kids: {} }

const cents = (v: unknown): Cents | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= MAX_BUDGET ? v : null)

/** A budget from stored or typed data: anything out of range or unknown falls back to "no limit". */
export function normalizeBudget(raw: unknown): Budget {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const kids: Record<string, Cents> = {}
  if (o.kids && typeof o.kids === 'object') for (const [id, v] of Object.entries(o.kids as Record<string, unknown>)) { const c = cents(v); if (c !== null) kids[id] = c }
  const level = ALERT_LEVELS.find((l) => l === o.alertAt)
  return { total: cents(o.total), alertAt: level ?? DEFAULT_ALERT, kids }
}

export type BudgetState = 'none' | 'ok' | 'near' | 'over'

export interface BudgetStatus { limit: Cents | null; spent: Cents; percent: number; state: BudgetState; left: Cents }

/** Where spending stands against a limit. Covered charges (paid by a package or the fare) and credits are not spending. */
export function statusOf(spent: Cents, limit: Cents | null, alertAt: AlertLevel): BudgetStatus {
  if (limit === null) return { limit, spent, percent: 0, state: 'none', left: 0 }
  const percent = Math.floor((spent / limit) * 100)
  const state: BudgetState = spent > limit ? 'over' : percent >= alertAt ? 'near' : 'ok'
  return { limit, spent, percent, state: spent === limit && alertAt === 100 ? 'near' : state, left: Math.max(0, limit - spent) }
}

/** What a guest has spent: charges to the account, not credits, and not what a package or the fare paid for. */
export function spentBy(lines: readonly FolioLine[], guest?: string): Cents {
  return lines.filter((l) => l.cents > 0 && (guest === undefined || l.guest === guest)).reduce((sum, l) => sum + l.cents, 0)
}

export interface BudgetReport { total: BudgetStatus; kids: ({ id: string } & BudgetStatus)[]; worst: BudgetState }

const RANK: Record<BudgetState, number> = { none: 0, ok: 1, near: 2, over: 3 }

export function reportBudget(b: Budget, lines: readonly FolioLine[]): BudgetReport {
  const total = statusOf(spentBy(lines), b.total, b.alertAt)
  const kids = Object.entries(b.kids).map(([id, limit]) => ({ id, ...statusOf(spentBy(lines, id), limit, b.alertAt) }))
  const worst = [total, ...kids].reduce<BudgetState>((w, s) => (RANK[s.state] > RANK[w] ? s.state : w), 'none')
  return { total, kids, worst }
}
