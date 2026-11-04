import { stageAt, stageRank, type StageId } from '../domain/sailings'
import { useNow, useSailing } from './useDemo'

/** Whether the guest has left the ship, so after-the-cruise screens can act. */
export function useSailed(): boolean {
  const stage = stageAt(useSailing(), useNow())
  return stage === 'disembark' || stage === 'postCruise'
}

/** Whether the cruise has reached a stage, such as the farewell day. */
export function useReached(stage: StageId): boolean {
  return stageRank(stageAt(useSailing(), useNow())) >= stageRank(stage)
}
