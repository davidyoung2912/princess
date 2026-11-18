import type { GuideTask, GuideView } from '../api/guideTypes'
import { addDays } from '../domain/timezones'
import { SCREEN_LIST } from '../routes/screens'
import type { StanleyLevel } from '../settings/settings'
import { GUIDE_DO_IT, type GuideDoIt } from '../api/guideTypes'
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

/**
 * Whether Stanley offers "Do it for me" on a task. The server says what he can do (`doIt`, only when there is something to do); the guest's Stanley level says how loudly. On Home's "Do this now"
 * he offers it at Helpful and Chatty and stays quiet at Asked and Off; in his own answer to "What should I do now?" (the guest asked) he also offers it at Asked. Never at Off, never as a push.
 */
export function doItFor(task: Pick<GuideTask, 'state' | 'doIt'>, level: StanleyLevel, where: 'home' | 'asked'): GuideDoIt | null {
  if (task.state !== 'todo' || !task.doIt || !GUIDE_DO_IT.includes(task.doIt)) return null
  if (level === 'off') return null
  if (where === 'home' && level === 'asked') return null
  return task.doIt
}

/** The arguments the first preview of a "Do it for me" action takes. Most need none; the dinner asks for tonight's table and lets the server pick the time. */
export function doItArgs(kind: GuideDoIt): Record<string, string> {
  return kind === 'reserve_dinner' ? { tonight: '1' } : {}
}

/** A tour Stanley offers instead of the one he previewed: its id and name. */
export interface TourChoice { id: string; name: string }

/**
 * The other tours that fit today, from a prepared "plan today in port" preview (the server writes them as `alt1`, `alt2` with `id|name`). Anything else is dropped, at most two, so a
 * preview can only offer tours the server named.
 */
export function tourChoices(params: Readonly<Record<string, string>>): TourChoice[] {
  const out: TourChoice[] = []
  for (const key of ['alt1', 'alt2']) {
    const [id, ...rest] = (params[key] ?? '').split('|')
    const name = rest.join('|').trim()
    if (id && /^[A-Za-z0-9._-]{1,40}$/.test(id) && name) out.push({ id, name: name.slice(0, 120) })
  }
  return out
}
