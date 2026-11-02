import { useMemo, useState, useSyncExternalStore } from 'react'
import { getContext, personFrom, subscribeContext } from '../account/context'
import { sailingFor } from '../account/sailing'
import { auth } from '../runtime'
import { ownerIdOf } from '../auth/provider'
import { demoNow, getDemo, subscribeDemo } from '../demo/store'
import type { Sailing } from '../domain/sailings'
import { personaById, type Person } from '../domain/personas'
import type { DemoState } from '../demo/state'
import { useVisibleInterval } from './useVisibleInterval'

/** The demo controls (clock, scenarios, network). */
export function useDemo(): DemoState {
  return useSyncExternalStore(subscribeDemo, getDemo, getDemo)
}

/** The sailing the app is on: a real account's current trip, or the sailing a demo account chose (kept by the server). */
export function useSailing(): Sailing {
  const demo = useDemo()
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  return sailingFor(context, demo.sailingId, demoNow())
}

/** "Now": the server's time for a real account, the demo clock for a demo account; refreshed every second while the page is visible. */
export function useNow(): number {
  const [now, setNow] = useState(demoNow)
  useVisibleInterval(() => setNow(demoNow()), 1000)
  return now
}

/** The signed-in person, or null: a demo persona, or for a real account the person the server describes (`/me/context`). */
export function usePersona(): Person | null {
  const session = useSyncExternalStore(auth.subscribe, auth.current, auth.current)
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  const persona = personaById(session?.personaId)
  return useMemo(() => persona ?? (context && session && context.person.id.toLowerCase() === (session.user?.id ?? '').toLowerCase() ? personFrom(context) : null), [persona, context, session])
}

/** The id the signed-in person's stores are keyed by: the persona, or the user id for an account that is not a persona. Null when signed out. */
export function useOwnerId(): string | null {
  return ownerIdOf(useSyncExternalStore(auth.subscribe, auth.current, auth.current))
}
