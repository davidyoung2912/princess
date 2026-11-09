import { describe, expect, it } from 'vitest'
import { clockPill, heroCount, pickMoment, relativeIn, ringFraction, voyagePosition } from './homeLook'

describe('home look helpers', () => {
  it('places stages on the voyage line', () => {
    expect(voyagePosition('dream')).toMatchObject({ index: 0, percent: 0 })
    expect(voyagePosition('remember')).toMatchObject({ percent: 100, total: 11 })
  })
  it('clamps ring fractions', () => {
    expect(ringFraction(3, 5)).toBe(0.6)
    expect(ringFraction(9, 5)).toBe(1)
    expect(ringFraction(1, 0)).toBe(0)
  })
  it('makes the countdown a hero number with a weekly caption', () => {
    expect(heroCount(23)).toEqual({ kind: 'days', value: 23, caption: 3 })
    expect(heroCount(30)).toEqual({ kind: 'days', value: 30, caption: 0 })
    expect(heroCount(0)).toEqual({ kind: 'today' })
    expect(heroCount(-2)).toEqual({ kind: 'sailed' })
  })
  it('words relative times', () => {
    expect(relativeIn(-1)).toBeNull()
    expect(relativeIn(10_000)).toEqual({ unit: 'now', count: 0 })
    expect(relativeIn(25 * 60_000)).toEqual({ unit: 'min', count: 25 })
    expect(relativeIn(3 * 3_600_000)).toEqual({ unit: 'hour', count: 3 })
    expect(relativeIn(50 * 3_600_000)).toEqual({ unit: 'day', count: 2 })
  })
  it('flags a phone clock that differs from the ship', () => {
    expect(clockPill(0).tone).toBe('ok')
    expect(clockPill(-1)).toEqual({ tone: 'warn', hours: -1 })
  })
  it('picks the most pressing moment', () => {
    expect(pickMoment({})).toBeNull()
    expect(pickMoment({ muster: { done: false, required: true, time: '4:00 PM' }, allAboard: { time: '4:30 PM', minutesLeft: 20 } })?.key).toBe('moment.muster')
    expect(pickMoment({ allAboard: { time: '4:30 PM', minutesLeft: 20 } })).toMatchObject({ key: 'moment.allAboard', urgent: true })
    expect(pickMoment({ allAboard: { time: '4:30 PM', minutesLeft: 400 } })).toBeNull()
    expect(pickMoment({ checkin: { state: 'notOpen', opensInDays: 2 } })?.key).toBe('moment.checkinSoon')
    expect(pickMoment({ checkin: { state: 'notOpen', opensInDays: 40 } })).toBeNull()
    expect(pickMoment({ payment: { overdue: true, daysToFinal: -3 }, checkin: { state: 'open', opensInDays: 0 } })).toMatchObject({ key: 'moment.payment', urgent: true })
  })
})
