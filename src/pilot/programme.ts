import type { Api } from '../api/types'
import { wishOf, type WeekPrefs } from '../domain/autopilot'
import { programmeDiff, type Change, type ProgrammeEffect } from '../domain/planChange'
import { dayPlanFeed, entriesOf, wishKey } from '../feeds/dayPlan'
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

/**
 * After a plan change is accepted or undone (`before` and `after` are the guest's changes), updates the programme on the account to match. Fire and forget.
 * It needs the day as the server built it for the guest's wishes (the plan the change was made against), which is asked for first if this device does not have it.
 */
export async function programmeFollows(onboard: Pick<Api['onboard'], 'program' | 'togglePlan'>, sailing: Sailing, prefs: WeekPrefs, before: readonly Change[], after: readonly Change[]): Promise<void> {
  const key = wishKey(wishOf(prefs))
  await Promise.all([...new Set(after.map((c) => c.day))].map((d) => dayPlanFeed.load(sailing.id, d, key)))
  for (const { day, effects } of programmeDiff(before, after, (d) => { const served = dayPlanFeed.now(sailing.id, d, key); return served ? entriesOf(served.items) : [] })) void applyToProgramme(onboard, day, effects)
}
