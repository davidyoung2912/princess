import type { DayWish } from '../domain/day'
import type { PlanEntry } from '../domain/planChange'
import { createFeed, isInt, isRecord, oneOf } from './feed'
import { MAX_PLAN_DAY } from '../domain/nightsRules'

const KINDS = ['tour', 'event', 'dinner'] as const
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

/** One thing in a day plan as the server answers it: an entry plus why it was chosen. */
export interface ServedEntry extends PlanEntry { why: string }

/** The ship's own change to an event today. */
export interface ShipChange { id: string; kind: 'moved' | 'cancelled'; start: string | null; reason: string | null }

export interface ServedDay {
  day: number
  items: ServedEntry[]
  /** Nothing but dinner could be matched to the wishes. */
  empty: boolean
  /** The time to be back at the ship for the tour, when there is one. */
  backBy: string | null
  /** Included events that could join the day (the guest's own plan is not taken off: the screen does that). */
  alternatives: ServedEntry[]
  shipChanges: ShipChange[]
}

/** The wishes in one fixed order, as the server reads them (a tour limit is whole dollars on the device and cents on the wire). */
export const wishKey = (w: DayWish): string => JSON.stringify({ tours: [...w.tours].sort(), events: [...w.events].sort(), mobility: w.mobility, withKids: w.withKids, maxTour: w.maxTour === null ? null : Math.round(w.maxTour * 100) })

export function normalizeEntry(raw: unknown): ServedEntry | null {
  if (!isRecord(raw) || !text(raw.id, 60) || !text(raw.title, 120) || typeof raw.start !== 'string' || !HHMM.test(raw.start) || !isInt(raw.minutes, 1, 1440)) return null
  if (!oneOf(raw.kind, KINDS) || typeof raw.outdoor !== 'boolean' || !text(raw.path, 60) || !text(raw.why, 200)) return null
  if (raw.placeId !== null && raw.placeId !== undefined && !text(raw.placeId, 40)) return null
  return { id: raw.id, title: raw.title, start: raw.start, minutes: raw.minutes, kind: raw.kind, placeId: typeof raw.placeId === 'string' ? raw.placeId : undefined, outdoor: raw.outdoor, path: raw.path, why: raw.why }
}

export function normalizeEntries(raw: unknown, max: number): ServedEntry[] | null {
  if (!Array.isArray(raw) || raw.length > max) return null
  const out: ServedEntry[] = []
  for (const r of raw) {
    const e = normalizeEntry(r)
    if (!e) return null
    out.push(e)
  }
  return out
}

/** Reads the server's day. Anything wrong gives null. */
export function normalizeDay(raw: unknown): ServedDay | null {
  if (!isRecord(raw) || !isInt(raw.day, 1, MAX_PLAN_DAY) || typeof raw.empty !== 'boolean') return null
  if (raw.backBy !== null && (typeof raw.backBy !== 'string' || !HHMM.test(raw.backBy))) return null
  const items = normalizeEntries(raw.items, 12)
  const alternatives = normalizeEntries(raw.alternatives, 40)
  if (!items || !alternatives || !Array.isArray(raw.shipChanges) || raw.shipChanges.length > 20) return null
  const shipChanges: ShipChange[] = []
  for (const c of raw.shipChanges) {
    if (!isRecord(c) || !text(c.id, 60) || !oneOf(c.kind, ['moved', 'cancelled'] as const)) return null
    if (c.start !== null && (typeof c.start !== 'string' || !HHMM.test(c.start))) return null
    if (c.reason !== null && !text(c.reason, 300)) return null
    shipChanges.push({ id: c.id, kind: c.kind, start: c.start, reason: c.reason })
  }
  return { day: raw.day, items, empty: raw.empty, backBy: raw.backBy, alternatives, shipChanges }
}

/** The day for a sailing, a cruise day and wishes (see `wishKey`). Nothing is booked from it. */
export const dayPlanFeed = createFeed<[sailingId: string, day: number, wishes: string], ServedDay>((s, d, w) => `${s}|${d}|${w}`, normalizeDay)

/** Plain `PlanEntry` values (without the reason). */
export const entriesOf = (list: readonly ServedEntry[]): PlanEntry[] => list.map(({ why: _why, ...entry }) => entry)
