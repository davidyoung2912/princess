import type { CompassPoint } from './navigation'
import type { Units } from './readiness'

/**
 * What the bridge and engine room report, beyond the ship's position and the sea (those are in `navigation.ts`). Every figure comes from the server
 * (`/feeds/ship-nautical`); this module holds the shapes and the plain conversions for showing them.
 */
export const WATCHES = ['middle', 'morning', 'forenoon', 'afternoon', 'evening', 'first'] as const
export type WatchName = (typeof WATCHES)[number]

export const TRAFFIC_KINDS = ['cargo', 'tanker', 'cruise', 'fishing', 'sailing', 'ferry', 'tug'] as const
export type TrafficKind = (typeof TRAFFIC_KINDS)[number]

export const CYCLES = ['spring', 'neap', 'between'] as const

export interface Vessel {
  id: string
  name: string
  shipClass: string
  flag: string
  portOfRegistry: string
  grossTonnage: number
  lengthM: number
  beamM: number
  draftM: number
  airDraftM: number
  serviceSpeedKnots: number
  maxSpeedKnots: number
  propulsion: string
  decks: number
  yearBuilt: number
}

export interface Course {
  headingTrue: number
  headingMagnetic: number
  /** East positive. */
  variationDegrees: number
  courseOverGround: number
  speedOverGroundKnots: number
  speedThroughWaterKnots: number
  rateOfTurnDegreesPerMinute: number
  currentSetDegrees: number
  currentDriftKnots: number
  currentName: string
  steering: string
}

export interface NearestLand { name: string; bearingDegrees: number; compass: CompassPoint; distanceNm: number; clearanceUnderKeelM: number }
export interface NextPortInfo { port: string; bearingDegrees: number; straightLineNm: number; trackNm: number; pilotDay: number | null; pilotShipTime: string | null }
export interface Tide { state: 'rising' | 'falling'; heightM: number; rangeM: number; cycle: (typeof CYCLES)[number]; nextHighAt: number; nextHighShipTime: string; nextLowAt: number; nextLowShipTime: string }
export interface Run { last24HoursNm: number; last24HoursAverageKnots: number; toGoNm: number }
export interface Plant {
  generatorsOnline: number
  generatorsTotal: number
  propulsionMw: number
  shaftRpm: number
  fuelTankPercent: number
  fuelTonnesPerHour: number
  stabilisersOut: boolean
  rollDegrees: number
  pitchDegrees: number
  bowThrusters: 'off' | 'standby'
}
export interface Watch { name: WatchName; from: string; to: string; bridgeOfficers: number; lookouts: number; radarRangeNm: number; navigationLightsOn: boolean }
export interface Traffic { kind: TrafficKind; bearingDegrees: number; distanceNm: number; courseDegrees: number; speedKnots: number; closestApproachNm: number; minutesToClosest: number; alert: boolean }

export interface Nautical {
  now: number
  vessel: Vessel
  course: Course
  nearestLand: NearestLand
  nextPort: NextPortInfo | null
  tide: Tide
  run: Run
  plant: Plant
  watch: Watch
  traffic: Traffic[]
}

const FEET_PER_METRE = 3.28084
const grouped = (n: number): string => new Intl.NumberFormat().format(Math.round(n))
const one = (n: number): string => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n)

/** A latitude or longitude in degrees and decimal minutes, the way a chart gives it: `26°05.4′`. The hemisphere letter is added by the screen. */
export function degreesMinutes(value: number): string {
  const abs = Math.abs(value)
  let deg = Math.floor(abs)
  let min = Math.round((abs - deg) * 600) / 10
  if (min >= 60) { deg += 1; min = 0 }
  return `${deg}°${min.toFixed(1).padStart(4, '0')}′`
}

/** A heading as three digits: `045°`. */
export const headingText = (deg: number): string => `${String(Math.round(deg) % 360).padStart(3, '0')}°`

/** A length of the ship: metres for a metric guest, feet for an imperial one. */
export const lengthText = (metres: number, units: Units): string => (units === 'metric' ? `${one(metres)} m` : `${grouped(metres * FEET_PER_METRE)} ft`)

export const tonnageText = (tonnes: number): string => grouped(tonnes)

/** Current drift in knots with the unit; the set is a direction and is shown as a heading. */
export const knotsText = (knots: number): string => `${one(knots)} kn`

/** The rate of turn: `Steady` is the screen's word for 0.0; this gives the signed figure. */
export const turnText = (degPerMin: number): string => `${degPerMin > 0 ? '+' : ''}${one(degPerMin)}°/min`

/** The UTC time of a moment, "HH:MM". */
export function utcTime(at: number): string {
  const d = new Date(at)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
