import { useEffect, useMemo, useState } from 'react'
import type { SimWeather } from '../domain/autopilot'
import type { PortId } from '../domain/sailings'
import { loadSky, skyNow } from '../feeds/sky'

/** A day's sky: the local simulation at once, then the server's figures when they arrive (real API only; the figures are the same). */
export function useSky(sailingId: string, day: number, port: PortId): SimWeather {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    void loadSky(sailingId, day, port).then((fresh) => { if (live && fresh) setTick((n) => n + 1) })
    return () => { live = false }
  }, [sailingId, day, port])
  // `tick` makes the lookup run again once the server's value is stored.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => skyNow(sailingId, day, port), [sailingId, day, port, tick])
}
