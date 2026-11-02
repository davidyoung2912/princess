import { DEMO_KEY } from '../demo/state'

/** The part of Storage these functions need; localStorage, sessionStorage and test fakes all fit. */
export interface KeyValueStorage {
  readonly length: number
  key(index: number): string | null
  removeItem(key: string): void
}

export const APP_PREFIX = 'princess:'

/** Removes every app key from a storage, leaving other sites' and tools' keys alone. */
export function removeAppKeys(storage: KeyValueStorage | null, except: readonly string[] = []): void {
  if (!storage) return
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k?.startsWith(APP_PREFIX) && !except.includes(k)) keys.push(k)
  }
  keys.forEach((k) => storage.removeItem(k))
}

/** "Reset demo": the demo controls go back to first-run. */
export async function resetDemo(local: KeyValueStorage | null): Promise<void> {
  local?.removeItem(DEMO_KEY)
}

/** "Wipe everything": every setting and session kept on this device. */
export function wipeEverything(opts: { local: KeyValueStorage | null; session: KeyValueStorage | null }): void {
  removeAppKeys(opts.local)
  removeAppKeys(opts.session)
}
