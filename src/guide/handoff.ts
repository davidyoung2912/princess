import type { GuideView } from '../api/guideTypes'
import type { JourneyStage } from '../routes/hubs'
import { progressKey, wasVisited, type StageProgressState } from '../routes/stageProgress'

/** The step number a stage's hand-off is remembered under in the `stageProgress` document: past the welcome's three and the most optional visits a stage has (4 to 6), within the step limit of 9. */
export const HANDOFF_STEP = 9

/** What the hand-off says: the stage, what really moves the guest on, and the first open tasks (at most two, not optional, not waiting or blocked). */
export interface Handoff { stage: JourneyStage; first: string[]; more: number }

/** The hand-off for a stage the guest has not been welcomed to yet, or null when it was seen or there is nothing to do first. */
export function handoffFor(view: GuideView, progress: StageProgressState, sailingId: string | null | undefined): Handoff | null {
  if (wasVisited(progress, view.stage, sailingId, HANDOFF_STEP)) return null
  const ready = view.tasks.filter((x) => x.state === 'todo' && !x.optional && x.carriedFrom === null)
  if (ready.length === 0) return null
  return { stage: view.stage, first: ready.slice(0, 2).map((x) => x.id), more: Math.max(0, ready.length - 2) }
}

/** The key the hand-off is remembered under. */
export const handoffKey = (stage: JourneyStage, sailingId: string | null | undefined): string => progressKey(stage, sailingId, HANDOFF_STEP)
