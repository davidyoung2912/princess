import { useSyncExternalStore } from 'react'
import { readUnsent, subscribeOutbox } from '../data/outbox'

/** How many actions on this device are waiting to be sent (MNG-03). */
export const usePendingCount = (): number => useSyncExternalStore(subscribeOutbox, readUnsent, () => 0)
