import type { GuideTask, GuideView } from '../api/guideTypes'
import { addDays } from '../domain/timezones'
import { SCREEN_LIST } from '../routes/screens'
import { primaryOf } from './view'

/** The most days ahead a reminder can be set (the server refuses beyond 30; one day less keeps a clear margin). */
export const REMIND_MAX_DAYS = 29
/** The hour a task reminder is set for, on the ship's clock. */
export const REMIND_AT = '09:00'

/** What Stanley says when asked "What should I do now?": always the guide's own first task, so it matches Home. Null when nothing is open. */
export function nowTask(view: GuideView | null): GuideTask | null {
  return view ? primaryOf(view) : null
}

/** The screen id a task's destination is, so Stanley's library entries for that screen can answer "Help me with this". Null when the path is not a known screen. */
export function helpScreenId(task: Pick<GuideTask, 'to'>): string | null {
  const path = task.to.split('?')[0]
  return SCREEN_LIST.find((s) => s.path === path)?.id ?? null
}

/**
 * The day a "Remind me" for a task is set for, as yyyy-MM-dd, or null when no reminder makes sense. A task that opens later (check-in) reminds on the day it opens; a task with a due
 * date reminds the day before (or on the day when that is tomorrow and the day before is today). Done tasks, tasks with no date, and days that are not in the future or are beyond
 * the limit give null. `today` is yyyy-MM-dd.
 */
export function remindDay(task: Pick<GuideTask, 'state' | 'due' | 'opensAt'>, today: string): string | null {
  if (task.state === 'done') return null
  const limit = addDays(today, REMIND_MAX_DAYS)
  const fits = (d: string): boolean => d > today && d <= limit
  if (task.state === 'waiting' && task.opensAt) return fits(task.opensAt) ? task.opensAt : null
  if (!task.due) return null
  const before = addDays(task.due, -1)
  if (fits(before)) return before
  return fits(task.due) ? task.due : null
}

/** The arguments `POST /me/stanley/actions/prepare` takes for a clock reminder at 09:00 on a day. The words are the task's title, cut to the server's limit. */
export function taskRemindArgs(day: string, title: string): Record<string, string> {
  return { when: 'clock', at: REMIND_AT, date: day, text: title.slice(0, 80) }
}
