import type { GuideTask } from '../../../shared/api/guideTypes'
import { buildIcs, type IcsEvent } from '../../../domain/calendar'

/**
 * The day a task goes in the guest's own calendar (docs/next-steps-guidance-plan.md, G9e): the day it opens when it is waiting, otherwise its due day. A done task or one with no date has none.
 * The file is made on the phone and goes nowhere else, so it needs no server and no Stanley.
 */
export function calendarDay(task: Pick<GuideTask, 'state' | 'due' | 'opensAt'>): string | null {
  if (task.state === 'done') return null
  return (task.state === 'waiting' ? task.opensAt : task.due) ?? null
}

/** An all-day event for the task. The id is the task and the day, so adding it twice gives the calendar the same event to replace. */
export function taskCalendarEvent(task: Pick<GuideTask, 'id' | 'state' | 'due' | 'opensAt'>, title: string, why: string, stamp: number): IcsEvent | null {
  const day = calendarDay(task)
  if (!day) return null
  const waiting = task.state === 'waiting'
  return { uid: `guide-${task.id}-${day}@princess`, summary: waiting ? `Opens: ${title}` : title, description: why, location: '', start: day, end: day, stamp }
}

/** The calendar file for the task, or null when it has no day. */
export const taskCalendarFile = (task: Pick<GuideTask, 'id' | 'state' | 'due' | 'opensAt'>, title: string, why: string, stamp: number): string | null => {
  const e = taskCalendarEvent(task, title, why, stamp)
  return e ? buildIcs(e) : null
}
