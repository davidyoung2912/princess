/** Where the guest is in the sailing, for wording only: it never switches an action on or off (plan section 11.2). */
export type ExplorerStage = 'ahead' | 'aboard' | 'after'

const DAY_MS = 86_400_000

/** `departureAt` is when the ship leaves on day 1 and `endAt` is when the guests have left on the last day, both in epoch milliseconds. */
export interface SailingWindow { departureAt: number; endAt: number }

export function explorerStage(w: SailingWindow, nowAt: number): ExplorerStage {
  if (nowAt < w.departureAt) return 'ahead'
  return nowAt < w.endAt ? 'aboard' : 'after'
}

/** Whole days until sailing, rounded up so "Sails in 1 day" is true until the moment of departure; 0 once the ship has sailed. */
export function sailsInDays(w: SailingWindow, nowAt: number): number {
  return nowAt >= w.departureAt ? 0 : Math.ceil((w.departureAt - nowAt) / DAY_MS)
}
