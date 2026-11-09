import { COMPASS_POINTS } from '../domain/navigation'
import { CYCLES, TRAFFIC_KINDS, WATCHES, type Nautical, type Traffic } from '../domain/nautical'
import { MAX_PLAN_DAY } from '../domain/nightsRules'
import { createFeed, isInt, isRecord, oneOf } from './feed'

const num = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const hhmm = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)
const deg = (v: unknown): v is number => isInt(v, 0, 359)

function vessel(r: unknown): Nautical['vessel'] | null {
  if (!isRecord(r)) return null
  if (!text(r.id, 40) || !text(r.name, 60) || !text(r.shipClass, 40) || !text(r.flag, 40) || !text(r.portOfRegistry, 60) || !isInt(r.grossTonnage, 1, 500_000)) return null
  if (!num(r.lengthM, 1, 500) || !num(r.beamM, 1, 100) || !num(r.draftM, 1, 20) || !num(r.airDraftM, 1, 100) || !num(r.serviceSpeedKnots, 1, 40) || !num(r.maxSpeedKnots, 1, 40)) return null
  if (!text(r.propulsion, 80) || !isInt(r.decks, 1, 40) || !isInt(r.yearBuilt, 1900, 2100)) return null
  return {
    id: r.id, name: r.name, shipClass: r.shipClass, flag: r.flag, portOfRegistry: r.portOfRegistry, grossTonnage: r.grossTonnage, lengthM: r.lengthM, beamM: r.beamM, draftM: r.draftM,
    airDraftM: r.airDraftM, serviceSpeedKnots: r.serviceSpeedKnots, maxSpeedKnots: r.maxSpeedKnots, propulsion: r.propulsion, decks: r.decks, yearBuilt: r.yearBuilt,
  }
}

function course(r: unknown): Nautical['course'] | null {
  if (!isRecord(r)) return null
  if (!deg(r.headingTrue) || !deg(r.headingMagnetic) || !num(r.variationDegrees, -30, 30) || !deg(r.courseOverGround) || !num(r.speedOverGroundKnots, 0, 40) || !num(r.speedThroughWaterKnots, 0, 40)) return null
  if (!num(r.rateOfTurnDegreesPerMinute, -60, 60) || !deg(r.currentSetDegrees) || !num(r.currentDriftKnots, 0, 10) || !text(r.currentName, 60) || !text(r.steering, 40)) return null
  return {
    headingTrue: r.headingTrue, headingMagnetic: r.headingMagnetic, variationDegrees: r.variationDegrees, courseOverGround: r.courseOverGround, speedOverGroundKnots: r.speedOverGroundKnots,
    speedThroughWaterKnots: r.speedThroughWaterKnots, rateOfTurnDegreesPerMinute: r.rateOfTurnDegreesPerMinute, currentSetDegrees: r.currentSetDegrees, currentDriftKnots: r.currentDriftKnots,
    currentName: r.currentName, steering: r.steering,
  }
}

function land(r: unknown): Nautical['nearestLand'] | null {
  if (!isRecord(r) || !text(r.name, 80) || !deg(r.bearingDegrees) || !oneOf(r.compass, COMPASS_POINTS) || !isInt(r.distanceNm, 0, 5000) || !isInt(r.clearanceUnderKeelM, 0, 12000)) return null
  return { name: r.name, bearingDegrees: r.bearingDegrees, compass: r.compass, distanceNm: r.distanceNm, clearanceUnderKeelM: r.clearanceUnderKeelM }
}

function nextPort(r: unknown): Nautical['nextPort'] | undefined {
  if (r === null) return null
  if (!isRecord(r) || !text(r.port, 40) || !deg(r.bearingDegrees) || !isInt(r.straightLineNm, 0, 5000) || !isInt(r.trackNm, 0, 5000)) return undefined
  if ((r.pilotDay !== null && !isInt(r.pilotDay, 1, MAX_PLAN_DAY)) || (r.pilotShipTime !== null && !hhmm(r.pilotShipTime))) return undefined
  return { port: r.port, bearingDegrees: r.bearingDegrees, straightLineNm: r.straightLineNm, trackNm: r.trackNm, pilotDay: r.pilotDay as number | null, pilotShipTime: r.pilotShipTime as string | null }
}

function tide(r: unknown): Nautical['tide'] | null {
  if (!isRecord(r) || !oneOf(r.state, ['rising', 'falling'] as const) || !num(r.heightM, 0, 20) || !num(r.rangeM, 0, 20) || !oneOf(r.cycle, CYCLES)) return null
  if (!num(r.nextHighAt, 0, 5e12) || !hhmm(r.nextHighShipTime) || !num(r.nextLowAt, 0, 5e12) || !hhmm(r.nextLowShipTime)) return null
  return { state: r.state, heightM: r.heightM, rangeM: r.rangeM, cycle: r.cycle, nextHighAt: r.nextHighAt, nextHighShipTime: r.nextHighShipTime, nextLowAt: r.nextLowAt, nextLowShipTime: r.nextLowShipTime }
}

