import { describe, expect, it } from 'vitest'
import { cancelOn, cancelSteps, ifMissed, moveCheck, oneCannotGo, paidBy, paymentCalendar, paymentSchedule, priceDrop, type WhatIfBooking } from './whatIf'
import { paymentPlan } from './trip'

const plan = paymentPlan(400_000, '2027-03-21', 90)
const booking = (over: Partial<WhatIfBooking> = {}): WhatIfBooking => ({ plan, guests: 2, today: '2026-12-01', departure: '2027-03-21', balancePaid: false, finalDays: 90, ...over })

describe('what if (S2-01)', () => {
  it('keeps only the deposit for an early cancel, with the refund in dollars', () => {
    const o = cancelOn(booking(), '2026-12-15')
    expect(o.tier).toBe('early')
    expect(o.fee).toBe(plan.deposit)
    expect(o.refund).toBe(0)
  })

  it('costs more the later the cancel, and uses what would have been paid by then', () => {
    const late = cancelOn(booking(), '2027-02-20')
    expect(late.tier).toBe('late')
    expect(late.paid).toBe(plan.total)
    expect(late.fee).toBe(300_000)
    expect(late.refund).toBe(100_000)
    expect(cancelOn(booking(), '2027-03-15').refund).toBe(0)
  })

  it('lists the dates the cost steps up, in order, once each', () => {
    const steps = cancelSteps(booking())
    expect(steps.map((s) => s.tier)).toEqual(['early', 'mid', 'late', 'final'])
    expect(steps.map((s) => s.from)).toEqual([...steps.map((s) => s.from)].sort())
  })

  it('works out one traveller leaving as their share only', () => {
    const o = oneCannotGo(booking(), '2027-02-20')!
    expect(o.share).toBe(200_000)
    expect(o.fee).toBe(150_000)
    expect(o.remaining).toBe(1)
    expect(oneCannotGo(booking({ guests: 1 }), '2027-02-20')).toBeNull()
  })

  it('allows a price drop before the final date and not after, and never a rise', () => {
    expect(priceDrop(booking(), 380_000)).toEqual({ ok: true, saving: 20_000, newTotal: 380_000 })
    expect(priceDrop(booking(), 400_000)).toEqual({ ok: false, reason: 'notLower' })
    expect(priceDrop(booking({ today: '2027-02-01' }), 380_000)).toEqual({ ok: false, reason: 'afterFinal' })
  })

  it('checks a move against the final payment date', () => {
    expect(moveCheck(booking(), '2027-04-11')).toBe('ok')
    expect(moveCheck(booking(), '2027-03-21')).toBe('same')
    expect(moveCheck(booking({ today: '2027-02-01' }), '2027-04-11')).toBe('tooLate')
  })
})

describe('payment schedule (S2-05)', () => {
  it('shows a paid deposit and a balance that is later, due or overdue', () => {
    expect(paymentSchedule(booking({ today: '2026-10-01' })).map((i) => i.state)).toEqual(['paid', 'later'])
    expect(paymentSchedule(booking())[1].state).toBe('due')
    expect(paymentSchedule(booking({ today: '2027-01-01' }))[1].state).toBe('overdue')
    expect(paymentSchedule(booking({ balancePaid: true }))[1].state).toBe('paid')
  })

  it('says in dollars what a missed payment means', () => {
    const text = ifMissed(booking())
    expect(text).toContain('$3,200')
    expect(text).toMatch(/Guest Services/)
  })

  it('makes a calendar with a week-before and a day-of reminder, none for what is paid', () => {
    const ics = paymentCalendar(booking(), 'AB12', Date.UTC(2026, 11, 1))
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261221')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261214')
    expect(paymentCalendar(booking({ balancePaid: true }), 'AB12', 0).match(/BEGIN:VEVENT/g)).toBeNull()
  })

  it('assumes the balance is paid once the date passes', () => {
    expect(paidBy(booking(), '2026-12-20')).toBe(plan.deposit)
    expect(paidBy(booking(), '2027-01-01')).toBe(plan.total)
  })
})
