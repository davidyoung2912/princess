import { COMPASS_POINTS, DEPTH_CLASSES, LANDMARK_KINDS, SIDES, WILDLIFE } from '../domain/navigation'
import type { AlongTheWay, CompassPoint, Landmark, SeaConditions, ShipClock, ShipPosition } from '../domain/navigation'
import type { StopId } from '../domain/navigation'
import { createFeed, isInt, isRecord, oneOf } from './feed'
import { MAX_PLAN_DAY } from '../domain/nightsRules'

const PORT_IDS: readonly StopId[] = ['fll', 'cozumel', 'belize', 'roatan']
const HHMM = /^\d{2}:\d{2}$/

const num = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const hhmm = (v: unknown): v is string => typeof v === 'string' && HHMM.test(v)
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const compass = (v: unknown): v is CompassPoint => oneOf(v, COMPASS_POINTS)

function normalizeClock(raw: unknown): ShipClock | null {
  if (!isRecord(raw)) return null
  const c = raw.nextChange
  let nextChange: ShipClock['nextChange'] = null
  if (c !== null) {
    if (!isRecord(c) || !num(c.at, 0, 5e12) || !isInt(c.hours, -3, 3) || !isInt(c.day, 1, MAX_PLAN_DAY)) return null
    nextChange = { at: c.at, hours: c.hours, day: c.day }
  }
  if (!hhmm(raw.shipTime) || !hhmm(raw.localTime) || !isInt(raw.shipOffsetMinutes, -840, 840) || !isInt(raw.localOffsetMinutes, -840, 840) || !isInt(raw.differenceMinutes, -1440, 1440)) return null
  if (!oneOf(raw.shipZone, ['eastern', 'belize'] as const) || !oneOf(raw.localPlace, PORT_IDS)) return null
  return {
    shipTime: raw.shipTime, shipOffsetMinutes: raw.shipOffsetMinutes, shipZone: raw.shipZone, localPlace: raw.localPlace,
    localTime: raw.localTime, localOffsetMinutes: raw.localOffsetMinutes, differenceMinutes: raw.differenceMinutes, nextChange,
  }
}

/** Reads the server's ship position; anything wrong in it gives null so nothing is shown. */
export function normalizePosition(raw: unknown): ShipPosition | null {
  if (!isRecord(raw)) return null
  const clock = normalizeClock(raw.clock)
  const a = raw.arrival
  if (!clock || !num(raw.now, 0, 5e12) || !num(raw.lat, -90, 90) || !num(raw.lon, -180, 180) || !num(raw.speedKnots, 0, 40) || !isInt(raw.headingDegrees, 0, 359) || !compass(raw.compass)) return null
  if (raw.day !== null && !isInt(raw.day, 1, MAX_PLAN_DAY)) return null
  if ((raw.inPort !== null && !oneOf(raw.inPort, PORT_IDS)) || !oneOf(raw.lastPort, PORT_IDS) || (raw.nextPort !== null && !oneOf(raw.nextPort, PORT_IDS))) return null
  if (!isInt(raw.nmSailed, 0, 5000) || !isInt(raw.nmRemaining, 0, 5000) || !isInt(raw.legPercent, 0, 100) || !isInt(raw.voyageNmSailed, 0, 20000) || !isInt(raw.voyageNmTotal, 1, 20000)) return null
  if (a !== null && (!isRecord(a) || !num(a.at, 0, 5e12) || !hhmm(a.shipTime) || !isInt(a.day, 1, MAX_PLAN_DAY))) return null
  return {
    now: raw.now, day: raw.day as number | null, lat: raw.lat, lon: raw.lon, speedKnots: raw.speedKnots, headingDegrees: raw.headingDegrees, compass: raw.compass,
    inPort: raw.inPort as StopId | null, lastPort: raw.lastPort, nextPort: raw.nextPort as StopId | null, nmSailed: raw.nmSailed, nmRemaining: raw.nmRemaining,
    legPercent: raw.legPercent, voyageNmSailed: raw.voyageNmSailed, voyageNmTotal: raw.voyageNmTotal,
    arrival: a === null ? null : { at: (a as { at: number }).at, shipTime: (a as { shipTime: string }).shipTime, day: (a as { day: number }).day }, clock,
  }
}

