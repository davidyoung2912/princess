import { useEffect, useMemo, useState } from 'react'
import type { FlightStatus } from '../domain/journey'
import { flightNow, loadFlight } from '../feeds/flight'

/** A flight's status: the local simulation at once, then the server's when it arrives (real API only). Null when there is no flight to watch. */
export function useFlightStatus(number: string | null, date: string): FlightStatus | null {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!number) return
    let live = true
    void loadFlight(number, date).then((fresh) => { if (live && fresh) setTick((n) => n + 1) })
    return () => { live = false }
  }, [number, date])
  // `tick` makes the lookup run again once the server's value is stored.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (number ? flightNow(number, date) : null), [number, date, tick])
}
