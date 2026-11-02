import type { FarePoint } from '../domain/bookingPrep'
import { createFeed } from './feed'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Reads the server's fare points; anything wrong in them gives null. */
export function normalizeFares(raw: unknown): FarePoint[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 26) return null
  const points: FarePoint[] = []
  for (const p of raw) {
    const o = p as Record<string, unknown> | null
    if (!o || typeof o.date !== 'string' || !DATE.test(o.date) || typeof o.total !== 'number' || !Number.isFinite(o.total) || o.total < 0) return null
    points.push({ date: o.date, total: o.total })
  }
  return points
}

/** A booking's weekly fare history: booking number, the total paid, the day booked and today. */
export const faresFeed = createFeed<[number: string, bookedTotal: number, bookedOn: string, today: string], FarePoint[]>((n, t, b, d) => `${n}|${t}|${b}|${d}`, normalizeFares, 'fares')
