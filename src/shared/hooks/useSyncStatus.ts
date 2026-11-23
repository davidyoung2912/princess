import { useSyncExternalStore } from 'react'
import { subscribeSyncStatus, syncStatus } from '../sync'
import type { SyncStatus } from '../sync/sync'

/** Whether this device's changes are saved to the account: idle (saved), syncing, or error (waiting for the connection). */
export const useSyncStatus = (): SyncStatus => useSyncExternalStore(subscribeSyncStatus, syncStatus, syncStatus)
