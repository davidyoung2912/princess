import { AGE_GROUPS, EVENT_INTERESTS, replaceProgram, type AgeGroup, type EventInterest, type PlanChange, type ShipEvent } from './program'
import { notifyCatalogue } from './catalogueServed'
import { MAX_PLAN_DAY } from './nightsRules'

/**
 * The programme from the server (multi-device plan 3, Phase 3 step 3): every event and the mid-day changes the ship has made (the server's
 * `IProgramChanges`). The authored values in `program.ts` show until it arrives; the last answer is kept on the device as a cache.
 */
export interface ServedProgram { version: string; events: ShipEvent[]; changes: PlanChange[] }

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const hhmm = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

function event(r: unknown): ShipEvent | null {
  if (!rec(r) || !str(r.id, 40) || !Array.isArray(r.days) || r.days.length === 0 || !r.days.every((d) => Number.isInteger(d) && d >= 1 && d <= MAX_PLAN_DAY)) return null
  if (!hhmm(r.start) || typeof r.minutes !== 'number' || !(r.minutes >= 5 && r.minutes <= 600) || !str(r.title) || !str(r.placeId, 40)) return null
  if (!(AGE_GROUPS as readonly unknown[]).includes(r.age) || !(EVENT_INTERESTS as readonly unknown[]).includes(r.interest)) return null
  if (typeof r.extra !== 'number' || !Number.isInteger(r.extra) || r.extra < 0 || r.extra > 10_000_000) return null
  const e: ShipEvent = { id: r.id, days: r.days as number[], start: r.start, minutes: r.minutes, title: r.title, placeId: r.placeId, age: r.age as AgeGroup, interest: r.interest as EventInterest, extra: r.extra }
  if (r.afterAllAboard === true) e.afterAllAboard = true
  return e
}

function change(r: unknown): PlanChange | null {
  if (!rec(r) || !str(r.eventId, 40) || typeof r.day !== 'number' || !Number.isInteger(r.day) || r.day < 1 || r.day > MAX_PLAN_DAY || (r.kind !== 'moved' && r.kind !== 'cancelled') || !str(r.reason, 400)) return null
  const c: PlanChange = { eventId: r.eventId, day: r.day, kind: r.kind, reason: r.reason }
  if (r.kind === 'moved') { if (!hhmm(r.start)) return null; c.start = r.start }
  return c
}

/** Reads the server's answer, all or nothing: a malformed entry, a repeated event id, no events, or a change to an event that does not run that day gives null. */
export function normalizeProgram(raw: unknown): ServedProgram | null {
  if (!rec(raw) || !str(raw.version, 80) || !Array.isArray(raw.events) || !Array.isArray(raw.planChanges)) return null
  const events = raw.events.map(event)
  const changes = raw.planChanges.map(change)
  if (events.some((e) => !e) || changes.some((c) => !c)) return null
  const es = events as ShipEvent[]
  const cs = changes as PlanChange[]
  if (es.length === 0 || new Set(es.map((e) => e.id)).size !== es.length) return null
  if (!cs.every((c) => es.find((e) => e.id === c.eventId)?.days.includes(c.day))) return null
  return { version: raw.version, events: es, changes: cs }
}

/** Puts the served programme in use and tells the screens. */
export function applyProgram(p: ServedProgram): void {
  replaceProgram({ events: p.events, changes: p.changes })
  notifyCatalogue()
}
