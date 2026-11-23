import { addDays, zonedToEpoch } from '../../../domain/timezones'

/**
 * How firm a day's programme is (research 8.5 and 8.6). Until the evening before the ship has not confirmed the next day's programme, so what is
 * listed is preliminary and may change; from then on it is final for the day. When a day is over the status is "past". The 6 pm hour is an authored
 * concept value (verify with the ship's Patter practice before real use).
 */
export type ScheduleStatus = 'preliminary' | 'final' | 'past'
export const CONFIRMED_AT = '18:00'

export interface ScheduleFacts { status: ScheduleStatus; /** When the programme is expected to be final, as an instant. */ finalAt: number }

/** `date` is the ship date "YYYY-MM-DD" of the day; `zone` the ship's zone on that date; `nowAt` an instant. */
export function scheduleStatus(date: string, zone: string, nowAt: number): ScheduleFacts {
  const finalAt = zonedToEpoch(addDays(date, -1), CONFIRMED_AT, zone)
  const endsAt = zonedToEpoch(addDays(date, 1), '00:00', zone)
  if (nowAt >= endsAt) return { status: 'past', finalAt }
  return { status: nowAt >= finalAt ? 'final' : 'preliminary', finalAt }
}
