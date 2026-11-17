import { describe, expect, it } from 'vitest'
import { nextTable, nextTreatment } from './tileFacts'
import { tileLine } from './lens'

describe('tile facts', () => {
  it('finds the next table today and ignores other days and past times', () => {
    const r = [{ day: 2, time: '19:00' }, { day: 2, time: '17:30' }, { day: 3, time: '12:00' }]
    expect(nextTable(r, 2, '16:00')).toBe('a table at 5:30 PM')
    expect(nextTable(r, 2, '18:00')).toBe('a table at 7:00 PM')
    expect(nextTable(r, 2, '20:00')).toBeNull()
    expect(nextTable([], 2, '08:00')).toBeNull()
  })
  it('finds the next treatment that has not started', () => {
    const a = [{ day: 1, time: '10:00', startAt: 100 }, { day: 1, time: '14:30', startAt: 300 }]
    expect(nextTreatment(a, 1, 200)).toBe('a treatment at 2:30 PM')
    expect(nextTreatment(a, 1, 400)).toBeNull()
  })
  it('words booked and to go before sailing, and the cart for tours', () => {
    const g = { status: 'open' } as const
    expect(tileLine({ stage: 'prebook', explorer: 'dining', gate: g, counts: { booked: 2, toGo: 1 } })).toEqual({ key: 'explorers.bookedToGo', params: { booked: 2, toGo: 1 } })
    expect(tileLine({ stage: 'prebook', explorer: 'dining', gate: g, counts: { booked: 2, toGo: 0 } })).toEqual({ key: 'explorers.booked', params: { booked: 2 } })
    expect(tileLine({ stage: 'getToShip', explorer: 'excursions', gate: g, counts: { inCart: 1 } })).toEqual({ key: 'explorers.inCart', params: { count: 1 } })
    expect(tileLine({ stage: 'prebook', explorer: 'dining', gate: g, counts: { booked: 0 } })?.key).toBe('explorers.book.dining')
  })
})
