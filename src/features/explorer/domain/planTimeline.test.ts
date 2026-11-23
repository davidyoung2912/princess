import { describe, expect, it } from 'vitest'
import { clashMap, disrupted, groupByPeriod, happeningNow, periodOf, walkHints, walkMinutes, type PlanItem } from './planTimeline'

const MIN = 60_000
const T0 = 1_000_000 * MIN
const item = (id: string, startMin: number, minutes: number, o: Partial<PlanItem> = {}): PlanItem => ({
  id, kind: 'event', explorer: 'entertainment', venueId: 'v', title: id, venueTitle: 'V', placeId: 'piazza', start: '10:00', startAt: T0 + startMin * MIN, endAt: T0 + (startMin + minutes) * MIN, status: 'on', ...o,
})

describe('periodOf', () => {
  it('splits the day at noon and 5 pm', () => {
    expect(['00:00', '11:59', '12:00', '16:59', '17:00', '23:30'].map(periodOf)).toEqual(['morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening'])
  })
})

describe('groupByPeriod', () => {
  it('orders by time and drops empty parts', () => {
    const g = groupByPeriod([item('b', 30, 10, { start: '19:00' }), item('a', 0, 10, { start: '09:00' })])
    expect(g.map((x) => [x.period, x.items.map((i) => i.id)])).toEqual([['morning', ['a']], ['evening', ['b']]])
  })
})

describe('clashMap', () => {
  it('flags overlaps both ways, not touching ends, not cancelled items', () => {
    const m = clashMap([item('a', 0, 60), item('b', 30, 60), item('c', 90, 30), item('d', 0, 90, { status: 'cancelled' })])
    expect([...m.keys()].sort()).toEqual(['a', 'b'])
    expect(m.get('a')?.map((i) => i.id)).toEqual(['b'])
    expect(m.get('b')?.map((i) => i.id).sort()).toEqual(['a'])
    expect(m.has('d')).toBe(false)
  })
})

describe('disrupted', () => {
  it('lists moved and cancelled items only', () => {
    expect(disrupted([item('a', 0, 10), item('b', 5, 10, { status: 'moved' }), item('c', 1, 10, { status: 'cancelled' })]).map((i) => i.id)).toEqual(['c', 'b'])
  })
})

describe('walkMinutes', () => {
  it('is 0 for the same place and null for an unknown one', () => {
    expect(walkMinutes('piazza', 'piazza')).toBe(0)
    expect(walkMinutes('piazza', 'nowhere')).toBeNull()
  })
  it('grows with decks and sections and is symmetric', () => {
    const near = walkMinutes('piazza', 'wheelhouse')!
    const far = walkMinutes('piazza', 'lido-pool')!
    expect(near).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(near)
    expect(walkMinutes('lido-pool', 'piazza')).toBe(far)
  })
})

describe('walkHints', () => {
  it('hints the walk from the previous running item and says when the gap is too short', () => {
    const a = item('a', 0, 30, { placeId: 'piazza' })
    const b = item('b', 33, 30, { placeId: 'lido-pool' })
    const h = walkHints([a, b]).get('b')!
    expect(h.from.id).toBe('a')
    expect(h.leaveBy).toBe(b.startAt - h.minutes * MIN)
    expect(h.tight).toBe(h.minutes * MIN > 3 * MIN)
  })
  it('skips overlaps, cancelled items and unknown places', () => {
    expect(walkHints([item('a', 0, 30), item('b', 10, 30, { placeId: 'lido-pool' })]).size).toBe(0)
    expect(walkHints([item('a', 0, 30), item('b', 40, 30, { placeId: 'lido-pool', status: 'cancelled' })]).size).toBe(0)
    expect(walkHints([item('a', 0, 30), item('b', 40, 30, { placeId: 'unknown' })]).size).toBe(0)
  })
})

describe('happeningNow', () => {
  it('lists running events with minutes left, rounded up', () => {
    const now = T0 + 10 * MIN + 1
    const r = happeningNow([item('a', 0, 30), item('b', 20, 30), item('c', 0, 30, { status: 'cancelled' })], now)
    expect(r.map((x) => [x.event.id, x.minutesLeft])).toEqual([['a', 20]])
  })
})
