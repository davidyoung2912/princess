import { portRows, subscribePortRowStatus } from './portRows'
import { createSync, type Remote, type SyncStatus } from './sync'

let remote: Remote | null = null
const listeners = new Set<() => void>()

/** The one sync manager the stores tell about changes. The runtime gives it a remote only when the app talks to the real API. */
export const sync = createSync({ remote: () => remote, onStatus: () => listeners.forEach((l) => l()) })
export const setRemote = (r: Remote | null): void => { remote = r }

/** Tells a screen when the sync status changes (saving, saved, or waiting for a connection). */
export const subscribeSyncStatus = (listener: () => void): (() => void) => {
  listeners.add(listener)
  const stop = subscribePortRowStatus(listener)
  return () => { listeners.delete(listener); stop() }
}
/** The account's documents and the port day's rows together: an error if either is waiting for the connection. */
export const syncStatus = (): SyncStatus => {
  const [a, b] = [sync.status(), portRows.status()]
  return a === 'error' || b === 'error' ? 'error' : a === 'syncing' || b === 'syncing' ? 'syncing' : 'idle'
}
