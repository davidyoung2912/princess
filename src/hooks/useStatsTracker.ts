import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { api } from '../runtime'
import { createTracker } from '../stats/tracker'
import { startVisibleInterval } from './visibleInterval'

/** How often active time is counted, how long after the last touch the guest still counts as active, and how often the counts are sent. */
const TICK_MS = 10_000
const IDLE_MS = 60_000
const SEND_MS = 60_000
const OPENED = 'princess.stats.opened'

const tracker = createTracker()

/** Counts what the signed-in guest does (screens, time in the app, hour of day) and sends it to the server now and then, for the stats page. Failures are dropped quietly: a stat is never worth bothering anyone about. */
export function useStatsTracker(): void {
  const { pathname } = useLocation()

  useEffect(() => { tracker.view(pathname) }, [pathname])

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(OPENED)) { sessionStorage.setItem(OPENED, '1'); tracker.opened() }
    } catch { tracker.opened() }
    let lastInput = Date.now()
    const touch = (): void => { lastInput = Date.now() }
    const send = (): void => {
      const batch = tracker.take()
      if (batch) api.stats.track(batch.day, batch.counters).catch(() => tracker.restore(batch))
    }
    // Both run only while the page is visible; a hidden page is sent by the visibility handler below.
    const stopTick = startVisibleInterval(() => { if (Date.now() - lastInput < IDLE_MS) tracker.active(TICK_MS / 1000) }, TICK_MS)
    const stopFlush = startVisibleInterval(send, SEND_MS)
    const onHide = (): void => { if (document.visibilityState === 'hidden') send() }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    for (const e of events) window.addEventListener(e, touch, { passive: true })
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', send)
    return () => {
      stopTick()
      stopFlush()
      for (const e of events) window.removeEventListener(e, touch)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', send)
      send()
    }
  }, [])
}

/** Counts a share of a stat, from outside a component. */
export const countShare = (): void => tracker.shared()
