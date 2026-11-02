import { useCallback, useSyncExternalStore } from 'react'
import type { Sharing } from '../domain/partyShare'
import { getSharing, subscribeSharing, updateSharing } from '../sharing/store'
import { useOwnerId, usePersona } from './useDemo'

/** What this person shares with the rest of their party, and a way to change one switch. Everything is off until they turn it on. */
export function useSharing(): { sharing: Sharing; set: (facet: keyof Sharing, on: boolean) => void } {
  const me = usePersona()
  const owner = useOwnerId()
  const id = me?.id ?? owner
  const sharing = useSyncExternalStore(subscribeSharing, () => getSharing(id), () => getSharing(id))
  const set = useCallback((facet: keyof Sharing, on: boolean) => updateSharing(id, (s) => ({ ...s, [facet]: on })), [id])
  return { sharing, set }
}
