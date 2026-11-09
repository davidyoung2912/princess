import { createSharedLoader } from '../domain/sharedLoad'
import { useMine, type Mine } from './useMine'
import { usePersona } from './useDemo'

const shared = createSharedLoader()

/** A call shared by key for a person, for hooks that keep their own state (the saved copy of today) but should not repeat a call another screen just made. */
export const sharedCall = <T>(owner: string, key: string, load: () => Promise<T>): Promise<T> => shared(`${owner}:${key}`, load)

/** Forgets every shared call, so the next screen to ask loads fresh. */
export const forgetSharedLoads = (): void => shared.clear()

/**
 * `useMine` for data several screens on one page ask for: concurrent and near-immediate asks for the same key share one call (see `createSharedLoader`). The key is per
 * person. While `enabled` is false nothing is called, nothing is shared and the data is null, so a screen that does not need the data never fills the shared slot with a blank.
 */
export function useSharedMine<T>(key: string, load: () => Promise<T>, enabled = true): Mine<T | null> {
  const owner = usePersona()?.id ?? ''
  return useMine<T | null>(() => (enabled ? shared(`${owner}:${key}`, load) : Promise.resolve(null)), [key, enabled])
}
