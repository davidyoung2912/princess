import { isDayKindOn, type DayShape } from '../../../domain/dayKinds'
import type { HoursRule, Window } from './types'

const mins = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const clock = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export interface ResolvedHours {
  /** The windows the venue is open, in time order; empty when closed all day. */
  windows: Window[]
  /** Windows with staff on duty, when that differs from opening (a 24-hour gym). */
  staffed: Window[]
  /** Why the venue is closed all day, for the badge. */
  closedBecause: 'alongside' | 'none' | null
}

/**
 * The hours of a venue on one cruise day. `days` is the sailing's days, `day` the one asked about, `sailawayTime` the ship-time "HH:MM" the ship sails that day
 * (null at sea, or when unknown). A `sailaway` rule on a day with no sailing time is closed. No matching rule means closed, never open: an unknown is not a promise.
 */
export function resolveHours(rules: readonly HoursRule[], days: readonly DayShape[], day: number, sailawayTime: string | null): ResolvedHours {
  const rule = rules.find((r) => r.when.some((k) => isDayKindOn(days, day, k)))
  if (!rule || rule.kind === 'closed') return { windows: [], staffed: [], closedBecause: rule ? 'alongside' : 'none' }
  if (rule.kind === 'fixed') return { windows: sorted(rule.windows), staffed: sorted(rule.staffed ?? []), closedBecause: null }
  if (!sailawayTime) return { windows: [], staffed: [], closedBecause: 'alongside' }
  const from = mins(sailawayTime) + rule.afterMinutes
  const to = mins(rule.until)
  return from >= to ? { windows: [], staffed: [], closedBecause: 'alongside' } : { windows: [[clock(from), rule.until]], staffed: [], closedBecause: null }
}

const sorted = (w: readonly Window[]): Window[] => [...w].sort((a, b) => mins(a[0]) - mins(b[0]))
