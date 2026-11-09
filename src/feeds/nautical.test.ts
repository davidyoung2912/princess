import { describe, expect, it } from 'vitest'
import { normalizeNautical } from './nautical'
import { degreesMinutes, headingText, lengthText, turnText, utcTime } from '../domain/nautical'

const good = {
  now: 1_800_000_000_000,
  vessel: { id: 'sun-princess', name: 'Sun Princess', shipClass: 'Sphere', flag: 'Bermuda', portOfRegistry: 'Hamilton', grossTonnage: 177882, lengthM: 345.4, beamM: 42.4, draftM: 8.6, airDraftM: 61, serviceSpeedKnots: 20, maxSpeedKnots: 22, propulsion: 'Dual-fuel', decks: 21, yearBuilt: 2024 },
  course: { headingTrue: 285, headingMagnetic: 289, variationDegrees: -4.1, courseOverGround: 287, speedOverGroundKnots: 16.2, speedThroughWaterKnots: 15.9, rateOfTurnDegreesPerMinute: 0, currentSetDegrees: 285, currentDriftKnots: 0.6, currentName: 'Caribbean Current', steering: 'Track control' },
  nearestLand: { name: 'Cozumel', bearingDegrees: 270, compass: 'W', distanceNm: 40, clearanceUnderKeelM: 700 },
  nextPort: { port: 'belize', bearingDegrees: 190, straightLineNm: 300, trackNm: 320, pilotDay: 4, pilotShipTime: '06:15' },
  tide: { state: 'rising', heightM: 0.2, rangeM: 0.5, cycle: 'between', nextHighAt: 1_800_000_100_000, nextHighShipTime: '10:00', nextLowAt: 1_800_000_200_000, nextLowShipTime: '16:00' },
  run: { last24HoursNm: 380, last24HoursAverageKnots: 15.8, toGoNm: 900 },
  plant: { generatorsOnline: 4, generatorsTotal: 6, propulsionMw: 22.1, shaftRpm: 110, fuelTankPercent: 88, fuelTonnesPerHour: 5.7, stabilisersOut: true, rollDegrees: 1.8, pitchDegrees: 0.6, bowThrusters: 'off' },
  watch: { name: 'forenoon', from: '08:00', to: '12:00', bridgeOfficers: 2, lookouts: 1, radarRangeNm: 12, navigationLightsOn: false },
  traffic: [{ kind: 'cargo', bearingDegrees: 40, distanceNm: 6.2, courseDegrees: 200, speedKnots: 14, closestApproachNm: 2.1, minutesToClosest: 20, alert: false }],
}

describe('nautical feed', () => {
  it('reads a good answer, with or without a next port', () => {
    expect(normalizeNautical(good)?.vessel.name).toBe('Sun Princess')
    expect(normalizeNautical({ ...good, nextPort: null })?.nextPort).toBeNull()
  })
  it('rejects a malformed part', () => {
    expect(normalizeNautical({ ...good, tide: { ...good.tide, state: 'sideways' } })).toBeNull()
    expect(normalizeNautical({ ...good, watch: { ...good.watch, name: 'dog' } })).toBeNull()
    expect(normalizeNautical({ ...good, course: { ...good.course, headingTrue: 360 } })).toBeNull()
    expect(normalizeNautical({ ...good, traffic: [{ ...good.traffic[0], kind: 'submarine' }] })).toBeNull()
    expect(normalizeNautical({ ...good, nextPort: { ...good.nextPort, pilotShipTime: 'soon' } })).toBeNull()
    expect(normalizeNautical({ ...good, traffic: Array(13).fill(good.traffic[0]) })).toBeNull()
    expect(normalizeNautical(undefined)).toBeNull()
  })
})

describe('nautical text', () => {
  it('gives degrees and decimal minutes, carrying a rounded-up minute', () => {
    expect(degreesMinutes(26.09)).toBe('26°05.4′')
    expect(degreesMinutes(-80.9999)).toBe('81°00.0′')
  })
  it('gives headings as three digits', () => {
    expect(headingText(5)).toBe('005°')
    expect(headingText(360)).toBe('000°')
  })
  it('converts lengths, turn rates and UTC times', () => {
    expect(lengthText(100, 'metric')).toBe('100.0 m')
    expect(lengthText(100, 'imperial')).toBe('328 ft')
    expect(turnText(1.5)).toBe('+1.5°/min')
    expect(utcTime(Date.UTC(2027, 2, 22, 7, 5))).toBe('07:05')
  })
})
