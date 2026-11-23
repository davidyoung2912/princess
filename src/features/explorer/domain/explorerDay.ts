import type { DayShape } from '../../../domain/dayKinds'

/** A whole number from 1 to `total`, or null for anything else (a missing, mistyped or out-of-range value). */
export function parseDay(raw: unknown, total: number): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{1,3}$/.test(raw) ? Number(raw) : NaN
  return Number.isInteger(n) && n >= 1 && n <= total ? n : null
}

/**
 * The day an Explorer shows: the one in the address (`?day=N`) if valid, else the one the guest last chose this session, else the ship's own day.
 * The result is always inside the sailing.
 */
export function resolveExplorerDay(o: { requested: unknown; remembered: number | null; currentDay: number; total: number }): number {
  const fallback = Math.min(Math.max(Math.trunc(o.currentDay) || 1, 1), Math.max(o.total, 1))
  return parseDay(o.requested, o.total) ?? (o.remembered !== null ? parseDay(o.remembered, o.total) : null) ?? fallback
}

/** One step forward or back, stopping at the ends of the sailing. */
export const stepDay = (day: number, delta: number, total: number): number => Math.min(Math.max(day + delta, 1), Math.max(total, 1))

export interface DayChoice {
  day: number
  /** Calendar date in ship time, "YYYY-MM-DD". */
  date: string
  port: string
  atSea: boolean
  isToday: boolean
  isPast: boolean
}

/** The days the date picker offers, with where the ship is on each. */
export function dayChoices(days: readonly DayShape[], currentDay: number): DayChoice[] {
  return days.map((d, i) => ({ day: i + 1, date: d.date, port: d.port, atSea: d.port === 'sea', isToday: i + 1 === currentDay, isPast: i + 1 < currentDay }))
}
