import { AGE_GROUPS, EVENT_INTERESTS, replaceProgram, type AgeGroup, type EventInterest, type PlanChange, type ShipEvent } from './program'
import { notifyCatalogue } from './catalogueServed'
import { MAX_PLAN_DAY } from './nightsRules'
import { isDayKind, type DayKind } from './dayKinds'

/**
 * The programme from the server (multi-device plan 3, Phase 3 step 3): every event and the mid-day changes the ship has made (the server's
 * `IProgramChanges`). The authored values in `program.ts` show until it arrives; the last answer is kept on the device as a cache.
 */
export interface ServedProgram { version: string; events: ShipEvent[]; changes: PlanChange[] }

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const hhmm = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

function event(r: unknown): ShipEvent | null {
  if (!rec(r) || !str(r.id, 40) || !Array.isArray(r.when) || r.when.length === 0 || !r.when.every(isDayKind)) return null
  if (!hhmm(r.start) || typeof r.minutes !== 'number' || !(r.minutes >= 5 && r.minutes <= 600) || !str(r.title) || !str(r.placeId, 40)) return null
  if (!(AGE_GROUPS as readonly unknown[]).includes(r.age) || !(EVENT_INTERESTS as readonly unknown[]).includes(r.interest)) return null
  if (typeof r.extra !== 'number' || !Number.isInteger(r.extra) || r.extra < 0 || r.extra > 10_000_000) return null
  const e: ShipEvent = { id: r.id, when: r.when as DayKind[], start: r.start, minutes: r.minutes, title: r.title, placeId: r.placeId, age: r.age as AgeGroup, interest: r.interest as EventInterest, extra: r.extra }
  if (r.afterAllAboard === true) e.afterAllAboard = true
  return e
}

function change(r: unknown): PlanChange | null {
  if (!rec(r) || !str(r.eventId, 40) || typeof r.day !== 'number' || !Number.isInteger(r.day) || r.day < 1 || r.day > MAX_PLAN_DAY || (r.kind !== 'moved' && r.kind !== 'cancelled') || !str(r.reason, 400)) return null
  const c: PlanChange = { eventId: r.eventId, day: r.day, kind: r.kind, reason: r.reason }
  if (r.kind === 'moved') { if (!hhmm(r.start)) return null; c.start = r.start }
  return c
}

/** Reads the server's answer, all or nothing: a malformed entry, a repeated event id, no events, or a change to an event that is not in the programme gives null. */
export function normalizeProgram(raw: unknown): ServedProgram | null {
  if (!rec(raw) || !str(raw.version, 80) || !Array.isArray(raw.events) || !Array.isArray(raw.planChanges)) return null
  const events = raw.events.map(event)
  const changes = raw.planChanges.map(change)
  if (events.some((e) => !e) || changes.some((c) => !c)) return null
  const es = events as ShipEvent[]
  const cs = changes as PlanChange[]
  if (es.length === 0 || new Set(es.map((e) => e.id)).size !== es.length) return null
  if (!cs.every((c) => es.some((e) => e.id === c.eventId))) return null
  return { version: raw.version, events: es, changes: cs }
}

const SUN = 'sun-princess'
const KEPT = new Map<string, ServedProgram>()
/** The ship whose programme is in use; empty until a screen chooses one (the programme that arrives with the reference tables, Sun Princess's, shows meanwhile). */
let active = ''

export const programOf = (shipId: string): ServedProgram | undefined => KEPT.get(shipId)
export const activeProgramShip = (): string => active

function put(p: ServedProgram): void {
  replaceProgram({ events: p.events, changes: p.changes })
  notifyCatalogue()
}

/** Puts the programme that arrives with the reference tables (Sun Princess's) in use, unless another ship's is the one in use. Kept as Sun Princess's either way. */
export function applyProgram(p: ServedProgram): void {
  KEPT.set(SUN, p)
  if (active === '' || active === SUN) put(p)
}

/** Keeps a ship's programme; if it is the one in use it is put in use at once. */
export function keepProgram(shipId: string, p: ServedProgram): void {
  KEPT.set(shipId, p)
  if (active === shipId) put(p)
}

/** Puts a ship's programme in use for the screens. False when that ship's has not been loaded (the one in use stays). */
export function activateProgram(shipId: string): boolean {
  const p = KEPT.get(shipId)
  if (!p) return false
  if (active === shipId) return true
  active = shipId
  put(p)
  return true
}

type Loader = (shipId: string) => Promise<unknown>
let loader: Loader | null = null
const inFlight = new Map<string, Promise<boolean>>()

/** What fetches a ship's programme (the runtime sets it); without one nothing is loaded. */
export function setProgramLoader(next: Loader | null): void { loader = next }

/** Asks for a ship's programme unless it is already kept. True when it is kept afterwards. */
export function loadShipProgram(shipId: string): Promise<boolean> {
  if (KEPT.has(shipId)) return Promise.resolve(true)
  const running = inFlight.get(shipId)
  if (running) return running
  if (!loader) return Promise.resolve(false)
  const p = loader(shipId)
    .then((raw) => {
      const v = normalizeProgram(raw)
      if (!v) return false
      keepProgram(shipId, v)
      return true
    })
    .catch(() => false)
    .finally(() => { inFlight.delete(shipId) })
  inFlight.set(shipId, p)
  return p
}

/** Forgets every kept programme (tests). */
export function clearPrograms(): void { KEPT.clear(); inFlight.clear(); active = '' }
