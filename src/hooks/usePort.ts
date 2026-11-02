import { useCallback, useSyncExternalStore } from 'react'
import { getPort, subscribePort, updatePort, type PortState } from '../port/store'
import { useOwnerId, usePersona } from './useDemo'

export const newPortId = (): string => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** The booking's Phase H3 state (who is back, the shared plan, meeting places, the split ledger), and a function to change it. */
export function usePort(): { state: PortState; me: ReturnType<typeof usePersona>; update: (change: (s: PortState) => PortState) => void } {
  const me = usePersona()
  const owner = useOwnerId()
  const booker = me?.booker ?? owner
  const state = useSyncExternalStore(subscribePort, () => getPort(booker), () => getPort(booker))
  const update = useCallback((change: (s: PortState) => PortState) => updatePort(booker, change), [booker])
  return { state, me, update }
}