/** Reads the server's sea conditions. */
export function normalizeSea(raw: unknown): SeaConditions | null {
  if (!isRecord(raw)) return null
  if (!num(raw.now, 0, 5e12) || !num(raw.lat, -90, 90) || !num(raw.lon, -180, 180) || !isInt(raw.depthM, 0, 12000) || !oneOf(raw.depthClass, DEPTH_CLASSES)) return null
  if (!num(raw.waterTempC, -2, 40) || !isInt(raw.windKnots, 0, 150) || !compass(raw.windFrom) || !isInt(raw.beaufort, 0, 12) || !isInt(raw.seaState, 0, 9)) return null
  if (!num(raw.waveM, 0, 30) || !num(raw.swellM, 0, 30) || !isInt(raw.swellPeriodSeconds, 0, 30) || !compass(raw.swellFrom)) return null
  return {
    now: raw.now, lat: raw.lat, lon: raw.lon, depthM: raw.depthM, depthClass: raw.depthClass, waterTempC: raw.waterTempC, windKnots: raw.windKnots, windFrom: raw.windFrom,
    beaufort: raw.beaufort, seaState: raw.seaState, waveM: raw.waveM, swellM: raw.swellM, swellPeriodSeconds: raw.swellPeriodSeconds, swellFrom: raw.swellFrom,
  }
}

function normalizeLandmark(raw: unknown): Landmark | null {
  if (!isRecord(raw)) return null
  if (!text(raw.id, 40) || !text(raw.name, 80) || !oneOf(raw.kind, LANDMARK_KINDS) || !text(raw.blurb, 400) || !num(raw.lat, -90, 90) || !num(raw.lon, -180, 180)) return null
  if (!isInt(raw.closestNm, 0, 500) || !oneOf(raw.side, SIDES) || !num(raw.passesAt, 0, 5e12) || !hhmm(raw.shipTime) || !isInt(raw.day, 1, MAX_PLAN_DAY) || !isInt(raw.distanceNm, 0, 20000)) return null
  return {
    id: raw.id, name: raw.name, kind: raw.kind, blurb: raw.blurb, lat: raw.lat, lon: raw.lon, closestNm: raw.closestNm, side: raw.side,
    passesAt: raw.passesAt, shipTime: raw.shipTime, day: raw.day, distanceNm: raw.distanceNm,
  }
}

function landmarks(raw: unknown, max: number): Landmark[] | null {
  if (!Array.isArray(raw) || raw.length > max) return null
  const out: Landmark[] = []
  for (const r of raw) {
    const l = normalizeLandmark(r)
    if (!l) return null
    out.push(l)
  }
  return out
}

/** Reads the server's sea zone and landmarks. */
export function normalizeAlong(raw: unknown): AlongTheWay | null {
  if (!isRecord(raw) || !num(raw.now, 0, 5e12) || !isRecord(raw.zone)) return null
  const z = raw.zone
  if (!text(z.id, 40) || !text(z.name, 80) || !text(z.habitat, 400) || !Array.isArray(z.wildlife) || z.wildlife.length > 8 || !z.wildlife.every((w) => oneOf(w, WILDLIFE))) return null
  const passing = landmarks(raw.passing, 8)
  const ahead = landmarks(raw.ahead, 8)
  const behind = landmarks(raw.behind, 8)
  if (!passing || !ahead || !behind) return null
  return { now: raw.now, zone: { id: z.id, name: z.name, habitat: z.habitat, wildlife: z.wildlife as AlongTheWay['zone']['wildlife'] }, passing, ahead, behind }
}

type Key = [departure: string, minute: number]
const key = (d: string, m: number): string => `${d}|${m}`

/** The ship's position, speed, heading, distances and clocks at a whole minute of a sailing (by departure date). Not kept on the device: an old position is not a position. */
export const positionFeed = createFeed<Key, ShipPosition>(key, normalizePosition)
/** The sea at the ship at a whole minute. */
export const seaFeed = createFeed<Key, SeaConditions>(key, normalizeSea)
/** The sea zone and landmarks at a whole minute. */
export const alongFeed = createFeed<Key, AlongTheWay>(key, normalizeAlong)
