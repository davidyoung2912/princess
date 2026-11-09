import { describe, expect, it } from 'vitest'
import { bearingDegrees, directionWord, distanceMetres, fixIsRough, headingFromOrientation, turnBy } from './deviceSense'
import { readCode } from './scanCode'

describe('location and compass', () => {
  const a = { lat: 0, lon: 0 }
  it('measures distance and bearing', () => {
    expect(Math.round(distanceMetres(a, { lat: 0, lon: 1 }) / 1000)).toBe(111)
    expect(bearingDegrees(a, { lat: 1, lon: 0 })).toBe(0)
    expect(bearingDegrees(a, { lat: 0, lon: 1 })).toBe(90)
    expect(directionWord(315)).toBe('northwest')
  })
  it('calls a poor fix rough', () => {
    expect(fixIsRough({ ...a, accuracyM: 2000 })).toBe(true)
    expect(fixIsRough({ ...a, accuracyM: 20 })).toBe(false)
  })
  it('reads a heading only when the device gives one', () => {
    expect(headingFromOrientation({ webkitCompassHeading: 90 })).toBe(90)
    expect(headingFromOrientation({ alpha: 90, absolute: true })).toBe(270)
    expect(headingFromOrientation({ alpha: 90, absolute: false })).toBeNull()
  })
  it('turns the short way', () => {
    expect(turnBy(350, 10)).toBe(20)
    expect(turnBy(10, 350)).toBe(-20)
    expect(turnBy(null, 90)).toBe(90)
  })
})

describe('scanned codes (MOB-10)', () => {
  const o = 'https://app.test'
  it('finds a place, follows only its own links, and treats the rest as text', () => {
    expect(readCode('place:piazza', o)).toMatchObject({ kind: 'place' })
    expect(readCode('https://app.test/ship/map', o)).toEqual({ kind: 'link', path: '/ship/map' })
    expect(readCode('https://evil.test/x', o)).toMatchObject({ kind: 'text' })
    expect(readCode('  ', o)).toEqual({ kind: 'empty' })
  })
})
