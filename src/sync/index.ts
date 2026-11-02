import { hasUnsent, subscribeOutbox } from '../data/outbox'
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
  const stopOutbox = subscribeOutbox(listener)
  return () => { listeners.delete(listener); stop(); stopOutbox() }
}
const outboxStore = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }
/**
 * Everything on this device that has not reached the account: the documents, the port day's rows and the outbox of unsent messages and requests. These
 * three are the only stores of unsent changes; everything else on the device is a copy of what the server holds. An error means something is waiting for the connection.
 */
export const syncStatus = (): SyncStatus => {
  const [a, b] = [sync.status(), portRows.status()]
  return a === 'error' || b === 'error' || hasUnsent(outboxStore()) ? 'error' : a === 'syncing' || b === 'syncing' ? 'syncing' : 'idle'
}
