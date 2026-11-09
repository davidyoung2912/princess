import type { HistoryTrip } from '../api/finishTypes'

/** Trips whose title, ship, year or ports contain every word typed (REM-01). */
export function matchTrips(trips: HistoryTrip[], query: string): HistoryTrip[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return trips
  return trips.filter((x) => {
    const hay = `${x.title} ${x.ship} ${x.departure} ${JSON.stringify(x.ports)}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
