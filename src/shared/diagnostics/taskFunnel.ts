import { screenName } from './telemetry'
import { MAX_TAPS, TOP_TASKS, type TaskDef } from '../../app/routes/nav'

/**
 * How the top tasks go (research section 8: "successful completion rate for the top 10 passenger tasks", "time to locate a booking"). Counts only which screens were opened and when:
 * no person, booking or typed text. It stays on the phone and is read in Diagnostics; nothing here is sent. A baseline for the old app is a separate job (docs/pain-points-measures.md).
 */
export const VISITS_KEY = 'princess:task-visits'
export const MAX_VISITS = 400

/** One screen opened. `screen` is null for Home (or any screen with no safe name), which ends a task attempt. */
export interface TaskVisit { screen: string | null; at: number }

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function readVisits(store: Store | null): TaskVisit[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(VISITS_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is TaskVisit => !!v && typeof v.at === 'number' && (v.screen === null || typeof v.screen === 'string')).slice(-MAX_VISITS)
  } catch { return [] }
}

/** Notes that a screen was opened; the oldest visits drop out past the cap. */
export function noteVisit(store: Store | null, path: string, at: number): void {
  if (!store) return
  try {
    const screen = path === '/' ? null : screenName(path) ?? null
    store.setItem(VISITS_KEY, JSON.stringify([...readVisits(store), { screen, at }].slice(-MAX_VISITS)))
  } catch { /* full or blocked: measuring must never cause a problem */ }
}

export const clearVisits = (store: Store | null): void => { try { store?.removeItem(VISITS_KEY) } catch { /* ignore */ } }

export interface TaskStat {
  id: string
  /** Times the task's first screen was opened. */
  opened: number
  /** Of those, how many reached its last screen within the two-tap rule before the guest went Home. */
  reached: number
  /** Median seconds from the first screen to the last, over those that reached it; null when none did. */
  medianSeconds: number | null
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2]! : Math.round((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2)
}

/**
 * For each task with a screen path (those reached only through the Help button are left out): an attempt starts when its first screen opens; it is reached when its last screen
 * opens within the next `MAX_TAPS` screens with no Home in between. A one-screen task is reached as soon as it opens.
 */
export function taskFunnel(visits: readonly TaskVisit[], tasks: readonly TaskDef[] = TOP_TASKS): TaskStat[] {
  const stats: TaskStat[] = []
  for (const task of tasks) {
    const steps = task.taps.filter((s) => s !== 'help').map((s) => (s === '/' ? null : screenName(s) ?? null))
    if (steps.length === 0 || steps.length !== task.taps.length) continue
    const first = steps[0]!
    const last = steps[steps.length - 1]!
    if (steps[0] === null) continue
    let opened = 0
    let reached = 0
    const seconds: number[] = []
    visits.forEach((v, i) => {
      if (v.screen !== first) return
      opened++
      if (steps.length === 1) { reached++; seconds.push(0); return }
      for (let j = i + 1; j < visits.length && j <= i + MAX_TAPS; j++) {
        if (visits[j]!.screen === null) return
        if (visits[j]!.screen === last) { reached++; seconds.push(Math.max(0, Math.round((visits[j]!.at - v.at) / 1000))); return }
      }
    })
    stats.push({ id: task.id, opened, reached, medianSeconds: median(seconds) })
  }
  return stats
}
