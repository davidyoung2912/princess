import type { ExplorerStage } from './stage'

/**
 * After the cruise every Explorer is read only (plan section 11.3, `remember`). The server's `canBook` stays the authority while the ship is
 * sailing; once the cruise is over this only ever tightens it, so nothing offers Add, Change, Cancel or Pay on a finished sailing.
 */
export function lockedWhenOver<T extends { canBook: boolean }>(view: T, stage: ExplorerStage): T {
  return stage === 'after' && view.canBook ? { ...view, canBook: false } : view
}

export interface AheadInput {
  stage: ExplorerStage
  /** The day being looked at, the ship's own day now, and the length of the cruise. */
  day: number
  currentDay: number
  total: number
  /** Ship time now, "HH:MM". */
  nowTime: string
}

/** Disembark day: the last day of the sailing while the guest is still aboard. */
export function isDisembarkDay({ stage, day, currentDay, total }: Pick<AheadInput, 'stage' | 'day' | 'currentDay' | 'total'>): boolean {
  return stage === 'aboard' && total > 0 && day === total && currentDay === total
}

/**
 * On disembark day the day list shows only what is still ahead; what has already happened is counted, not listed, and the Whole trip list keeps it.
 * Any other day is returned as it is. Items carry a ship-time "HH:MM" start.
 */
export function aheadOnly<T extends { time: string }>(items: readonly T[], input: AheadInput): { shown: T[]; earlier: number } {
  if (!isDisembarkDay(input)) return { shown: [...items], earlier: 0 }
  const shown = items.filter((i) => i.time >= input.nowTime)
  return { shown, earlier: items.length - shown.length }
}
