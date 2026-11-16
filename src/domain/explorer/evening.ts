import type { ExplorerDay, ExplorerEvent, VenueDay } from '../../api/explorerTypes'
import { venueHideId, type RecommendWhy, type TasteProfile } from './recommend'
import { walkMinutes, type PlanItem } from './planTimeline'
import type { ExplorerKind } from './types'

const MIN = 60_000

/** One event in a suggested bundle, with the reason it was picked. */
export interface BundleStep {
  event: ExplorerEvent
  explorer: ExplorerKind
  venueId: string
  venueTitle: string
  placeId: string
  /** The reason it was picked; absent when nothing about the guest pointed to it and it simply fits. */
  why?: RecommendWhy
  about?: string
}

/** A short run of things that fit around what the guest already has: a part of the day (morning, afternoon or evening), or the hours after a shore tour. */
export interface Bundle {
  kind: 'morning' | 'afternoon' | 'evening' | 'return'
  /** For a return bundle, when the last tour ends. */
  tourEndsAt?: number
  steps: BundleStep[]
}

/** Time to get back to the ship and freshen up after the last tour ends. */
export const RETURN_BUFFER_MIN = 60
/** A return bundle covers what starts before the evening bundle takes over. */
/** The evening runs from 5 pm to 11 pm (an event may start in that time). */
export const EVENING_FROM = '17:00'
export const EVENING_UNTIL = '23:00'
/** The morning is everything that starts before noon; the afternoon runs from noon until the evening bundle takes over. */
export const MORNING_UNTIL = '11:59'
export const AFTERNOON_FROM = '12:00'
export const AFTERNOON_UNTIL = '16:59'
export const MAX_STEPS = 3
/** The least time between two things, whatever the walk. */
const MIN_GAP = 10

interface Busy { placeId: string; startAt: number; endAt: number }

/** Whether the event leaves room, with the walk between places, for everything already busy. Places the deck plan does not know cost the minimum gap. */
function fits(e: { startAt: number; endAt: number }, placeId: string, busy: readonly Busy[]): boolean {
  return busy.every((b) => {
    const gap = b.endAt <= e.startAt ? e.startAt - b.endAt : e.endAt <= b.startAt ? b.startAt - e.endAt : -1
    if (gap < 0) return false
    return gap >= Math.max(MIN_GAP, walkMinutes(b.placeId, placeId) ?? 0) * MIN
  })
}

const part = (start: string): number => (Number(start.slice(0, 2)) < 17 ? 0 : 1)

/**
 * Picks up to `max` events from every Explorer that start in the window, fit around the plan (with time to walk between places) and suit the guest:
 * a theme they chose scores most, then one like something they planned, then a place they pinned, then anything that fits. A repeat of a theme or place scores less, so the run is varied.
 * Never cancelled, full, over, already planned, or dismissed.
 */
