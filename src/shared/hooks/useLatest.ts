import { useCallback, useEffect, useRef } from 'react'

/**
 * A function with a stable identity that always calls the latest `fn`. Effects and memoised
 * children can depend on it without going stale or re-running every render.
 */
export function useLatest<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  return useCallback((...args: A) => ref.current(...args), [])
}
