import { describe, expect, it } from 'vitest'
import { aheadOnly, isDisembarkDay, lockedWhenOver } from './finished'

const base = { stage: 'aboard', day: 7, currentDay: 7, total: 7, nowTime: '10:00' } as const
const items = [{ time: '08:00' }, { time: '10:00' }, { time: '19:30' }]

describe('lockedWhenOver', () => {
  it('turns canBook off once the cruise has finished', () => {
    expect(lockedWhenOver({ canBook: true, n: 1 }, 'after')).toEqual({ canBook: false, n: 1 })
  })
  it('never switches anything on and leaves earlier stages to the server', () => {
    expect(lockedWhenOver({ canBook: false }, 'after').canBook).toBe(false)
    const v = { canBook: true }
    expect(lockedWhenOver(v, 'ahead')).toBe(v)
    expect(lockedWhenOver(v, 'aboard')).toBe(v)
  })
})

describe('disembark day', () => {
  it('is the last day, looked at on the last day, while aboard', () => {
    expect(isDisembarkDay(base)).toBe(true)
    expect(isDisembarkDay({ ...base, day: 6 })).toBe(false)
    expect(isDisembarkDay({ ...base, currentDay: 6 })).toBe(false)
    expect(isDisembarkDay({ ...base, stage: 'after' })).toBe(false)
    expect(isDisembarkDay({ ...base, stage: 'ahead' })).toBe(false)
  })
  it('lists only what is still ahead and counts what has gone', () => {
    expect(aheadOnly(items, base)).toEqual({ shown: [{ time: '10:00' }, { time: '19:30' }], earlier: 1 })
  })
  it('leaves every other day alone', () => {
    expect(aheadOnly(items, { ...base, day: 3 })).toEqual({ shown: items, earlier: 0 })
    expect(aheadOnly(items, { ...base, stage: 'ahead', currentDay: 0 })).toEqual({ shown: items, earlier: 0 })
  })
})
