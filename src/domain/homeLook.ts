import { JOURNEY_STAGES, type JourneyStage } from '../routes/hubs'

/** Pure helpers for the L3 Home look (docs/look-and-feel-recommendations.md, 5.4, 5.5, 6.1, 6.4). */

/** Where a stage sits on the voyage line: its place among the stages and how far along the route that is (0 to 100). */
export function voyagePosition(stage: JourneyStage): { index: number; total: number; percent: number } {
  const total = JOURNEY_STAGES.length
  const index = Math.max(0, JOURNEY_STAGES.indexOf(stage))
  return { index, total, percent: total > 1 ? Math.round((index / (total - 1)) * 100) : 0 }
}

/** Share of a checklist done, 0 to 1, safe for an empty or over-full list. */
export const ringFraction = (done: number, total: number): number => (total <= 0 ? 0 : Math.min(1, Math.max(0, done / total)))

export type HeroCount = { kind: 'days'; value: number; caption: number } | { kind: 'today' } | { kind: 'sailed' }
export const COUNT_CAPTIONS = 4

/** The countdown as a hero number. The caption changes each week (0 to 3) so the line is fresh without being random. */
export function heroCount(days: number): HeroCount {
  if (days < 0) return { kind: 'sailed' }
  if (days === 0) return { kind: 'today' }
  return { kind: 'days', value: days, caption: Math.floor(days / 7) % COUNT_CAPTIONS }
}

export type Relative = { unit: 'now' | 'min' | 'hour' | 'day'; count: number }

/** "In 25 min": the time until a moment, or null once it has passed. */
export function relativeIn(deltaMs: number): Relative | null {
  if (deltaMs < 0) return null
  const min = Math.round(deltaMs / 60_000)
  if (min < 1) return { unit: 'now', count: 0 }
  if (min < 60) return { unit: 'min', count: min }
  const hours = Math.round(min / 60)
  if (hours < 24) return { unit: 'hour', count: hours }
  return { unit: 'day', count: Math.round(hours / 24) }
}

/** The pill for phone time against ship time: matching is good news, a difference is a heads-up (shown with words, never colour alone). */
export const clockPill = (phoneVsShip: number): { tone: 'ok' | 'warn'; hours: number } => ({ tone: phoneVsShip === 0 ? 'ok' : 'warn', hours: phoneVsShip })

export type MomentKey = 'moment.muster' | 'moment.allAboard' | 'moment.checkinOpen' | 'moment.checkinSoon' | 'moment.payment'
export interface MomentFacts {
  muster?: { done: boolean; required: boolean; time: string } | null
  allAboard?: { time: string; minutesLeft: number } | null
  checkin?: { state: 'notOpen' | 'open' | 'closed' | 'done'; opensInDays: number } | null
  payment?: { overdue: boolean; daysToFinal: number } | null
}
export interface Moment { key: MomentKey; vars: Record<string, string | number>; to: string; urgent: boolean }

/** The one thing that matters now, or null when the stage's own landing copy should lead. Most pressing first. */
export function pickMoment(f: MomentFacts): Moment | null {
  if (f.muster && f.muster.required && !f.muster.done) return { key: 'moment.muster', vars: { time: f.muster.time }, to: '/ship/muster', urgent: true }
  if (f.allAboard && f.allAboard.minutesLeft <= 180) return { key: 'moment.allAboard', vars: { time: f.allAboard.time, count: f.allAboard.minutesLeft }, to: '/ship/port', urgent: f.allAboard.minutesLeft <= 30 }
  if (f.payment && (f.payment.overdue || f.payment.daysToFinal <= 7)) return { key: 'moment.payment', vars: { count: Math.max(0, f.payment.daysToFinal) }, to: '/me/payments', urgent: f.payment.overdue }
  if (f.checkin?.state === 'open') return { key: 'moment.checkinOpen', vars: {}, to: '/home/check-in', urgent: false }
  if (f.checkin?.state === 'notOpen' && f.checkin.opensInDays <= 14) return { key: 'moment.checkinSoon', vars: { count: f.checkin.opensInDays }, to: '/plan/checklist', urgent: false }
  return null
}
