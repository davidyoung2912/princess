import { describe, expect, it } from 'vitest'
import { depthGauge, depthText, differenceHours, distanceParts, speedParts, waterTempText, waveText } from '../domain/navigation'
import { normalizeAlong, normalizePosition, normalizeSea } from './navigation'

const clock = { shipTime: '14:05', shipOffsetMinutes: -300, shipZone: 'eastern', localPlace: 'cozumel', localTime: '14:05', localOffsetMinutes: -300, differenceMinutes: 0, nextChange: { at: 1_800_000_000_000, hours: -1, day: 4 } }
const position = {
  now: 1_800_000_000_000, day: 2, lat: 24.5, lon: -82.1, speedKnots: 14.8, headingDegrees: 235, compass: 'SW', inPort: null, lastPort: 'fll', nextPort: 'cozumel',
  nmSailed: 210, nmRemaining: 383, legPercent: 35, voyageNmSailed: 210, voyageNmTotal: 1700, arrival: { at: 1_800_100_000_000, shipTime: '07:00', day: 3 }, clock,
}
const sea = { now: 1_800_000_000_000, lat: 24.5, lon: -82.1, depthM: 900, depthClass: 'slope', waterTempC: 27.4, windKnots: 12, windFrom: 'ENE', beaufort: 4, seaState: 3, waveM: 0.8, swellM: 1.1, swellPeriodSeconds: 8, swellFrom: 'E' }
const landmark = { id: 'straits', name: 'Straits of Florida', kind: 'strait', blurb: 'The deep channel between the Florida Keys and Cuba.', lat: 24, lon: -81.5, closestNm: 6, side: 'port', passesAt: 1_800_003_600_000, shipTime: '15:00', day: 2, distanceNm: 40 }
const along = { now: 1_800_000_000_000, zone: { id: 'straits', name: 'Gulf Stream and Florida Straits', habitat: 'Fast, warm, deep blue water.', wildlife: ['flyingFish', 'dolphins'] }, passing: [], ahead: [landmark], behind: [] }

describe('ship position feed', () => {
  it('reads a good answer', () => {
    expect(normalizePosition(JSON.parse(JSON.stringify(position)))).toMatchObject({ speedKnots: 14.8, compass: 'SW', nextPort: 'cozumel', clock: { shipZone: 'eastern' } })
    expect(normalizePosition({ ...position, inPort: 'cozumel', speedKnots: 0, arrival: null, nextPort: null })).toMatchObject({ inPort: 'cozumel', arrival: null })
  })
  it('refuses anything out of shape', () => {
    expect(normalizePosition(null)).toBeNull()
    expect(normalizePosition({ ...position, lat: 120 })).toBeNull()
    expect(normalizePosition({ ...position, headingDegrees: 360 })).toBeNull()
    expect(normalizePosition({ ...position, compass: 'UP' })).toBeNull()
    expect(normalizePosition({ ...position, nextPort: 'mars' })).toBeNull()
    expect(normalizePosition({ ...position, nextPort: 'sea' })).toBeNull()
    expect(normalizePosition({ ...position, legPercent: 101 })).toBeNull()
    expect(normalizePosition({ ...position, clock: { ...clock, shipTime: '2pm' } })).toBeNull()
    expect(normalizePosition({ ...position, clock: { ...clock, nextChange: { at: 1, hours: 9, day: 4 } } })).toBeNull()
  })
})

describe('sea conditions feed', () => {
  it('reads a good answer and refuses a bad one', () => {
    expect(normalizeSea(sea)).toMatchObject({ depthM: 900, depthClass: 'slope', beaufort: 4 })
    expect(normalizeSea({ ...sea, depthClass: 'puddle' })).toBeNull()
    expect(normalizeSea({ ...sea, beaufort: 13 })).toBeNull()
    expect(normalizeSea({ ...sea, seaState: -1 })).toBeNull()
    expect(normalizeSea({ ...sea, swellFrom: 'up' })).toBeNull()
    expect(normalizeSea({ ...sea, waterTempC: 'warm' })).toBeNull()
  })
})

describe('along the way feed', () => {
  it('reads a good answer and refuses a bad landmark, side, kind or wildlife', () => {
    expect(normalizeAlong(along)).toMatchObject({ zone: { id: 'straits', wildlife: ['flyingFish', 'dolphins'] }, ahead: [{ id: 'straits', side: 'port' }] })
    expect(normalizeAlong({ ...along, ahead: [{ ...landmark, side: 'above' }] })).toBeNull()
    expect(normalizeAlong({ ...along, ahead: [{ ...landmark, kind: 'ufo' }] })).toBeNull()
    expect(normalizeAlong({ ...along, ahead: [{ ...landmark, shipTime: '3pm' }] })).toBeNull()
    expect(normalizeAlong({ ...along, zone: { ...along.zone, wildlife: ['unicorn'] } })).toBeNull()
    expect(normalizeAlong({ ...along, behind: 'none' })).toBeNull()
  })
})

describe('showing the figures in a guest’s units', () => {
  it('gives speed and distance in knots and nautical miles with a familiar unit beside', () => {
    expect(speedParts(10, 'metric').other).toMatch(/19 km\/h/)
    expect(speedParts(10, 'imperial').other).toMatch(/12 mph/)
    expect(distanceParts(100, 'metric')).toMatchObject({ nm: '100', other: '185 km' })
    expect(distanceParts(100, 'imperial').other).toBe('115 mi')
  })
  it('gives depth, waves and water temperature in metres and Celsius or feet and Fahrenheit', () => {
    expect(depthText(1000, 'metric')).toMatch(/1.?000 m/)
    expect(depthText(1000, 'imperial')).toMatch(/3.?281 ft/)
    expect(waveText(1, 'imperial')).toMatch(/3\.3 ft/)
    expect(waterTempText(28, 'metric')).toBe('28.0°C')
    expect(waterTempText(28, 'imperial')).toBe('82°F')
  })
  it('puts depth on a gauge that keeps a shelf visible beside a trench, and reads clock differences in hours', () => {
    expect(depthGauge(0)).toBe(0)
    expect(depthGauge(50)).toBeGreaterThan(5)
    expect(depthGauge(5000)).toBe(100)
    expect(depthGauge(99999)).toBe(100)
    expect(differenceHours(-60)).toBe(-1)
    expect(differenceHours(30)).toBe(0.5)
  })
})
