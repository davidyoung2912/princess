/**
 * The notification budget (XA-03): the guest chooses how many unprompted suggestions they want a day, including none.
 * Critical and safety notices are exempt, and so is anything the guest asked for.
 */
export const NUDGE_CHOICES = [0, 1, 3, 5] as const
export type NudgeBudget = (typeof NUDGE_CHOICES)[number]
export const DEFAULT_NUDGES: NudgeBudget = 3

export const isNudgeBudget = (v: unknown): v is NudgeBudget => NUDGE_CHOICES.includes(v as NudgeBudget)

export interface Nudge { id: string; /** Higher is more worth saying. */ priority: number; /** Critical notices always go. */ critical?: boolean }

/** What may be said today: every critical notice, plus the highest-priority others up to the budget. Ties keep their given order. */
export function rankNudges<T extends Nudge>(items: readonly T[], budget: NudgeBudget): T[] {
  const critical = items.filter((i) => i.critical)
  const rest = items.map((n, i) => ({ n, i })).filter(({ n }) => !n.critical).sort((a, b) => b.n.priority - a.n.priority || a.i - b.i).slice(0, budget).map(({ n }) => n)
  return [...critical, ...rest]
}

/** How many unprompted suggestions were shown on a day ("YYYY-MM-DD"). */
export interface NudgeDay { day: string; count: number }

/** Records one shown suggestion, or says it may not be shown because the day's budget is spent. A new day starts at zero. */
export function takeNudge(state: NudgeDay | null, budget: NudgeBudget, day: string): { state: NudgeDay; allowed: boolean } {
  const current = state && state.day === day ? state : { day, count: 0 }
  if (current.count >= budget) return { state: current, allowed: false }
  return { state: { day, count: current.count + 1 }, allowed: true }
}
