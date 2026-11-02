import { useCallback, useSyncExternalStore } from 'react'
import { getPilot, subscribePilot, updatePilot, type PilotState } from '../pilot/store'
import { useOwnerId, usePersona } from './useDemo'

export const newPilotId = (): string => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** The signed-in person's Phase H5 state (plan changes and log, slot watches, week preferences, inclusion settings), and a function to change it. */
export function usePilot(): { state: PilotState; me: ReturnType<typeof usePersona>; update: (change: (s: PilotState) => PilotState) => void } {
  const me = usePersona()
  const id = useOwnerId()
  const state = useSyncExternalStore(subscribePilot, () => getPilot(id), () => getPilot(id))
  const update = useCallback((change: (s: PilotState) => PilotState) => updatePilot(id, change), [id])
  return { state, me, update }
}
