import { useCallback, useSyncExternalStore } from 'react'
import { getMemory, subscribeMemory, updateMemory, type MemoryState } from '../memory/store'
import { usePersona } from './useDemo'

export const newMemoryId = (): string => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** The signed-in person's Phase H6 state (journal, reflections, contacts, choices), and a function to change it. */
export function useMemory(): { state: MemoryState; me: ReturnType<typeof usePersona>; update: (change: (s: MemoryState) => MemoryState) => void } {
  const me = usePersona()
  const id = me?.id ?? null
  const state = useSyncExternalStore(subscribeMemory, () => getMemory(id), () => getMemory(id))
  const update = useCallback((change: (s: MemoryState) => MemoryState) => updateMemory(id, change), [id])
  return { state, me, update }
}
