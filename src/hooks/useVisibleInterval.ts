import { useEffect } from 'react'
import { useLatest } from './useLatest'
import { startVisibleInterval } from './visibleInterval'
import { batteryNow, watchBattery } from '../data/battery'
import { refreshFactor } from '../domain/nightBefore'

/** Runs `fn` every `ms` while the page is visible and `active` is true; see `startVisibleInterval`. */
export function useVisibleInterval(fn: () => void, ms: number, active = true): void {
  const latest = useLatest(fn)
  useEffect(() => {
    if (!active) return
    // Data-light mode asks for fresh data a quarter as often (NET-04); a low battery that is not charging, half as often (MOB-24).
    const light = typeof document !== 'undefined' && document.documentElement.getAttribute('data-light') === 'on'
    watchBattery()
    return startVisibleInterval(() => latest(), ms * refreshFactor({ dataLight: light, battery: batteryNow() }))
  }, [latest, ms, active])
}
