import type { JourneyStage } from '../routes/hubs'

/** Why a task is urgent now. The same five reasons the speech dot and Stanley's next sentence have always used. */
export type GuideReason = 'payment' | 'checkin' | 'documents' | 'muster' | 'bags'

export type GuideState = 'todo' | 'blocked' | 'waiting' | 'done'
export type GuideUrgency = 'now' | 'soon' | 'later' | 'none'

/** How we know a task is done: the app can see it (data), the guest ticked it (tick), or the guest opened its screen (visit). */
export type GuideDoneBy = 'data' | 'tick' | 'visit'

/**
 * One thing the guest could do now (docs/next-steps-guidance-plan.md section 3.1). The words are the client's, by task id: `guide.<id>.title` and `guide.<id>.why`.
 * `hard` means a real deadline: it may be put off, never hidden. `carriedFrom` is the earlier stage a task still open belongs to.
 */
export interface GuideTask {
  id: string
  stage: JourneyStage
  /** Where to do it. Always set. */
  to: string
  state: GuideState
  urgency: GuideUrgency
  urgencyReason: GuideReason | null
  /** "YYYY-MM-DD", and where the date comes from (`booking` or `checklist`). */
  due: string | null
  dueSource: 'booking' | 'checklist' | null
  /** For a waiting task: the date it opens. */
  opensAt: string | null
  minutes: number
  hard: boolean
  optional: boolean
  doneBy: GuideDoneBy
  /** For a blocked task: the id of the task to finish first. */
  blockedBy: string | null
  carriedFrom: JourneyStage | null
}

export interface GuideView {
  stage: JourneyStage
  /** The task to do first, or null when nothing is open to do. */
  primaryId: string | null
  /** Open tasks first (by urgency, required before optional), then waiting, then done. */
  tasks: GuideTask[]
  /** What really moves the guest to the next stage; `date` is set when there is one. The words are `guide.moveOn.<stage>`. */
  moveOn: { stage: JourneyStage; date: string | null }
  counts: { done: number; total: number; open: number }
}

export interface GuideApi {
  /** The guest's plan for the stage they are in, worked out by the server on every read. */
  get(): Promise<GuideView>
}
