import { describe, expect, it } from 'vitest'
import type { ExcursionOffer, TourBooking } from '../../../shared/api/types'
import type { ExcursionItem } from '../../../domain/excursions'
import { bookingsOnDay, consideredOnDay, filterDayOffers, NO_DAY_FILTER, nearestTourDay, offersOnDay } from './excursionDay'

const offer = (id: string, day: number, start: string, over: Partial<ExcursionItem> = {}): ExcursionOffer => ({
  item: { id, port: 'cozumel', name: id, summary: '', hours: 4, price: 5000, activity: 'easy', wheelchair: true, family: true, interests: ['water'], rating: 4.5, reviews: 10, meeting: '', start, capacity: 20, ...over } as ExcursionItem,
  date: '2026-01-01', day, spots: 10, timing: null, backBy: '16:00', daysToTour: 1, tender: false,
})
const booking = (excursionId: string, status: TourBooking['status'] = 'booked'): TourBooking => ({ id: `b-${excursionId}`, excursionId, guests: [], total: 0, credit: 0, methods: [], at: 0, status, cancel: { free: true, fee: 0, refund: 0 } } as unknown as TourBooking)

describe('excursion explorer day helpers', () => {
  const offers = [offer('b', 3, '10:00'), offer('a', 3, '08:30'), offer('c', 5, '09:00', { activity: 'strenuous', family: false, wheelchair: false, interests: ['adventure'] })]

  it('lists a day in start order', () => { expect(offersOnDay(offers, 3).map((o) => o.item.id)).toEqual(['a', 'b']) })
  it('lists only live bookings of the day', () => {
    const view = { offers, booked: [booking('b'), booking('a', 'cancelled'), booking('c')] }
    expect(bookingsOnDay(view, 3).map((x) => x.offer.item.id)).toEqual(['b'])
  })
  it('finds the nearest day with tours', () => {
    expect(nearestTourDay(offers, 4)).toBe(5)
    expect(nearestTourDay(offers, 1)).toBe(3)
    expect(nearestTourDay([], 1)).toBeNull()
  })
  it('lists saved but unbooked excursions of the day', () => {
    const view = { offers, booked: [booking('b')] }
    expect(consideredOnDay(view, ['excursion:a', 'excursion:b', 'excursion:c'], 3).map((o) => o.item.id)).toEqual(['a'])
  })
  it('filters by interest, level, family and access', () => {
    expect(filterDayOffers(offers, NO_DAY_FILTER)).toHaveLength(3)
    expect(filterDayOffers(offers, { ...NO_DAY_FILTER, maxActivity: 'easy' }).map((o) => o.item.id)).toEqual(['b', 'a'])
    expect(filterDayOffers(offers, { ...NO_DAY_FILTER, interest: 'adventure' }).map((o) => o.item.id)).toEqual(['c'])
    expect(filterDayOffers(offers, { ...NO_DAY_FILTER, family: true, accessible: true })).toHaveLength(2)
  })
  it('keeps out tours with a minimum age above the youngest guest', () => {
    expect(filterDayOffers(offers, { ...NO_DAY_FILTER, age: 8 }).map((o) => o.item.id)).toEqual(['b', 'a'])
    expect(filterDayOffers(offers, { ...NO_DAY_FILTER, age: 12 })).toHaveLength(3)
    expect(filterDayOffers(offers, { ...NO_DAY_FILTER, age: 0 })).toHaveLength(2)
  })
})
