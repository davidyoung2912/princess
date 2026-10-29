import { useState, useSyncExternalStore } from 'react'
import { auth } from '../runtime'
import { demoNow, getDemo, subscribeDemo } from '../demo/store'
import { sailingById, type Sailing } from '../domain/sailings'
import { personaById, type Persona } from '../domain/personas'
import type { DemoState } from '../demo/state'
import { useVisibleInterval } from './useVisibleInterval'

/** The demo controls (clock, scenarios, network). */
export function useDemo(): DemoState {
  return useSyncExternalStore(subscribeDemo, getDemo, getDemo)
}

/** The sailing the demo is on. */
export function useSailing(): Sailing {
  return sailingById(useDemo().sailingId)!
}

/** The demo clock's "now", refreshed every second while the page is visible. */
export function useNow(): number {
  const [now, setNow] = useState(demoNow)
  useVisibleInterval(() => setNow(demoNow()), 1000)
  return now
}

/** The signed-in person, or null. */
export function usePersona(): Persona | null {
  const session = useSyncExternalStore(auth.subscribe, auth.current, auth.current)
  return personaById(session?.personaId) ?? null
}
