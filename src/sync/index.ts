import { createSync, type Remote, type SyncStatus } from './sync'

let remote: Remote | null = null
const listeners = new Set<() => void>()

/** The one sync manager the stores tell about changes. The runtime gives it a remote only when the app talks to the real API. */
export const sync = createSync({ remote: () => remote, onStatus: () => listeners.forEach((l) => l()) })
export const setRemote = (r: Remote | null): void => { remote = r }

/** Tells a screen when the sync status changes (saving, saved, or waiting for a connection). */
export const subscribeSyncStatus = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const syncStatus = (): SyncStatus => sync.status()
