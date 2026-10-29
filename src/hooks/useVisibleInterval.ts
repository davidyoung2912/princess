import { useEffect } from 'react'
import { useLatest } from './useLatest'
import { startVisibleInterval } from './visibleInterval'

/** Runs `fn` every `ms` while the page is visible and `active` is true; see `startVisibleInterval`. */
export function useVisibleInterval(fn: () => void, ms: number, active = true): void {
  const latest = useLatest(fn)
  useEffect(() => {
    if (!active) return
    // Data-light mode asks for fresh data a quarter as often (NET-04).
    const light = typeof document !== 'undefined' && document.documentElement.getAttribute('data-light') === 'on'
    return startVisibleInterval(() => latest(), light ? ms * 4 : ms)
  }, [latest, ms, active])
}
