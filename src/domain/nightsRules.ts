import { zonedToEpoch, offsetMinutes } from './timezones'

/**
 * X0f: rules that depend on how long a sailing is (3 to 40 nights) and on the real first and last day, not on a week.
 * Pure. Day numbers run 1 to `nights + 1`: day 1 is embarkation, the last day is disembarkation.
 */

export const MIN_NIGHTS = 3
export const MAX_NIGHTS = 40
/** The most days any plan can have (40 nights and the disembarkation morning). */
export const MAX_PLAN_DAY = MAX_NIGHTS + 1

/** Clamps a length to what the app plans for. */
export const planNights = (nights: number): number => (Number.isFinite(nights) ? Math.min(MAX_NIGHTS, Math.max(MIN_NIGHTS, Math.floor(nights))) : 7)

/** Days a plan has: the nights plus the morning of disembarkation. */
export const planDays = (nights: number): number => planNights(nights) + 1

/** The days 1 to `planDays(nights)`, for pickers. */
export const dayNumbers = (nights: number): number[] => Array.from({ length: planDays(nights) }, (_, i) => i + 1)

export const isEmbarkDay = (day: number): boolean => day === 1
export const isDisembarkDay = (day: number, nights: number): boolean => day === planDays(nights)
/** A whole day aboard, between embarkation and the last morning. */
export const isMidVoyageDay = (day: number, nights: number): boolean => day > 1 && day < planDays(nights)

// ---- Dress nights ----

/** Elegant evenings: none under 5 nights, one for 5 to 6, then about one every three and a half nights (7 is 2, 14 is 4, 21 is 6, 31 is 8). */
export function elegantCount(nights: number): number {
  const n = planNights(nights)
  return n < 5 ? 0 : n < 7 ? 1 : Math.floor(n / 3.5)
}

/** The days of the elegant evenings: the first on day 2, the last on the final night, the rest spread evenly between. */
export function elegantDays(nights: number): number[] {
  const n = planNights(nights)
  const k = elegantCount(n)
  if (k === 0) return []
  if (k === 1) return [2]
  return Array.from({ length: k }, (_, i) => 2 + Math.round((i * (n - 2)) / (k - 1)))
}

// ---- Packing ----

export interface PackCounts {
  /** Daywear outfits to bring; a long cruise washes and repeats. */
  daywear: number
  swimsuits: number
  elegant: number
  /** Whether the list should suggest laundry (more than a week). */
  laundry: boolean
}

export function packCounts(nights: number): PackCounts {
  const n = planNights(nights)
  return { daywear: Math.min(n, 8), swimsuits: n > 10 ? 3 : 2, elegant: Math.min(elegantCount(n), 3), laundry: n > 8 }
}

// ---- Medicines ----

/** Days of each prescription to pack: every day aboard, plus a buffer for a delay (3 days, a week from 15 nights). */
export function medicationSupplyDays(nights: number): number {
  const n = planNights(nights)
  return n + 1 + (n > 14 ? 7 : 3)
}

// ---- Nudges by length ----

export type NudgeKind = 'medicines' | 'laundry' | 'restock' | 'halfway'
export interface MidVoyageNudge { day: number; kind: NudgeKind }

/** Reminders placed on days that suit the length: laundry before the second week, a medicines check at the midpoint of a long voyage, a restock each week after that. Nothing on a short cruise. */
export function midVoyageNudges(nights: number): MidVoyageNudge[] {
  const n = planNights(nights)
  const out: MidVoyageNudge[] = []
  if (n >= 10) out.push({ day: 5, kind: 'laundry' })
  if (n >= 10) out.push({ day: Math.round((n + 1) / 2), kind: 'halfway' })
  if (n >= 14) out.push({ day: Math.round((n + 1) / 2) + 1, kind: 'medicines' })
  if (n >= 21) for (let d = 14; d < n - 2; d += 7) out.push({ day: d, kind: 'restock' })
  return out.sort((a, b) => a.day - b.day || a.kind.localeCompare(b.kind))
}

// ---- Clock changes ----

export interface DayZone { day: number; date: string; zone?: string }
export interface ClockNudge { day: number; hours: number; fromZone: string; toZone: string }

/** One nudge for each night the ship's clock moves (at 02:00), with the size of the jump. Works for any number of zones. `home` is the zone before day 1 changes. */
export function clockChangeNudges(days: readonly DayZone[], home: string): ClockNudge[] {
  const out: ClockNudge[] = []
  let zone = home
  for (const d of days) {
    if (!d.zone || d.zone === zone) continue
    const at = zonedToEpoch(d.date, '02:00', zone)
    out.push({ day: d.day, hours: (offsetMinutes(at, d.zone) - offsetMinutes(at - 1, zone)) / 60, fromZone: zone, toZone: d.zone })
    zone = d.zone
  }
  return out
}
