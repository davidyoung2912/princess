import { useCallback, useState } from 'react'
import { bounded } from '../api/bounded'
import { ApiError, isApiError } from '../api/errors'
import { useLatest } from './useLatest'
import { playCue } from '../sound/cues'

export interface Action<A extends unknown[], R> {
  run: (...args: A) => Promise<R | undefined>
  busy: boolean
  error: ApiError | null
  clear: () => void
}

/** Runs a change (save, pay, link) and tracks whether it is running and why it failed. `run` resolves to undefined on failure. It plays a quiet confirmation click when the guest's action works or fails, unless `quiet` (payment and safety screens). */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: { quiet?: boolean } = {}): Action<A, R> {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const latest = useLatest(fn)
  const run = useCallback(async (...args: A) => {
    setBusy(true)
    setError(null)
    try {
      const result = await bounded(Promise.resolve().then(() => latest(...args)))
      if (!opts.quiet) playCue('confirm')
      return result
    } catch (e) {
      if (!opts.quiet) playCue('no')
      setError(isApiError(e) ? e : new ApiError('server'))
      return undefined
    } finally {
      setBusy(false)
    }
  }, [latest, opts.quiet])
  return { run, busy, error, clear: () => setError(null) }
}
