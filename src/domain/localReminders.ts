import { countdowns, type CountdownInput } from './countdowns'
import { REMINDER_THRESHOLDS } from './allaboard'

/**
 * The in-app fallback for due reminders (MOB-23). Push and the in-app inbox are the primary route; this works out, from what the phone already knows, which
 * reminders are due *now*, so they show while the app is open or the next time it opens. It never claims background delivery: a reminder that was due
 * while the app was closed shows on next open, saying so.
 */
export type ReminderKind = 'pay' | 'checkin' | 'allAboard'

export interface LocalReminder {
  /** Stable for the same reminder, so dismissing it once keeps it dismissed. */
  key: string
  kind: ReminderKind
  /** Days left (pay, checkin) or minutes left (allAboard). */
  amount: number
  /** Past due means the reminder time passed while the app was closed or the user was elsewhere. */
  urgent: boolean
}

/** Payment reminders start this many days before the final payment date, check-in on the day it opens and the day before. */
export const PAY_REMINDER_DAYS = 7
export const CHECKIN_REMINDER_DAYS = 1

export interface ReminderInput {
  trip: CountdownInput | null
  /** The all-aboard moment when the ship is in port today, else null. */
  allAboardAt: number | null
}

/** Which reminders are due at `now`. The all-aboard reminder follows the thresholds in `allaboard` (120, 60, 30 minutes) and shows the nearest one passed. */
export function dueReminders(input: ReminderInput, now: number): LocalReminder[] {
  const out: LocalReminder[] = []
  if (input.trip) {
    for (const c of countdowns(input.trip, now)) {
      if (c.id === 'pay' && c.days <= PAY_REMINDER_DAYS) out.push({ key: `pay:${input.trip.plan.finalDue}:${c.days <= 1 ? 'near' : 'week'}`, kind: 'pay', amount: c.days, urgent: c.days <= 1 })
      if (c.id === 'checkin' && c.days <= CHECKIN_REMINDER_DAYS) out.push({ key: `checkin:${input.trip.checkin.opensAt}`, kind: 'checkin', amount: c.days, urgent: false })
    }
    if (input.trip.payment === 'overdue') out.push({ key: `pay:${input.trip.plan.finalDue}:overdue`, kind: 'pay', amount: 0, urgent: true })
  }
  if (input.allAboardAt !== null && now < input.allAboardAt) {
    const minutes = Math.ceil((input.allAboardAt - now) / 60_000)
    const passed = REMINDER_THRESHOLDS.filter((m) => minutes <= m)
    if (passed.length > 0) out.push({ key: `allAboard:${input.allAboardAt}:${Math.min(...passed)}`, kind: 'allAboard', amount: minutes, urgent: true })
  }
  return out
}

/** Reminders not yet dismissed. */
export const undismissed = (list: readonly LocalReminder[], dismissed: readonly string[]): LocalReminder[] => list.filter((r) => !dismissed.includes(r.key))
