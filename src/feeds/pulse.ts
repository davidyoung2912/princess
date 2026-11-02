import { createFeed, isInt, isRecord } from './feed'
import { PULSE_STEP_MIN, PULSE_VENUES, type PulseEnv, type PulseId } from '../domain/pulse'

const MIN = 60_000
const HALF_HOURS = 9

/** Levels the server gave, keyed by venue and exact moment. */
export type ServedLevels = ReadonlyMap<string, number>

const at = (id: string, ms: number): string => `${id}|${ms}`

/** Reads the server's pulse for a moment: every venue present, every level a whole number from 0 to 100; anything else gives null. */
export function normalizePulse(raw: unknown): ServedLevels | null {
  if (!isRecord(raw) || !Number.isFinite(raw.now) || !Number.isFinite(raw.observedAt) || !isRecord(raw.venues)) return null
  const now = raw.now as number
  const observedAt = raw.observedAt as number
  const map = new Map<string, number>()
  for (const v of PULSE_VENUES) {
    const row = raw.venues[v.id]
    if (!isRecord(row) || !isInt(row.observed, 0, 100) || !Array.isArray(row.ahead) || row.ahead.length !== HALF_HOURS) return null
    map.set(at(v.id, observedAt), row.observed)
    for (let i = 0; i < HALF_HOURS; i++) {
      if (!isInt(row.ahead[i], 0, 100)) return null
      map.set(at(v.id, now + i * 30 * MIN), row.ahead[i] as number)
    }
  }
  return map
}

/** The whole minute a moment falls in. Pulse is read at whole minutes, which changes nothing the screens show but lets one answer cover a minute. */
export const minuteOf = (now: number): number => Math.floor(now / MIN) * MIN

/** The five-minute mark a reading is taken at (kept here so the contract is in one place). */
export const observedMark = (now: number): number => Math.floor(now / (PULSE_STEP_MIN * MIN)) * PULSE_STEP_MIN * MIN

/** Pulse levels from the server for a sailing (by departure date) and a whole minute; none until they arrive. */
export const pulseFeed = createFeed<[departure: string, minute: number], ServedLevels>((d, m) => `${d}|${m}`, normalizePulse)

/** The same environment with the server's levels laid over it where it has them. */
/** A whole cruise day at half-hour steps from midnight ship time, as the server gave it. */
export interface ServedDay { day: number; startAt: number; levels: ReadonlyMap<string, readonly number[]> }

/** Reads a day of levels: every venue present with 48 whole numbers from 0 to 100. */
export function normalizePulseDay(raw: unknown): ServedDay | null {
  if (!isRecord(raw) || !isInt(raw.day, 1, 8) || !Number.isFinite(raw.startAt) || !isRecord(raw.venues)) return null
  const levels = new Map<string, readonly number[]>()
  for (const v of PULSE_VENUES) {
    const row = raw.venues[v.id]
    if (!Array.isArray(row) || row.length !== 48 || !row.every((n) => isInt(n, 0, 100))) return null
    levels.set(v.id, row as number[])
  }
  return { day: raw.day, startAt: raw.startAt as number, levels }
}

/** Pulse levels across a cruise day for a sailing (by departure date) and day. */
export const pulseDayFeed = createFeed<[departure: string, day: number], ServedDay>((d, n) => `${d}|${n}`, normalizePulseDay)

/** The level at the nearest half hour of a served day, or undefined when the moment is outside it. */
export function dayLevel(day: ServedDay | null, id: PulseId, ms: number): number | undefined {
  if (!day) return undefined
  const i = Math.round((ms - day.startAt) / (30 * MIN))
  return i < 0 || i > 47 ? undefined : day.levels.get(id)?.[i]
}

/** The ship's environment with the server's levels over it: the exact live ones first, then the nearest half hour of the day. */
export const withServed = (env: Pick<PulseEnv, 'hour'>, live: ServedLevels | null, day: ServedDay | null = null): PulseEnv => ({
  hour: env.hour,
  served: (id: PulseId, ms: number) => live?.get(at(id, ms)) ?? dayLevel(day, id, ms),
})
