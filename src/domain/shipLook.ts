import type { Condition } from './weather'
import { zonedToEpoch } from './timezones'

/** Pure helpers for the L4 "ship comes alive" look (docs/look-and-feel-recommendations.md, 5.1, 5.2, 5.3, 5.7). Nothing here calls the server; the sun times, weather and itinerary come from the feeds. */

export type PhaseOfDay = 'sunrise' | 'day' | 'sunset' | 'night'
export const TWILIGHT_MINUTES = 45

export interface PhaseResult {
  phase: PhaseOfDay
  /** Minutes until the sun event of that phase (negative once it has passed), or null by day and night. */
  minutes: number | null
}

/** The part of the ship's day: within 45 minutes of sunrise or sunset is that moment, the dark hours are night, the rest is day. Times are ship time ("HH:MM") on the ship's date. */
export function phaseOfDay(now: number, date: string, zone: string, sun: { sunrise: string; sunset: string }): PhaseResult {
  const rise = zonedToEpoch(date, sun.sunrise, zone)
  const set = zonedToEpoch(date, sun.sunset, zone)
  const w = TWILIGHT_MINUTES * 60_000
  if (Math.abs(now - rise) <= w) return { phase: 'sunrise', minutes: Math.round((rise - now) / 60_000) }
  if (Math.abs(now - set) <= w) return { phase: 'sunset', minutes: Math.round((set - now) / 60_000) }
  if (now < rise || now > set) return { phase: 'night', minutes: null }
  return { phase: 'day', minutes: null }
}

export type SeaState = 'calm' | 'slight' | 'moderate' | 'rough'

/** Sea state from the wave height in metres, in four plain steps. */
export const seaState = (waveM: number): SeaState => (waveM < 0.5 ? 'calm' : waveM < 1.25 ? 'slight' : waveM < 2.5 ? 'moderate' : 'rough')

/** How many of the three wave bars of the gauge are filled. */
export const SEA_BARS: Record<SeaState, number> = { calm: 1, slight: 1, moderate: 2, rough: 3 }

export type HeroEffect = 'none' | 'cloud' | 'rain' | 'glint' | 'spray'

/** The one light effect over the hero: rain for showers, rain and storm; spray on a rough sea; cloud drift for cloud; a glint on a calm, clear sea by day. */
export function heroEffect(condition: Condition, sea: SeaState, daylight: boolean): HeroEffect {
  if (condition === 'rain' || condition === 'showers' || condition === 'storm') return 'rain'
  if (sea === 'rough') return 'spray'
  if (condition === 'cloudy' || condition === 'partlyCloudy') return 'cloud'
  if (condition === 'sunny' && sea === 'calm' && daylight) return 'glint'
  return 'none'
}

export type DayLook = 'embark' | 'sea' | 'port' | 'disembark'

/** Which signature header a cruise day gets: the first day embarks, the last disembarks, a sea day is at sea, anything else is a port day. */
export function dayLook(day: number, lastDay: number, port: string): DayLook {
  if (day <= 1) return 'embark'
  if (day >= lastDay) return 'disembark'
  return port === 'sea' ? 'sea' : 'port'
}

export type AboardTone = 'calm' | 'amber' | 'red'

/** The colour of the all-aboard countdown: calm until two hours out, amber under two hours, red under thirty minutes. Words always say the time too. */
export const aboardTone = (minutesLeft: number): AboardTone => (minutesLeft <= 30 ? 'red' : minutesLeft <= 120 ? 'amber' : 'calm')

/** How far through the two-hour run-up to all-aboard (0 to 1) for the ring. */
export const aboardRingFraction = (minutesLeft: number): number => Math.min(1, Math.max(0, 1 - minutesLeft / 120))

export type SailAwayPhase = 'soon' | 'underway' | null

export const SAIL_AWAY_LEAD_MINUTES = 60
export const SAIL_AWAY_AFTER_MINUTES = 120

/** The sail-away card shows for the hour before departure ("soon") and two hours after ("underway"); otherwise nothing. */
export function sailAwayPhase(now: number, sailAwayAt: number | null): SailAwayPhase {
  if (sailAwayAt === null) return null
  const delta = (now - sailAwayAt) / 60_000
  if (delta < -SAIL_AWAY_LEAD_MINUTES || delta > SAIL_AWAY_AFTER_MINUTES) return null
  return delta < 0 ? 'soon' : 'underway'
}

/** How far along the voyage a cruise day is, 0 to 100, for the thin route line on a sea day. */
export const routePercent = (day: number, lastDay: number): number => (lastDay <= 1 ? 0 : Math.round(((Math.min(Math.max(day, 1), lastDay) - 1) / (lastDay - 1)) * 100))

/** The next port of call after a day, or null when none is left. Sea days and the home port at the end are skipped. */
export function nextCall(days: readonly { day: number; port: string }[], day: number): string | null {
  const last = days.length
  return days.find((d) => d.day > day && d.day < last && d.port !== 'sea')?.port ?? null
}
