import { useMemo, useSyncExternalStore } from 'react'
import { getContext, subscribeContext } from '../../features/account/logic/context'
import { applyChoices } from '../../features/guide/logic/choices'
import { getChoices, subscribeChoices } from '../../features/guide/logic/choicesStore'
import { withVisits } from '../../features/guide/logic/visits'
import { isoDay } from '../../domain/rates'
import { demoNow } from '../../features/demo/logic/store'
import { getProgress, subscribeProgress } from '../../app/stageProgress/store'
import { useGuide } from './useGuide'
import { useJourneyPosition } from './useJourneyPosition'

/** The guide with the guest's visits laid over it: with what the guest put aside left out: what every surface (Home, the landing card, the strip, Stanley, the welcome) reads, so they cannot disagree. */
export function useGuideView() {
  const guide = useGuide()
  const { focusSailingId } = useJourneyPosition()
  const personId = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  const visits = useSyncExternalStore(subscribeProgress, () => getProgress(personId), () => getProgress(personId))
  const choices = useSyncExternalStore(subscribeChoices, () => getChoices(personId), () => getChoices(personId))
  const view = useMemo(() => (guide.data ? applyChoices(withVisits(guide.data, visits, focusSailingId), choices, isoDay(demoNow())) : null), [guide.data, visits, focusSailingId, choices])
  return { ...guide, data: view }
}
