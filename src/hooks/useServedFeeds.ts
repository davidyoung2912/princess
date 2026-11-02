import { useEffect, useMemo, useState } from 'react'
import type { FarePoint } from '../domain/bookingPrep'
import type { CrowdPort, PortCrowd } from '../domain/portCrowd'
import type { WhatIfBooking } from '../domain/whatIf'
import { faresNow, loadFares } from '../feeds/fares'
import { crowdNow, loadCrowd } from '../feeds/portCrowd'

/** How busy a port is on a date: the local simulation at once, then the server's when it arrives (real API only; the figures are the same). */
export function usePortCrowd(port: CrowdPort, date: string): PortCrowd {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!date) return
    let live = true
    void loadCrowd(port, date).then((fresh) => { if (live && fresh) setTick((n) => n + 1) })
    return () => { live = false }
  }, [port, date])
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => crowdNow(port, date), [port, date, tick])
}

/** A booking's weekly fare history: the local simulation at once, then the server's when it arrives. */
export function useFareHistory(b: Pick<WhatIfBooking, 'plan' | 'today'>, number: string): FarePoint[] {
  const [tick, setTick] = useState(0)
  const { total, booked } = b.plan
  useEffect(() => {
    let live = true
    void loadFares(b, number).then((fresh) => { if (live && fresh) setTick((n) => n + 1) })
    return () => { live = false }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [number, total, booked, b.today])
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => faresNow(b, number), [number, total, booked, b.today, tick])
}
