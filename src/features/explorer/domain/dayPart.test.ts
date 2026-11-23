import { describe, expect, it } from 'vitest'
import { dayPartOf } from './dayPart'

describe('dayPartOf', () => {
  it('splits the day at 5, 9, 17 and 20 o\'clock', () => {
    expect(['00:00', '04:59'].map(dayPartOf)).toEqual(['smallHours', 'smallHours'])
    expect(['05:00', '08:59'].map(dayPartOf)).toEqual(['morning', 'morning'])
    expect(['09:00', '16:59'].map(dayPartOf)).toEqual(['day', 'day'])
    expect(['17:00', '19:59'].map(dayPartOf)).toEqual(['evening', 'evening'])
    expect(['20:00', '23:59'].map(dayPartOf)).toEqual(['night', 'night'])
  })
  it('counts 24:00 and later as the small hours, and ignores what is not a time', () => {
    expect(dayPartOf('24:00')).toBe('smallHours')
    expect(dayPartOf('25:30')).toBe('smallHours')
    expect(dayPartOf('')).toBeNull()
    expect(dayPartOf('soon')).toBeNull()
  })
})