function pick(days: readonly ExplorerDay[], plan: readonly PlanItem[], taste: TasteProfile, ctx: { now: number; pinnedVenueIds: readonly string[] }, window: { fromAt: number; fromClock?: string; untilClock?: string }, busyExtra: readonly Busy[], max: number): BundleStep[] {
  const hidden = new Set(taste.hidden)
  const likes = new Set(taste.likes)
  const pinned = new Set(ctx.pinnedVenueIds)
  const planned = new Set([...plan.map((p) => p.id), ...days.flatMap((d) => d.mine)])
  const savedThemes = new Set(days.flatMap((d) => d.venues.flatMap((v) => v.events.filter((e) => planned.has(e.id)).map((e) => e.interest))))
  const busy: Busy[] = [...plan.filter((p) => p.status !== 'cancelled'), ...busyExtra]
  const cands: { step: BundleStep; base: number }[] = []
  for (const d of days) {
    for (const v of d.venues as VenueDay[]) {
      if (hidden.has(venueHideId(v.venue.id))) continue
      for (const e of v.events) {
        if (e.status === 'cancelled' || e.left === 0 || planned.has(e.id) || hidden.has(e.id)) continue
        if (e.startAt < Math.max(window.fromAt, ctx.now) || (window.fromClock && e.start < window.fromClock) || (window.untilClock && e.start > window.untilClock)) continue
        const base = likes.has(e.interest) ? 3 : savedThemes.has(e.interest) ? 2 : pinned.has(v.venue.id) ? 1.5 : 0.5
        const step: BundleStep = { event: e, explorer: d.explorer, venueId: v.venue.id, venueTitle: v.venue.title, placeId: v.venue.placeId }
        if (base === 3) Object.assign(step, { why: 'liked', about: e.interest })
        else if (base === 2) Object.assign(step, { why: 'similarSaved', about: e.interest })
        else if (base === 1.5) Object.assign(step, { why: 'pinnedVenue', about: v.venue.title })
        cands.push({ step, base })
      }
    }
  }
  const chosen: BundleStep[] = []
  while (chosen.length < max) {
    let best: { c: (typeof cands)[number]; score: number } | null = null
    for (const c of cands) {
      const e = c.step.event
      if (chosen.some((s) => s.event.id === e.id) || !fits(e, c.step.placeId, [...busy, ...chosen.map((s) => ({ placeId: s.placeId, startAt: s.event.startAt, endAt: s.event.endAt }))])) continue
      const score = c.base - 1.5 * chosen.filter((s) => s.event.interest === e.interest).length - chosen.filter((s) => s.venueId === c.step.venueId).length - 0.5 * chosen.filter((s) => part(s.event.start) === part(e.start)).length
      if (!best || score > best.score || (score === best.score && (e.startAt < best.c.step.event.startAt || (e.startAt === best.c.step.event.startAt && e.id < best.c.step.event.id)))) best = { c, score }
    }
    if (!best) break
    chosen.push(best.c.step)
  }
  return chosen.sort((a, b) => a.event.startAt - b.event.startAt)
}

const isPast = (days: readonly ExplorerDay[]): boolean => days.some((d) => d.currentDay !== undefined && d.day < d.currentDay)

/**
 * Suggested bundles for the whole of one cruise day, in time order: a "morning" bundle (before noon), then either a "return" bundle (on a port day with a shore tour on the plan:
 * things that start an hour after the last tour ends, time to get back and freshen up) or an "afternoon" bundle (noon to 5 pm), then an "evening" bundle (5 pm to 11 pm). Each fits
 * round the plan and the bundles before it. Empty for a past day, or for a part of the day that has passed or where nothing fits.
 */
export function dayBundles(days: readonly ExplorerDay[], plan: readonly PlanItem[], taste: TasteProfile, ctx: { now: number; pinnedVenueIds: readonly string[] }): Bundle[] {
  if (days.length === 0 || isPast(days)) return []
  const out: Bundle[] = []
  const extra: Busy[] = []
  const take = (kind: Bundle['kind'], steps: BundleStep[], more: Partial<Bundle> = {}) => {
    if (steps.length === 0) return
    out.push({ kind, ...more, steps })
    extra.push(...steps.map((s) => ({ placeId: s.placeId, startAt: s.event.startAt, endAt: s.event.endAt })))
  }
  take('morning', pick(days, plan, taste, ctx, { fromAt: 0, untilClock: MORNING_UNTIL }, extra, MAX_STEPS))
  const tours = plan.filter((p) => p.kind === 'tour' && p.status !== 'cancelled')
  const atPort = days.some((d) => d.port !== '')
  if (atPort && tours.length > 0) {
    const tourEndsAt = Math.max(...tours.map((t) => t.endAt))
    take('return', pick(days, plan, taste, ctx, { fromAt: tourEndsAt + RETURN_BUFFER_MIN * MIN, untilClock: '16:59' }, extra, 2), { tourEndsAt })
  } else {
    take('afternoon', pick(days, plan, taste, ctx, { fromAt: 0, fromClock: AFTERNOON_FROM, untilClock: AFTERNOON_UNTIL }, extra, MAX_STEPS))
  }
  take('evening', pick(days, plan, taste, ctx, { fromAt: 0, fromClock: EVENING_FROM, untilClock: EVENING_UNTIL }, extra, MAX_STEPS))
  return out
}
