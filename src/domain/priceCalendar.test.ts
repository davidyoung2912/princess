import { describe, expect, it } from 'vitest'
import { calendarRows, compareRows, inHurricaneSeason, inPeakMonth, weeksUntil } from './priceCalendar'

const s = (id: string, departure: string, nights = 7, holiday = false) => ({ id, departure, nights, holiday, month: departure.slice(0, 7) })
const prices: Record<string, number | null> = { a: 100_000, b: 50_000, c: null, d: 200_000 }

describe('calendarRows', () => {
  const rows = calendarRows([s('d', '2027-08-01', 14), s('a', '2027-01-10'), s('b', '2027-02-14', 7, true), s('c', '2027-03-01')], (id) => prices[id] ?? null, '2027-01-01')
  it('orders by date and scales bars to the dearest', () => {
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(rows.map((r) => r.barPercent)).toEqual([50, 25, 0, 100])
  })
  it('badges cheapest, best value, holiday and hurricane season', () => {
    expect(rows[1].badges).toEqual(['cheapest', 'bestValue', 'holiday'])
    expect(rows[0].badges).toEqual(['quieter'])
    expect(rows[3].badges).toEqual(['hurricane'])
    expect(rows[2].badges).toEqual(['quieter'])
  })
  it('gives no price badges for a single price', () => {
    expect(calendarRows([s('a', '2027-01-10')], () => 1000, '2027-01-01')[0].badges).toEqual(['quieter'])
  })
})

describe('weeksUntil and season', () => {
  it('counts whole weeks and nulls the past', () => {
    expect(weeksUntil('2027-01-15', '2027-01-01')).toBe(2)
    expect(weeksUntil('2026-12-31', '2027-01-01')).toBeNull()
  })
  it('knows June to November', () => {
    expect(inHurricaneSeason('2027-06')).toBe(true)
    expect(inHurricaneSeason('2027-12')).toBe(false)
  })
})

describe('quieter and compareRows', () => {
  it('treats summer and December as peak', () => {
    expect(inPeakMonth('2027-07')).toBe(true)
    expect(inPeakMonth('2027-12')).toBe(true)
    expect(inPeakMonth('2027-10')).toBe(false)
  })
  const rows = calendarRows([s('a', '2027-01-10'), s('b', '2027-02-14', 14), s('c', '2027-03-01')], (id) => prices[id] ?? null, '2027-01-01')
  it('compares two prices', () => {
    const c = compareRows(rows[0], rows[1])
    expect(c.difference).toBe(-50_000)
    expect(c.cheaper).toBe('second')
    expect(c.perNightDifference).toBe(-10_714)
  })
  it('cannot compare without a price', () => {
    expect(compareRows(rows[0], rows[2]).cheaper).toBeNull()
  })
})
