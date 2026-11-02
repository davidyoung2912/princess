import { useEffect, useMemo, useState } from 'react'
import { crowdOfWindow, type Conditions } from '../domain/journey'
import { conditionsNow, loadConditions } from '../feeds/route'

/** Traffic and weather on the way to the port: the local simulation at once, then the server's when it arrives (real API only). */
export function useRouteConditions(departure: string, windowStart: string | null): Conditions {
  const crowd = crowdOfWindow(windowStart)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    void loadConditions(departure, crowd).then((fresh) => { if (live && fresh) setTick((n) => n + 1) })
    return () => { live = false }
  }, [departure, crowd])
  // `tick` makes the lookup run again once the server's value is stored.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => conditionsNow(departure, crowd), [departure, crowd, tick])
}
