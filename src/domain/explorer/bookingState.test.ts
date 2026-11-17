import { describe, expect, it } from 'vitest'
import type { DiningView } from '../../api/types'
import type { SpaView } from '../../api/spaTypes'
import { diningBookingCard, spaBookingCard } from './bookingState'

const view = (o: Partial<DiningView> = {}): DiningView => ({
  window: { open: true }, plan: 'anytime', seating: null, reservations: [], party: [], mealsLeft: 2, canBook: true, daysToDeparture: 20, ...o,
} as DiningView)

describe('diningBookingCard', () => {
  it('offers Reserve when the window is open and the guest can book', () => {
    const m = diningBookingCard(view(), 'ahead')
    expect(m.status).toBe('open')
    expect(m.canReserve).toBe(true)
    expect(m.compact).toBe(false)
    expect(m.facts.map((f) => f.key)).toEqual(['bk.dining.anytime', 'bk.dining.mealsLeft'])
  })
  it('replaces Reserve with the window message and date while the window is shut', () => {
    const m = diningBookingCard(view({ window: { open: false, opensOn: '2027-01-12' } }), 'ahead')
    expect(m.status).toBe('opensOn')
    expect(m.canReserve).toBe(false)
    expect(m.detail).toEqual({ key: 'dine.closedBody', params: { date: '2027-01-12' } })
    expect(m.paymentsLink).toBe(true)
  })
  it('is read only for someone who cannot book, and gives the reason', () => {
    const m = diningBookingCard(view({ canBook: false }), 'ahead')
    expect(m.status).toBe('readOnly')
    expect(m.canReserve).toBe(false)
    expect(m.detail?.key).toBe('plan.readOnly.body')
  })
  it('shows a fixed seating and no meals line when nothing is left', () => {
    const m = diningBookingCard(view({ plan: 'early', seating: '17:30', mealsLeft: 0 }), 'ahead')
    expect(m.facts).toEqual([{ key: 'bk.dining.fixed', params: { time: '17:30' } }])
  })
  it('collapses to one line aboard when open, but not when something needs attention', () => {
    expect(diningBookingCard(view(), 'aboard').compact).toBe(true)
    expect(diningBookingCard(view({ canBook: false }), 'aboard').compact).toBe(false)
    expect(diningBookingCard(view({ window: { open: false } }), 'aboard').compact).toBe(false)
  })
  it('is finished after the cruise and never offers Reserve', () => {
    const m = diningBookingCard(view(), 'after')
    expect(m.status).toBe('finished')
    expect(m.canReserve).toBe(false)
  })
  it('never reads as open before the server has answered', () => {
    const m = diningBookingCard(null, 'ahead')
    expect(m.status).toBe('closed')
    expect(m.canReserve).toBe(false)
  })
})

const spa = (o: Partial<SpaView> = {}): SpaView => ({ treatments: [], appointments: [], party: [], canBook: true, cancelFreeHours: 24, lateFeePercent: 50, maxParty: 4, ...o })

describe('spaBookingCard', () => {
  it('is open before sailing with no window, and shows the cancellation rule and party limit', () => {
    const m = spaBookingCard(spa(), 'ahead')
    expect(m.status).toBe('open')
    expect(m.canReserve).toBe(true)
    expect(m.compact).toBe(false)
    expect(m.facts).toEqual([{ key: 'spa.policy', params: { hours: 24, percent: 50 } }, { key: 'bk.spa.party', params: { max: 4 } }])
  })
  it('collapses aboard when nothing needs attention', () => {
    expect(spaBookingCard(spa(), 'aboard').compact).toBe(true)
  })
  it('is read only, with the reason, for someone who cannot book', () => {
    const m = spaBookingCard(spa({ canBook: false }), 'ahead')
    expect(m.status).toBe('readOnly')
    expect(m.canReserve).toBe(false)
    expect(m.detail?.key).toBe('plan.readOnly.body')
  })
  it('is finished after the cruise and never open while the server has not answered', () => {
    expect(spaBookingCard(spa(), 'after').status).toBe('finished')
    expect(spaBookingCard(null, 'ahead').canReserve).toBe(false)
  })
})
