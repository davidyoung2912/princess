import { JOURNEY_OF_STAGE, type JourneyStage } from '../routes/hubs'
import { itinerary, shipZoneAt, stageAt, stageStarts, type Sailing, type StageId } from './sailings'
import { addDays, dateIn, zonedToEpoch } from './timezones'

/** How far into its stage the guest is: a cruise day, or a count of days to or since the cruise. */
export type DayOfStage =
  | { kind: 'cruiseDay'; day: number; of: number }
  | { kind: 'daysToDeparture'; days: number }
  | { kind: 'daysSinceReturn'; days: number }

/** Which clock the guest is looking at: the ship's while on board, otherwise their own place. */
export type ClockKind = 'ship' | 'local'

export interface JourneyPosition {
  stage: JourneyStage
  /** The finer stage along the sailing; null before there is a booking. */
  sailingStage: StageId | null
  day: DayOfStage | null
  onBoard: boolean
  clock: ClockKind
  /** The zone the clock and the date show in. */
  zone: string
  /** The calendar date in `zone`, "YYYY-MM-DD". */
  date: string
}

export interface PositionInput {
  hasBooking: boolean
  sailing: Sailing
  now: number
  phoneZone: string
}

/** Whole calendar days from one date to another ("YYYY-MM-DD"). */
export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/**
 * Where a guest is on their journey at a moment: the stage follows the booking and the time together. With no booking the guest is before
 * booking; with one, the stage is the sailing's stage at that time. The day says how far into it they are, so a screen can pick the day's
 * menus, shows and countdowns from the same date the tester sets.
 */
export function journeyPosition({ hasBooking, sailing, now, phoneZone }: PositionInput): JourneyPosition {
  const days = itinerary(sailing)
  if (!hasBooking || days.length === 0) {
    return { stage: 'discover', sailingStage: null, day: null, onBoard: false, clock: 'local', zone: phoneZone, date: dateIn(now, phoneZone) }
  }
  const sailingStage = stageAt(sailing, now)
  const starts = stageStarts(sailing)
  const boarding = starts.find((s) => s.id === 'embarkation')!.at
  const shipZone = shipZoneAt(sailing, now)
  const lastDay = days[days.length - 1]
  // On board from embarkation until midday on the morning of arrival.
  const leaves = zonedToEpoch(lastDay.date, '12:00', shipZone)
  const onBoard = now >= boarding && now < leaves
  const zone = onBoard ? shipZone : phoneZone
  const date = dateIn(now, zone)
  let day: DayOfStage
  if (onBoard) {
    const n = days.find((d) => d.date === date)?.day ?? 1
    day = { kind: 'cruiseDay', day: n, of: days.length }
  } else if (now < boarding) {
    day = { kind: 'daysToDeparture', days: Math.max(0, daysBetween(date, sailing.departure)) }
  } else {
    day = { kind: 'daysSinceReturn', days: Math.max(0, daysBetween(addDays(lastDay.date, 0), date)) }
  }
  return { stage: JOURNEY_OF_STAGE[sailingStage], sailingStage, day, onBoard, clock: onBoard ? 'ship' : 'local', zone, date }
}
