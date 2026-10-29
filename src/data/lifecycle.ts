import { DEMO_KEY } from '../demo/state'
import type { DataStore } from './store'

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

/** "Reset demo": all saved records and the demo controls go back to first-run. Display settings and who is signed in are kept. */
export async function resetDemo(store: DataStore, local: KeyValueStorage | null): Promise<void> {
  await store.clear()
  local?.removeItem(DEMO_KEY)
}

/** "Wipe everything": every record, setting, session and the database itself. */
export async function wipeEverything(opts: { store: DataStore | null; deleteDatabase: () => Promise<void>; local: KeyValueStorage | null; session: KeyValueStorage | null }): Promise<void> {
  opts.store?.close()
  removeAppKeys(opts.local)
  removeAppKeys(opts.session)
  await opts.deleteDatabase()
}
