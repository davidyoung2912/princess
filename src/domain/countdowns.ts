import { daysBetween } from './trip'
import { dateIn } from './timezones'
import type { PaymentState } from './trip'

/** The booking facts a countdown needs; a `TripView` fits. */
export interface CountdownInput {
  payment: PaymentState
  plan: { finalDue: string }
  checkin: { state: 'notOpen' | 'open' | 'closed' | 'done'; opensAt: number }
  daysToDeparture: number
}

export type CountdownId = 'boarding' | 'pay' | 'checkin'
export interface Countdown { id: CountdownId; days: number }

/** The zone check-in opening and payment dates are kept in. */
const HOME_ZONE = 'America/New_York'

/**
 * The countdowns to show before the cruise, all from the app's "now" so the testing date moves them: days to boarding, days left to pay the
 * balance (while it is still ahead), and days until online check-in opens. Each is whole calendar days, and only shown while it is ahead
 * (or, for boarding, today).
 */
export function countdowns(trip: CountdownInput, now: number): Countdown[] {
  const today = dateIn(now, HOME_ZONE)
  const list: Countdown[] = []
  if (trip.daysToDeparture >= 0) list.push({ id: 'boarding', days: trip.daysToDeparture })
  if (trip.payment === 'upcoming' || trip.payment === 'dueSoon') {
    const days = daysBetween(today, trip.plan.finalDue)
    if (days >= 0) list.push({ id: 'pay', days })
  }
  if (trip.checkin.state === 'notOpen') {
    const days = daysBetween(today, dateIn(trip.checkin.opensAt, HOME_ZONE))
    if (days >= 0) list.push({ id: 'checkin', days })
  }
  return list
}
