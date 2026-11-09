import { daysBetween } from './trip'
import { addDays, dateIn } from './timezones'
import type { PaymentState } from './trip'

/** The booking facts a countdown needs; a `TripView` fits. */
export interface CountdownInput {
  payment: PaymentState
  plan: { finalDue: string }
  checkin: { state: 'notOpen' | 'open' | 'closed' | 'done'; opensAt: number }
  daysToDeparture: number
}

export type CountdownId = 'boarding' | 'pay' | 'checkin' | 'special'
/** `date` is the deadline day in `zone`, and `source` says where the date comes from (MNG-15). */
export interface Countdown { id: CountdownId; days: number; date: string; zone: string; source: 'sailing' | 'booking' | 'schedule' | 'rules' }

/** The zone check-in opening and payment dates are kept in. */
const HOME_ZONE = 'America/New_York'

/**
 * The countdowns to show before the cruise, all from the app's "now" so the testing date moves them: days to boarding, days left to pay the
 * balance (while it is still ahead), and days until online check-in opens. Each is whole calendar days, and only shown while it is ahead
 * (or, for boarding, today).
 */
export function countdowns(trip: CountdownInput, now: number, extra: ExtraDeadlines = {}): Countdown[] {
  const today = dateIn(now, HOME_ZONE)
  const list: Countdown[] = []
  if (trip.daysToDeparture >= 0) list.push({ id: 'boarding', days: trip.daysToDeparture, date: addDays(today, trip.daysToDeparture), zone: HOME_ZONE, source: 'sailing' })
  if (trip.payment === 'upcoming' || trip.payment === 'dueSoon') {
    const days = daysBetween(today, trip.plan.finalDue)
    if (days >= 0) list.push({ id: 'pay', days, date: trip.plan.finalDue, zone: HOME_ZONE, source: 'booking' })
  }
  if (trip.checkin.state === 'notOpen') {
    const date = dateIn(trip.checkin.opensAt, HOME_ZONE)
    const days = daysBetween(today, date)
    if (days >= 0) list.push({ id: 'checkin', days, date, zone: HOME_ZONE, source: 'schedule' })
  }
  // The last day to ask for assistance still not asked for (MNG-15). Documents and excursions have no cut-off date in the data, so they have no countdown.
  if (extra.specialBy) {
    const days = daysBetween(today, extra.specialBy)
    if (days >= 0) list.push({ id: 'special', days, date: extra.specialBy, zone: HOME_ZONE, source: 'rules' })
  }
  return list
}

/** Deadlines that come from other screens' data. `specialBy` is the nearest cut-off date not yet passed, or absent. */
export interface ExtraDeadlines { specialBy?: string | null }

/** The nearest cut-off date still ahead among assistance kinds the guest has not yet asked for ("YYYY-MM-DD"), or null. */
export function nearestSpecialBy(deadlines: readonly { kind: string; deadline: { by: string; daysLeft: number } }[], asked: readonly string[]): string | null {
  const ahead = deadlines.filter((d) => d.deadline.daysLeft >= 0 && !asked.includes(d.kind)).map((d) => d.deadline.by).sort()
  return ahead[0] ?? null
}