function run(r: unknown): Nautical['run'] | null {
  if (!isRecord(r) || !isInt(r.last24HoursNm, 0, 1000) || !num(r.last24HoursAverageKnots, 0, 40) || !isInt(r.toGoNm, 0, 20000)) return null
  return { last24HoursNm: r.last24HoursNm, last24HoursAverageKnots: r.last24HoursAverageKnots, toGoNm: r.toGoNm }
}

function plant(r: unknown): Nautical['plant'] | null {
  if (!isRecord(r) || !isInt(r.generatorsOnline, 0, 20) || !isInt(r.generatorsTotal, 1, 20) || !num(r.propulsionMw, 0, 100) || !isInt(r.shaftRpm, 0, 400) || !isInt(r.fuelTankPercent, 0, 100)) return null
  if (!num(r.fuelTonnesPerHour, 0, 50) || typeof r.stabilisersOut !== 'boolean' || !num(r.rollDegrees, 0, 45) || !num(r.pitchDegrees, 0, 45) || !oneOf(r.bowThrusters, ['off', 'standby'] as const)) return null
  return {
    generatorsOnline: r.generatorsOnline, generatorsTotal: r.generatorsTotal, propulsionMw: r.propulsionMw, shaftRpm: r.shaftRpm, fuelTankPercent: r.fuelTankPercent,
    fuelTonnesPerHour: r.fuelTonnesPerHour, stabilisersOut: r.stabilisersOut, rollDegrees: r.rollDegrees, pitchDegrees: r.pitchDegrees, bowThrusters: r.bowThrusters,
  }
}

function watch(r: unknown): Nautical['watch'] | null {
  if (!isRecord(r) || !oneOf(r.name, WATCHES) || !hhmm(r.from) || !hhmm(r.to) || !isInt(r.bridgeOfficers, 0, 20) || !isInt(r.lookouts, 0, 20) || !isInt(r.radarRangeNm, 1, 100) || typeof r.navigationLightsOn !== 'boolean') return null
  return { name: r.name, from: r.from, to: r.to, bridgeOfficers: r.bridgeOfficers, lookouts: r.lookouts, radarRangeNm: r.radarRangeNm, navigationLightsOn: r.navigationLightsOn }
}

function traffic(r: unknown): Traffic | null {
  if (!isRecord(r) || !oneOf(r.kind, TRAFFIC_KINDS) || !deg(r.bearingDegrees) || !num(r.distanceNm, 0, 500) || !deg(r.courseDegrees) || !num(r.speedKnots, 0, 60)) return null
  if (!num(r.closestApproachNm, 0, 500) || !isInt(r.minutesToClosest, 0, 100_000) || typeof r.alert !== 'boolean') return null
  return { kind: r.kind, bearingDegrees: r.bearingDegrees, distanceNm: r.distanceNm, courseDegrees: r.courseDegrees, speedKnots: r.speedKnots, closestApproachNm: r.closestApproachNm, minutesToClosest: r.minutesToClosest, alert: r.alert }
}

/** Reads the server's bridge report, all or nothing; at most 12 vessels on the radar. */
export function normalizeNautical(raw: unknown): Nautical | null {
  if (!isRecord(raw) || !num(raw.now, 0, 5e12)) return null
  const v = vessel(raw.vessel)
  const c = course(raw.course)
  const l = land(raw.nearestLand)
  const n = nextPort(raw.nextPort)
  const ti = tide(raw.tide)
  const ru = run(raw.run)
  const pl = plant(raw.plant)
  const wa = watch(raw.watch)
  if (!v || !c || !l || n === undefined || !ti || !ru || !pl || !wa || !Array.isArray(raw.traffic) || raw.traffic.length > 12) return null
  const tr: Traffic[] = []
  for (const x of raw.traffic) {
    const t = traffic(x)
    if (!t) return null
    tr.push(t)
  }
  return { now: raw.now, vessel: v, course: c, nearestLand: l, nextPort: n, tide: ti, run: ru, plant: pl, watch: wa, traffic: tr }
}

/** The bridge and engine-room report for a sailing at a whole minute. Not kept on the device: an old reading is not a reading. */
export const nauticalFeed = createFeed<[sailing: string, minute: number], Nautical>((d, m) => `${d}|${m}`, normalizeNautical)
