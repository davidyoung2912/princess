import { useCallback, useSyncExternalStore } from 'react'
import { getHub, subscribeHub, updateHub, type HubState } from '../hub/store'
import { useOwnerId, usePersona } from './useDemo'

export const newHubId = (): string => `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** The signed-in person's Phase H2 state (family-at-home page, delay, callback, follow-ups), and a function to change it. */
export function useHub(): { state: HubState; me: ReturnType<typeof usePersona>; update: (change: (s: HubState) => HubState) => void } {
  const me = usePersona()
  const id = useOwnerId()
  const state = useSyncExternalStore(subscribeHub, () => getHub(id), () => getHub(id))
  const update = useCallback((change: (s: HubState) => HubState) => updateHub(id, change), [id])
  return { state, me, update }
}
