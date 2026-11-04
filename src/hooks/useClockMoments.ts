import { useMemo } from 'react'
import { clockMomentTimes } from '../domain/diarySources'
import { itinerary } from '../domain/sailings'
import { useNow, useSailing } from './useDemo'

export type ClockMoment = 'sailAway' | 'lastNight' | 'offShip' | 'home'

/** Which of the moments that come with the clock have begun on this sailing (sail-away, the last evening, leaving the ship, home), and which is still going on. */
export function useClockMoment(id: ClockMoment): boolean {
  const sailing = useSailing()
  const now = useNow()
  const times = useMemo(() => clockMomentTimes(itinerary(sailing)), [sailing])
  if (!times) return false
  switch (id) {
    // Each shows from its time until the next moment begins, so a stale one does not appear days later.
    case 'sailAway': return now >= times.sail && now < (times.lastNight ?? times.off)
    case 'lastNight': return times.lastNight !== null && now >= times.lastNight && now < times.off
    case 'offShip': return now >= times.off && now < times.home
    case 'home': return now >= times.home
  }
}
