import type { Api } from '../api/types'
import { wishOf, type WeekPrefs } from '../domain/autopilot'
import { basePlan, programmeDiff, type Change, type ProgrammeEffect } from '../domain/planChange'
import type { Sailing } from '../domain/sailings'

/**
 * Tells the account what an accepted (or undone) plan change did to the guest's programme, so the events they see on their other devices and in the
 * on-board programme match the day they agreed to. Best effort: the change itself is already kept, and a failure leaves the programme as it was.
 */
export async function applyToProgramme(onboard: Pick<Api['onboard'], 'program' | 'togglePlan'>, day: number, effects: readonly ProgrammeEffect[]): Promise<void> {
  if (effects.length === 0) return
  try { await onboard.program(day) } catch { /* the day is looked up so the route knows which day an event is on; try anyway */ }
  for (const e of effects) {
    try { await onboard.togglePlan(e.eventId, e.on) } catch { /* a supervised account cannot change the plan; an unknown event is skipped */ }
  }
}

/** After a plan change is accepted or undone (`before` and `after` are the guest's changes), updates the programme on the account to match. Fire and forget. */
export function programmeFollows(onboard: Pick<Api['onboard'], 'program' | 'togglePlan'>, sailing: Sailing, prefs: WeekPrefs, before: readonly Change[], after: readonly Change[]): void {
  for (const { day, effects } of programmeDiff(before, after, (d) => basePlan(sailing, d, wishOf(prefs)))) void applyToProgramme(onboard, day, effects)
}
