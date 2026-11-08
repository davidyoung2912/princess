/**
 * The date and price calendar (N-D1): the sailings of one view laid out by date, each with its from-price as a bar and plain badges.
 * Pure: the caller passes today's date and the price, so it is tested without a clock or the network.
 */
import type { Cents } from './money'

export interface CalendarSailing { id: string; departure: string; nights: number; holiday: boolean; month: string }

export type CalendarBadge = 'cheapest' | 'bestValue' | 'holiday' | 'hurricane'

export interface CalendarRow {
  id: string
  departure: string
  nights: number
  price: Cents | null
  /** Bar length, 5 to 100, against the dearest price shown; 0 when there is no price. */
  barPercent: number
  /** Whole weeks until departure; null once it has left. */
  weeksAway: number | null
  badges: CalendarBadge[]
}

const DAY = 86_400_000
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`)

/** Atlantic hurricane season, June to November. Shown as a plain shading, not a forecast. */
export const inHurricaneSeason = (month: string): boolean => { const m = Number(month.slice(5, 7)); return m >= 6 && m <= 11 }

export function weeksUntil(departure: string, today: string): number | null {
  const days = Math.round((dayMs(departure) - dayMs(today)) / DAY)
  return days < 0 ? null : Math.floor(days / 7)
}

/** Rows in date order. "Cheapest" is the lowest price, "best value" the lowest per night; both only when two or more sailings have a price. */
export function calendarRows(list: readonly CalendarSailing[], priceOf: (id: string) => Cents | null, today: string): CalendarRow[] {
  const sorted = [...list].sort((a, b) => a.departure.localeCompare(b.departure) || a.id.localeCompare(b.id))
  const priced = sorted.flatMap((s) => { const p = priceOf(s.id); return p === null ? [] : [{ s, p }] })
  const top = Math.max(0, ...priced.map((x) => x.p))
  const compare = priced.length >= 2
  const lowest = compare ? Math.min(...priced.map((x) => x.p)) : null
  const perNight = (x: { s: CalendarSailing; p: number }) => x.p / Math.max(1, x.s.nights)
  const bestNight = compare ? Math.min(...priced.map(perNight)) : null
  return sorted.map((s) => {
    const price = priceOf(s.id)
    const badges: CalendarBadge[] = []
    if (price !== null && price === lowest) badges.push('cheapest')
    if (price !== null && bestNight !== null && price / Math.max(1, s.nights) === bestNight) badges.push('bestValue')
    if (s.holiday) badges.push('holiday')
    if (inHurricaneSeason(s.month)) badges.push('hurricane')
    return {
      id: s.id, departure: s.departure, nights: s.nights, price,
      barPercent: price === null || top === 0 ? 0 : Math.max(5, Math.round((price / top) * 100)),
      weeksAway: weeksUntil(s.departure, today), badges,
    }
  })
}
