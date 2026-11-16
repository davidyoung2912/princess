import type { TimedEvent } from './types'

/** How long after an event ends it still shows on today's venue cards. */
export const GRACE_MINUTES = 15
/** How many events a venue card lists. */
export const MAX_UPCOMING = 3

export type DayPhase = 'past' | 'current' | 'future'

/** Whether the chosen cruise day is behind, on, or ahead of the ship's day. */
export const dayPhase = (chosenDay: number, currentDay: number): DayPhase => (chosenDay < currentDay ? 'past' : chosenDay > currentDay ? 'future' : 'current')

export type EventPhase = 'now' | 'next' | 'later' | 'justEnded' | 'over'

const MIN = 60_000

/** Where an event is relative to now: in progress, not yet started, ended within the grace, or over. Cancelled events are 'over' only if their time has passed, else 'later'. */
export function eventPhase(e: Pick<TimedEvent, 'startAt' | 'endAt'>, now: number, graceMinutes = GRACE_MINUTES): EventPhase {
  if (e.startAt > now) return 'later'
  if (now < e.endAt) return 'now'
  return now - e.endAt <= graceMinutes * MIN ? 'justEnded' : 'over'
}

export interface UpcomingOptions {
  chosenDay: number
  currentDay: number
  now: number
  graceMinutes?: number
  max?: number
}

/**
 * The events a venue card lists (the brief): on the ship's current day, events not yet over, and those that ended no more than the grace ago;
 * on a future day, the day's events from the start; on a past day, none. Cancelled events never count. Earliest first, at most `max`.
 */
export function upcomingEvents<E extends TimedEvent>(events: readonly E[], o: UpcomingOptions): E[] {
  const phase = dayPhase(o.chosenDay, o.currentDay)
  if (phase === 'past') return []
  const grace = o.graceMinutes ?? GRACE_MINUTES
  const keep = events.filter((e) => e.status !== 'cancelled' && (phase === 'future' || eventPhase(e, o.now, grace) !== 'over'))
  return keep.sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt || a.id.localeCompare(b.id)).slice(0, o.max ?? MAX_UPCOMING)
}
