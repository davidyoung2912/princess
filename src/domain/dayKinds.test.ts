import { describe, expect, it } from 'vitest'
import { daysOf, DAY_KINDS, isDayKindOn, type DayShape } from './dayKinds'

const shape = (ports: string[], first = '2027-03-21'): DayShape[] => ports.map((port, i) => ({ port, date: new Date(Date.parse(`${first}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10) }))

const WEEK = shape(['fll', 'sea', 'cozumel', 'belize', 'roatan', 'sea', 'sea', 'fll'])
const LONG = shape(['fll', 'sea', 'cozumel', 'sea', 'belize', 'sea', 'sea', 'roatan', 'sea', 'cozumel', 'sea', 'sea', 'sea', 'belize', 'fll'])
const SHORT = shape(['fll', 'cozumel', 'sea', 'fll'])

describe('day kinds', () => {
  it('give the sample week back exactly (the days the old lists named)', () => {
    expect(daysOf(WEEK, 'embark')).toEqual([1])
    expect(daysOf(WEEK, 'night')).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(daysOf(WEEK, 'sea')).toEqual([2, 6, 7])
    expect(daysOf(WEEK, 'seaMid')).toEqual([2, 6])
    expect(daysOf(WEEK, 'firstSea')).toEqual([2])
    expect(daysOf(WEEK, 'last')).toEqual([7])
    expect(daysOf(WEEK, 'port')).toEqual([3, 4, 5])
    expect(daysOf(WEEK, 'seaMid', 'portOdd')).toEqual([2, 3, 5, 6])
    expect(daysOf(WEEK, 'last', 'portEven')).toEqual([4, 7])
    expect(daysOf(WEEK, 'friday')).toEqual([6])
  })
  it('follow a 14-night sailing', () => {
    expect(daysOf(LONG, 'sea')).toEqual([2, 4, 6, 7, 9, 11, 12, 13])
    expect(daysOf(LONG, 'last')).toEqual([14])
    expect(daysOf(LONG, 'port')).toEqual([3, 5, 8, 10, 14])
    expect(daysOf(LONG, 'night')).toHaveLength(14)
    expect(daysOf(LONG, 'portOdd')).toEqual([3, 8, 14])
  })
  it('follow a 3-night sailing, and nothing runs off the end', () => {
    expect(daysOf(SHORT, 'last')).toEqual([3])
    expect(daysOf(SHORT, 'seaMid')).toEqual([])
    for (const k of DAY_KINDS) { expect(isDayKindOn(SHORT, 0, k)).toBe(false); expect(isDayKindOn(SHORT, 5, k)).toBe(false) }
  })
})
