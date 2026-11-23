import type { GuideTask, GuideView } from '../../../shared/api/guideTypes'

/** Where a screen sits in the guest's plan: the task it belongs to, and what comes after it. */
export interface Flow {
  task: GuideTask
  /** Position of the task among this stage's own tasks, from 1. */
  n: number
  total: number
  /** The next task to do, after this one, that can be done now; null when there is none. */
  next: GuideTask | null
  /** Tasks still open in the stage, not counting this one. */
  left: number
}

const samePath = (a: string, b: string): boolean => a.split('?')[0] === b.split('?')[0]

/**
 * The guide task a screen belongs to: the one the guest opened it from (`from`, a task id) when that is on this path, else the first task of this stage whose
 * destination is this path. Tasks carried from an earlier stage have no place in "step n of m", so they are not matched by path alone.
 */
export function flowAt(view: GuideView, pathname: string, from?: string | null): Flow | null {
  const own = view.tasks.filter((x) => x.carriedFrom === null)
  const task = (from ? view.tasks.find((x) => x.id === from && samePath(x.to, pathname)) : undefined) ?? own.find((x) => samePath(x.to, pathname))
  if (!task) return null
  const rest = view.tasks.filter((x) => x.id !== task.id && x.state !== 'done')
  return { task, n: own.findIndex((x) => x.id === task.id) + 1 || 1, total: Math.max(own.length, 1), next: rest.find((x) => x.state === 'todo') ?? null, left: rest.length }
}
