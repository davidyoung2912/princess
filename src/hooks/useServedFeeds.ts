import { useEffect, useMemo, useState } from 'react'
import type { FarePoint } from '../domain/bookingPrep'
import type { CrowdPort, PortCrowd } from '../domain/portCrowd'
import type { WhatIfBooking } from '../domain/whatIf'
import type { Watch } from '../domain/autopilot'
import { envFor, type PulseEnv } from '../domain/pulse'
import type { Sailing } from '../domain/sailings'
import type { Feed } from '../feeds/feed'
import { faresFeed } from '../feeds/fares'
import { openingArgs, openingFeed } from '../feeds/onboard'
import { minuteOf, pulseDayFeed, pulseFeed, withServed } from '../feeds/pulse'
import { crowdFeed } from '../feeds/portCrowd'

/**
 * Any feed from `src/feeds`: the server's answer, else the last one kept on this device, else null (loading). `args` must be plain values (they key the
 * cache). `enabled` false asks for nothing and gives null.
 */
export function useServedFeed<A extends unknown[], V>(enabled: boolean, feed: Feed<A, V>, args: A): V | null {
  const [tick, setTick] = useState(0)
  const k = JSON.stringify(args)
  useEffect(() => {
    if (!enabled) return
    let live = true
    void feed.load(...args).then((fresh) => { if (live && fresh) setTick((n) => n + 1) })
    return () => { live = false }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, feed, k])
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (enabled ? feed.now(...args) : null), [enabled, feed, k, tick])
}

export function useFeed<A extends unknown[], V>(feed: Feed<A, V>, ...args: A): V | null {
  return useServedFeed(true, feed, args)
}

/** How busy a port is on a date; null until the server's answer (or the last one kept on this device) is here. */
export function usePortCrowd(port: CrowdPort, date: string): PortCrowd | null {
  return useServedFeed(!!date, crowdFeed, [port, date])
}

/** A booking's weekly fare history from the server; null until it is here. */
export function useFareHistory(b: Pick<WhatIfBooking, 'plan' | 'today'>, number: string): FarePoint[] | null {
  return useFeed(faresFeed, number, b.plan.total, b.plan.booked, b.today)
}

/**
 * The ship's environment for pulse readings, with the server's levels: the live window (the whole minute, so one request covers a minute) and the
 * day's half hours. `env` is null until the live levels are here; `dayReady` says whether the day's levels are too. Only while a pulse screen is open.
 */
export function usePulseEnv(sailing: Sailing, now: number, day: number): { env: PulseEnv | null; now: number; dayReady: boolean } {
  const minute = minuteOf(now)
  const live = useFeed(pulseFeed, sailing.departure, minute)
  const served = useFeed(pulseDayFeed, sailing.departure, day)
  const env = useMemo(() => (live ? withServed(envFor(sailing, () => undefined), live, served) : null), [sailing, live, served])
  return { env, now: minute, dayReady: !!served }
}

/** The same feed asked for several argument sets at once (for a side-by-side comparison); each entry is null until its answer is here. */
export function useFeedList<A extends unknown[], V>(feed: Feed<A, V>, list: readonly A[]): (V | null)[] {
  const [tick, setTick] = useState(0)
  const k = JSON.stringify(list)
  useEffect(() => {
    let live = true
    void Promise.all(list.map((args) => feed.load(...args))).then((r) => { if (live && r.some(Boolean)) setTick((n) => n + 1) })
    return () => { live = false }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, k])
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => list.map((args) => feed.now(...args)), [feed, k, tick])
}

type WatchTimes = Pick<Watch, 'id' | 'createdAt' | 'slotAt'>

/** When a place opens for each slot watch, from the server: look a watch up with the returned function (null = not here yet, or never). */
export function useOpenings(watches: readonly WatchTimes[]): (w: WatchTimes) => number | null {
  const [tick, setTick] = useState(0)
  const k = JSON.stringify(watches.map(openingArgs))
  useEffect(() => {
    let live = true
    void Promise.all(watches.map((w) => openingFeed.load(...openingArgs(w)))).then((r) => { if (live && r.some(Boolean)) setTick((n) => n + 1) })
    return () => { live = false }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [k])
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (w) => openingFeed.now(...openingArgs(w))?.opensAt ?? null, [tick])
}
