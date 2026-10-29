import { useCallback, useEffect, useState } from 'react'

export type Async<T> = { status: 'loading'; data: T | null } | { status: 'ready'; data: T } | { status: 'error'; data: T | null; error: unknown }

/**
 * Runs an async call when it first renders and whenever `deps` change, and again on `retry()`. Earlier data stays in
 * `data` while a newer call runs, and an answer from a call that has since been replaced is ignored.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): Async<T> & { retry: () => void } {
  const [state, setState] = useState<Async<T>>({ status: 'loading', data: null })
  const [attempt, setAttempt] = useState(0)
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- the caller lists what `load` depends on
  const run = useCallback(load, deps)
  useEffect(() => {
    let current = true
    setState((s) => ({ status: 'loading', data: s.data }))
    run().then(
      (data) => { if (current) setState({ status: 'ready', data }) },
      (error: unknown) => { if (current) setState((s) => ({ status: 'error', data: s.data, error })) },
    )
    return () => { current = false }
  }, [run, attempt])
  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
