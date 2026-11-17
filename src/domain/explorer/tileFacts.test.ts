import { describe, expect, it } from 'vitest'
import { eventsOnNow, nextTable, nextTour, nextTreatment } from './tileFacts'
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

describe('nextTour', () => {
  it('names the earliest tour that has not left', () => {
    expect(nextTour([{ start: '13:30' }, { start: '09:00' }], '08:15')).toBe('a tour at 9:00 AM')
    expect(nextTour([{ start: '13:30' }, { start: '09:00' }], '10:00')).toBe('a tour at 1:30 PM')
  })
  it('says nothing when every tour has left or none is booked', () => {
    expect(nextTour([{ start: '09:00' }], '09:01')).toBeNull()
    expect(nextTour([], '08:00')).toBeNull()
  })
})

describe('eventsOnNow', () => {
  const at = (h: number) => h * 3_600_000
  it('counts events in progress, singular and plural', () => {
    expect(eventsOnNow([{ startAt: at(1), endAt: at(3), status: 'on' }], at(2))).toBe('1 event')
    expect(eventsOnNow([{ startAt: at(1), endAt: at(3), status: 'on' }, { startAt: at(2), endAt: at(4), status: 'moved' }, { startAt: at(1), endAt: at(3), status: 'on' }], at(2))).toBe('3 events')
  })
  it('leaves out cancelled, not yet started and finished events, and says nothing when none is on', () => {
    expect(eventsOnNow([{ startAt: at(1), endAt: at(3), status: 'cancelled' }, { startAt: at(5), endAt: at(6), status: 'on' }, { startAt: at(0), endAt: at(1), status: 'on' }], at(2))).toBeNull()
    expect(eventsOnNow([], at(2))).toBeNull()
  })
})
