import { describe, expect, it } from 'vitest'
import { compareDeals, dealValue, dealVerdict } from './offerCompare'

const fare = 400_000

describe('dealValue', () => {
  it('works out percent, money off and credit', () => {
    expect(dealValue({ kind: 'percent', amount: 5 }, fare, 0)).toBe(20_000)
    expect(dealValue({ kind: 'off', amount: 10_000 }, fare, 0)).toBe(10_000)
    expect(dealValue({ kind: 'credit', amount: 10_000 }, fare, 50_000)).toBe(10_000)
  })
  it('caps credit at what will be spent, and money off at the fare', () => {
    expect(dealValue({ kind: 'credit', amount: 10_000 }, fare, 4_000)).toBe(4_000)
    expect(dealValue({ kind: 'off', amount: 900_000 }, fare, 0)).toBe(fare)
    expect(dealValue({ kind: 'percent', amount: -3 }, fare, 0)).toBe(0)
  })
})

describe('compareDeals', () => {
  it('names the better offer and the gap each', () => {
    const c = compareDeals({ kind: 'percent', amount: 5 }, { kind: 'credit', amount: 10_000 }, fare, 2, 50_000)
    expect(c.better).toBe('a')
    expect(c.gap).toBe(10_000)
    expect(c.gapPerPerson).toBe(5_000)
    expect(c.netA).toBe(380_000)
    expect(dealVerdict(c, 2)).toBe('Offer A is worth $100 more to you ($50 each).')
  })
  it('flags trimmed credit and ties', () => {
    const c = compareDeals({ kind: 'credit', amount: 10_000 }, { kind: 'off', amount: 4_000 }, fare, 1, 4_000)
    expect(c.creditTrimmed).toBe(true)
    expect(c.better).toBe('tie')
    expect(dealVerdict(c, 1)).toMatch(/same/)
  })
})
