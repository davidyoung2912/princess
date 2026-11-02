import { fareHistory, type FarePoint } from '../domain/bookingPrep'
import type { WhatIfBooking } from '../domain/whatIf'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Reads the server's fare points; anything wrong in them gives null so the local simulation is used. */
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

type Booking = Pick<WhatIfBooking, 'plan' | 'today'>

/** Asks the server for a booking's fare history; null when there is no server (mock mode). Set by the runtime. */
export type FaresFetcher = (number: string, bookedTotal: number, bookedOn: string, today: string) => Promise<unknown>
let fetcher: FaresFetcher | null = null
export const setFaresFetcher = (f: FaresFetcher | null): void => { fetcher = f }

const served = new Map<string, FarePoint[]>()
const key = (number: string, b: Booking): string => `${number}|${b.plan.total}|${b.plan.booked}|${b.today}`

/** What is known now: the server's history if it has come, else the local simulation (the same figures). */
export const faresNow = (b: Booking, number: string): FarePoint[] => served.get(key(number, b)) ?? fareHistory(b, number)

/** Fetches the server's history once per booking and day; resolves true when a new value was stored. */
export async function loadFares(b: Booking, number: string): Promise<boolean> {
  if (!fetcher || served.has(key(number, b))) return false
  try {
    const points = normalizeFares(await fetcher(number, b.plan.total, b.plan.booked, b.today))
    if (!points) return false
    served.set(key(number, b), points)
    return true
  } catch {
    return false
  }
}

export const forgetFares = (): void => served.clear()
