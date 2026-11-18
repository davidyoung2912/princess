import { useMemo, useSyncExternalStore } from 'react'
import { getContext, subscribeContext } from '../account/context'
import { applyChoices } from '../guide/choices'
import { getChoices, subscribeChoices } from '../guide/choicesStore'
import { withVisits } from '../guide/visits'
import { isoDay } from '../domain/rates'
import { demoNow } from '../demo/store'
import { getProgress, subscribeProgress } from '../stageProgress/store'
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
