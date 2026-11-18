import type { GuideTask, GuideView } from '../api/guideTypes'
import type { JourneyStage } from '../routes/hubs'

/** A task for tests, with the fields a test does not care about filled in. */
export const task = (id: string, over: Partial<GuideTask> = {}): GuideTask => ({
  id, stage: id.split('.')[0] as JourneyStage, to: '/x', state: 'todo', urgency: 'none', urgencyReason: null, due: null, dueSource: null, opensAt: null,
  minutes: 5, hard: false, optional: false, doneBy: 'data', blockedBy: null, carriedFrom: null, ...over,
})

/** A guide for tests: the tasks as given (already in order), with the primary and counts worked out as the server does. */
export function guide(stage: JourneyStage, tasks: GuideTask[]): GuideView {
  const own = tasks.filter((x) => x.carriedFrom === null)
  return {
    stage, primaryId: tasks.find((x) => x.state === 'todo')?.id ?? null, tasks, moveOn: { stage, date: null },
    counts: { done: own.filter((x) => x.state === 'done').length, total: own.length, open: tasks.filter((x) => x.state !== 'done').length },
    hidden: [], deferred: [],
  }
}
