import type { ExplorerDay } from '../../../shared/api/explorerTypes'
import type { EventStatus } from './types'

export interface ChangeLine {
  id: string
  venueId: string
  venueTitle: string
  title: string
  status: Exclude<EventStatus, 'on'>
  /** Time after the change "HH:MM", and before it when moved. */
  start: string
  was?: string
  reason?: string
  startAt: number
  /** The guest has this on their plan. */
  mine: boolean
}

/**
 * Every moved or cancelled event on the chosen day for one Explorer, earliest first, the guest's own first among equals of time.
 * Changes already over are dropped on the ship's current day; a past day lists none (it is history).
 */
export function whatChanged(day: ExplorerDay, now: number): ChangeLine[] {
  if (day.currentDay !== undefined && day.day < day.currentDay) return []
  const mine = new Set(day.mine)
  const out: ChangeLine[] = []
  for (const v of day.venues) {
    for (const e of v.events) {
      if (e.status === 'on' || e.endAt <= now) continue
      out.push({ id: e.id, venueId: v.venue.id, venueTitle: v.venue.title, title: e.title, status: e.status, start: e.start, was: e.was, reason: e.reason, startAt: e.startAt, mine: mine.has(e.id) })
    }
  }
  return out.sort((a, b) => a.startAt - b.startAt || Number(b.mine) - Number(a.mine) || a.id.localeCompare(b.id))
}
