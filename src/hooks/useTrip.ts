import { useCallback, useSyncExternalStore } from 'react'
import { getTrip, subscribeTrip, updateTrip, type TripState } from '../journey/store'
import { useOwnerId, usePersona } from './useDemo'

export const newTripId = (): string => `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** The signed-in person's Phase H4 state (door-to-ship plan, packing, bag log, embarkation plan), and a function to change it. */
export function useTrip(): { state: TripState; me: ReturnType<typeof usePersona>; update: (change: (s: TripState) => TripState) => void } {
  const me = usePersona()
  const id = useOwnerId()
  const state = useSyncExternalStore(subscribeTrip, () => getTrip(id), () => getTrip(id))
  const update = useCallback((change: (s: TripState) => TripState) => updateTrip(id, change), [id])
  return { state, me, update }
}
