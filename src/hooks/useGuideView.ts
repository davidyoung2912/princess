import { useMemo, useSyncExternalStore } from 'react'
import { getContext, subscribeContext } from '../account/context'
import { withVisits } from '../guide/visits'
import { getProgress, subscribeProgress } from '../stageProgress/store'
import { useGuide } from './useGuide'
import { useJourneyPosition } from './useJourneyPosition'

/** The guide with the guest's visits laid over it: what every surface (Home, the landing card, the strip, Stanley, the welcome) reads, so they cannot disagree. */
export function useGuideView() {
  const guide = useGuide()
  const { focusSailingId } = useJourneyPosition()
  const personId = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  const visits = useSyncExternalStore(subscribeProgress, () => getProgress(personId), () => getProgress(personId))
  const view = useMemo(() => (guide.data ? withVisits(guide.data, visits, focusSailingId) : null), [guide.data, visits, focusSailingId])
  return { ...guide, data: view }
}
