import { useEffect } from 'react'
import { useLatest } from './useLatest'
import { startVisibleInterval } from './visibleInterval'

/** Runs `fn` every `ms` while the page is visible and `active` is true; see `startVisibleInterval`. */
export function useVisibleInterval(fn: () => void, ms: number, active = true): void {
  const latest = useLatest(fn)
  useEffect(() => {
    if (!active) return
    return startVisibleInterval(() => latest(), ms)
  }, [latest, ms, active])
}
