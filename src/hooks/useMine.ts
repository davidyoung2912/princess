import { useAsync, type Async } from './useAsync'
import { usePersona } from './useDemo'

export type Mine<T> = Async<T> & { retry: () => void }

/**
 * Like `useAsync`, for data that belongs to the signed-in person: it reloads when they change, and never shows the
 * previous person's data while the new person's loads.
 */
export function useMine<T>(load: () => Promise<T>, deps: readonly unknown[] = []): Mine<T> {
  const owner = usePersona()?.id ?? ''
  const state = useAsync(async () => ({ owner, value: await load() }), [owner, ...deps])
  const mine = state.data && state.data.owner === owner ? state.data.value : null
  const base = { retry: state.retry }
  if (state.status === 'ready' && mine !== null) return { ...base, status: 'ready', data: mine }
  if (state.status === 'error') return { ...base, status: 'error', data: mine, error: state.error }
  return { ...base, status: 'loading', data: mine }
}
