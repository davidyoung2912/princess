import { useEffect, useMemo, useState } from 'react'
import type { FarePoint } from '../domain/bookingPrep'
import type { CrowdPort, PortCrowd } from '../domain/portCrowd'
import type { WhatIfBooking } from '../domain/whatIf'
import type { Watch } from '../domain/autopilot'
import { envFor, type PulseEnv } from '../domain/pulse'
import type { Sailing } from '../domain/sailings'
import type { Feed } from '../feeds/feed'
import { faresNow, loadFares } from '../feeds/fares'
import { openingArgs, openingFeed } from '../feeds/onboard'
import { minuteOf, pulseFeed, withServed } from '../feeds/pulse'
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

/** Any feed from `src/feeds`: the local simulation at once, the server's answer when it arrives. `args` must be plain values (they key the cache). */
export function useFeed<A extends unknown[], V>(feed: Feed<A, V>, ...args: A): V {
  const [tick, setTick] = useState(0)
  const k = JSON.stringify(args)
  useEffect(() => {
    let live = true
    void feed.load(...args).then((fresh) => { if (live && fresh) setTick((n) => n + 1) })
    return () => { live = false }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, k])
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => feed.now(...args), [feed, k, tick])
}

/**
 * The ship's environment for pulse readings, with the server's levels laid over it when they arrive, and the moment to read it at (the whole minute,
 * which changes nothing the screens show). One request covers a minute, and only while a pulse screen is open.
 */
export function usePulseEnv(sailing: Sailing, now: number): { env: PulseEnv; now: number } {
  const minute = minuteOf(now)
  const served = useFeed(pulseFeed, sailing.departure, minute)
  const env = useMemo(() => withServed(envFor(sailing), served), [sailing, served])
  return { env, now: minute }
}

/** When a place opens for each slot watch (the simulation at once, the server's answer when it arrives): look a watch up with the returned function. */
export function useOpenings(watches: readonly Pick<Watch, 'id' | 'createdAt' | 'slotAt'>[]): (w: Pick<Watch, 'id' | 'createdAt' | 'slotAt'>) => number | null {
  const [tick, setTick] = useState(0)
  const k = JSON.stringify(watches.map(openingArgs))
  useEffect(() => {
    let live = true
    void Promise.all(watches.map((w) => openingFeed.load(...openingArgs(w)))).then((r) => { if (live && r.some(Boolean)) setTick((n) => n + 1) })
    return () => { live = false }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [k])
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (w) => openingFeed.now(...openingArgs(w)).opensAt, [tick])
}
