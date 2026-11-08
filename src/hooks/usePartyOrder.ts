import { useCallback, useMemo } from 'react'
import { api } from '../runtime'
import { orderForParty, priorityIds } from '../domain/tileOrder'
import { useMine } from './useMine'

/** A function that puts the screens that matter to this party first. Until the party is known (or if it cannot be loaded) it changes nothing. */
export function usePartyOrder(enabled: boolean): (ids: readonly string[]) => string[] {
  const view = useMine(() => (enabled ? api.plan.assistance.get() : Promise.resolve(null)), [enabled])
  const data = view.data
  const priority = useMemo(() => (data ? priorityIds({ ages: data.party.map((p) => p.age), mobility: Object.values(data.needs).some((n) => n?.includes('mobility')) }) : []), [data])
  return useCallback((ids: readonly string[]) => orderForParty(ids, priority), [priority])
}
