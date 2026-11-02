import { JOURNEY_OF_STAGE, type JourneyStage } from '../routes/hubs'
import { stageAt } from '../domain/sailings'
import { useNow, useSailing } from './useDemo'

/** Where the guest is in their trip, as one of the eleven journey stages. */
export function useJourneyStage(): JourneyStage {
  return JOURNEY_OF_STAGE[stageAt(useSailing(), useNow())]
}
