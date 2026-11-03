import type { PortId } from './sailings'

/** A place the ship can be alongside: any port but "sea". */
export type StopId = Exclude<PortId, 'sea'>
import type { Units } from './readiness'

/**
 * Where the ship is, the sea around it and what it is passing. Every figure comes from the server (`/feeds/ship-position`, `/feeds/sea-conditions`,
 * `/feeds/along-the-way`); this module holds the shapes and the plain conversions for showing them in a guest's units. Nothing here works a figure out.
 */
export const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const
export type CompassPoint = (typeof COMPASS_POINTS)[number]

export const DEPTH_CLASSES = ['shelf', 'slope', 'deep', 'trench'] as const
export type DepthClass = (typeof DEPTH_CLASSES)[number]

export const LANDMARK_KINDS = ['lighthouse', 'current', 'strait', 'route', 'history', 'reef', 'natural', 'island', 'trench'] as const
export type LandmarkKind = (typeof LANDMARK_KINDS)[number]

export const SIDES = ['port', 'starboard', 'ahead'] as const
export type Side = (typeof SIDES)[number]

export const WILDLIFE = ['dolphins', 'flyingFish', 'frigatebird', 'turtle', 'whale', 'ray'] as const
export type Wildlife = (typeof WILDLIFE)[number]

export interface ShipClock {
  /** Ship time, "HH:MM". */
  shipTime: string
  shipOffsetMinutes: number
  shipZone: 'eastern' | 'belize'
  /** The port whose local time is compared: the port the ship is in, or the one it is heading for. */
  localPlace: StopId
  localTime: string
  localOffsetMinutes: number
  /** Local minus ship, in minutes. */
  differenceMinutes: number
  nextChange: { at: number; hours: number; day: number } | null
}

export interface ShipPosition {
  now: number
  day: number | null
  lat: number
  lon: number
  speedKnots: number
  headingDegrees: number
  compass: CompassPoint
  inPort: StopId | null
  lastPort: StopId
  nextPort: StopId | null
  nmSailed: number
  nmRemaining: number
  legPercent: number
  voyageNmSailed: number
  voyageNmTotal: number
  arrival: { at: number; shipTime: string; day: number } | null
  clock: ShipClock
}

export interface SeaConditions {
  now: number
  lat: number
  lon: number
  depthM: number
  depthClass: DepthClass
  waterTempC: number
  windKnots: number
  windFrom: CompassPoint
  /** Beaufort force, 0 to 12. */
  beaufort: number
  /** WMO sea state code, 0 to 9. */
  seaState: number
  waveM: number
  swellM: number
  swellPeriodSeconds: number
  swellFrom: CompassPoint
}

export interface Landmark {
  id: string
  name: string
  kind: LandmarkKind
  blurb: string
  lat: number
  lon: number
  closestNm: number
  side: Side
  passesAt: number
  shipTime: string
  day: number
  distanceNm: number
}

export interface AlongTheWay {
  now: number
  zone: { id: string; name: string; habitat: string; wildlife: Wildlife[] }
  passing: Landmark[]
  ahead: Landmark[]
  behind: Landmark[]
}

const KMH_PER_KNOT = 1.852
const MPH_PER_KNOT = 1.15078
const FEET_PER_METRE = 3.28084

const grouped = (n: number): string => new Intl.NumberFormat().format(Math.round(n))
const one = (n: number): string => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n)

/** The ground speed in knots, with the guest's own unit beside it. */
export function speedParts(knots: number, units: Units): { knots: string; other: string } {
  return { knots: one(knots), other: units === 'metric' ? `${grouped(knots * KMH_PER_KNOT)} km/h` : `${grouped(knots * MPH_PER_KNOT)} mph` }
}

/** Nautical miles, with kilometres beside them for a metric guest and statute miles for an imperial one. */
export function distanceParts(nm: number, units: Units): { nm: string; other: string } {
  return { nm: grouped(nm), other: units === 'metric' ? `${grouped(nm * KMH_PER_KNOT)} km` : `${grouped(nm * MPH_PER_KNOT)} mi` }
}

/** A length of water: metres for a metric guest, feet for an imperial one. */
export function depthText(metres: number, units: Units): string {
  return units === 'metric' ? `${grouped(metres)} m` : `${grouped(metres * FEET_PER_METRE)} ft`
}

export function waveText(metres: number, units: Units): string {
  return units === 'metric' ? `${one(metres)} m` : `${one(metres * FEET_PER_METRE)} ft`
}

export function waterTempText(celsius: number, units: Units): string {
  return units === 'metric' ? `${one(celsius)}°C` : `${Math.round((celsius * 9) / 5 + 32)}°F`
}

/** A latitude or longitude in degrees, without the hemisphere letter (the screen adds it in the guest's language). */
export const degrees = (value: number): string => `${Math.abs(value).toFixed(3)}°`

/** How far the depth reaches on a gauge, 0 to 100, on a square-root scale so a shelf is still visible beside a trench. */
export const depthGauge = (metres: number): number => Math.min(100, Math.round(Math.sqrt(Math.max(0, metres) / 5000) * 100))

/** The clock difference in whole and half hours, signed: positive when the port is ahead of the ship. */
export const differenceHours = (minutes: number): number => Math.round((minutes / 60) * 10) / 10
