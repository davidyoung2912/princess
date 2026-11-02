import { useEffect, useMemo, useState } from 'react'
import { demoNow } from '../demo/store'
import { cacheGet, cachePut } from '../domain/offlineCache'
import { useAsync } from './useAsync'

const storage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

/** How long a load may take before a kept copy is shown in its place (a slow or silent link must not leave a boarding pass behind a spinner). */
export const SLOW_COPY_MS = 1500

export interface SavedCopy<T> {
  data: T | null
  status: 'loading' | 'ready' | 'error'
  /** The data is the copy kept on this phone, because the live call failed or is taking too long. */
  fromCopy: boolean
  /** When the data shown was fetched (or saved, for a copy), on the demo clock. */
  at: number | null
  retry: () => void
}

/**
 * Loads something the guest must be able to open with no signal. Every good answer is kept on the phone; if a later
 * call fails and a copy exists, the copy is shown (with its age) instead of an error (CHK-04, CHK-13, CHK-14).
 */
export function useSavedCopy<T>(kind: string, key: string, load: () => Promise<T>, check: (raw: unknown) => T | null, deps: readonly unknown[] = []): SavedCopy<T> {
  const state = useAsync(load, [key, ...deps])
  const fresh = state.status === 'ready' ? state.data : null
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    setSlow(false)
    if (state.status !== 'loading') return undefined
    const id = setTimeout(() => setSlow(true), SLOW_COPY_MS)
    return () => clearTimeout(id)
  }, [state.status, kind, key])
  // The moment a fresh answer arrived; it changes only when a new answer does.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- re-stamped only when the data changes
  const fetchedAt = useMemo(() => (fresh === null ? null : demoNow()), [fresh])
  useEffect(() => {
    if (fresh !== null && fetchedAt !== null) cachePut(storage(), kind, key, fresh, fetchedAt)
  }, [fresh, fetchedAt, kind, key])
  if (state.status === 'ready') return { data: state.data, status: 'ready', fromCopy: false, at: fetchedAt, retry: state.retry }
  if (state.status === 'error') {
    const copy = cacheGet(storage(), kind, key, check, demoNow())
    if (copy) return { data: copy.value, status: 'ready', fromCopy: true, at: copy.savedAt, retry: state.retry }
    return { data: null, status: 'error', fromCopy: false, at: null, retry: state.retry }
  }
  if (slow) {
    const copy = cacheGet(storage(), kind, key, check, demoNow())
    if (copy) return { data: copy.value, status: 'ready', fromCopy: true, at: copy.savedAt, retry: state.retry }
  }
  return { data: null, status: 'loading', fromCopy: false, at: null, retry: state.retry }
}
