import { useCallback, useState } from 'react'
import { bounded } from '../api/bounded'
import { ApiError, isApiError } from '../api/errors'
import { useLatest } from './useLatest'

export interface Action<A extends unknown[], R> {
  run: (...args: A) => Promise<R | undefined>
  busy: boolean
  error: ApiError | null
  clear: () => void
}

/** Runs a change (save, pay, link) and tracks whether it is running and why it failed. `run` resolves to undefined on failure. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>): Action<A, R> {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const latest = useLatest(fn)
  const run = useCallback(async (...args: A) => {
    setBusy(true)
    setError(null)
    try {
      return await bounded(Promise.resolve().then(() => latest(...args)))
    } catch (e) {
      setError(isApiError(e) ? e : new ApiError('server'))
      return undefined
    } finally {
      setBusy(false)
    }
  }, [latest])
  return { run, busy, error, clear: () => setError(null) }
}
