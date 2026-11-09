import { useCallback, useMemo } from 'react'
import { api } from '../runtime'
import { forYouIds, orderForParty, priorityIds } from '../domain/tileOrder'
import { useSharedMine } from './useSharedMine'

/** Functions that put the screens that matter to this party first (`order`) and pick the few for the "For you" list (`forYou`). Until the party is known (or if it cannot be loaded) it changes nothing. */
export function usePartyOrder(enabled: boolean): { order: (ids: readonly string[]) => string[]; forYou: (ids: readonly string[]) => string[] } {
  const view = useSharedMine('plan.assistance', () => api.plan.assistance.get(), enabled)
  const data = view.data
  const priority = useMemo(() => (data ? priorityIds({ ages: data.party.map((p) => p.age), mobility: Object.values(data.needs).some((n) => n?.includes('mobility')) }) : []), [data])
  const order = useCallback((ids: readonly string[]) => orderForParty(ids, priority), [priority])
  const forYou = useCallback((ids: readonly string[]) => forYouIds(ids, priority, 3), [priority])
  return { order, forYou }
}
