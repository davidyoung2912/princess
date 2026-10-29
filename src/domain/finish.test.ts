import { describe, expect, it } from 'vitest'
import {
  ALLOWANCE_USD, TAG_GROUPS, blankCustoms, choiceProblem, customsProblem, customsSummary, disembarkTimes, gratuityCharged, groupFor, nightEntries, nextNightItem, offAt, onwardCheck, onwardProblem, tipCredit,
  type OnwardPlan,
} from './disembark'
import {
  FEEDBACK_EDIT_DAYS, SLA_HOURS, blankFeedback, caseNumber, caseProblem, caseStatus, caseWithdrawable, feedbackProblem, holdDeposit, loyaltyStatus, needsRecovery, referralCode, tierForDays,
} from './postcruise'
import { REFERENCE_SAILING } from './sailings'
import { zonedToEpoch } from './timezones'

const s = REFERENCE_SAILING
const HOUR = 3_600_000

describe('getting off the ship', () => {
  it('puts priority guests in Gold 1 and everyone else in a steady other group', () => {
    expect(groupFor('daniel|x', true)).toEqual(TAG_GROUPS[0])
    const g = groupFor('daniel|x', false)
    expect(g.color).not.toBe('gold')
    expect(groupFor('daniel|x', false)).toEqual(g)
  })

  it('knows the deadlines of the last evening and the morning', () => {
    const times = disembarkTimes(s)
    expect(times.date).toBe('2027-03-28')
    expect(times.bagsOutAt).toBe(zonedToEpoch('2027-03-27', '22:00', 'America/New_York'))
    expect(times.tipBy).toBe(zonedToEpoch('2027-03-27', '20:00', 'America/New_York'))
    expect(offAt(s, 'earlyWalkOff', TAG_GROUPS[3])).toBe(zonedToEpoch('2027-03-28', '06:30', 'America/New_York'))
    expect(offAt(s, 'tagged', TAG_GROUPS[3])).toBe(zonedToEpoch('2027-03-28', '08:30', 'America/New_York'))
  })

  it('checks a choice of bags', () => {
    const guests = ['a', 'b']
    expect(choiceProblem({ option: 'tagged', bags: { a: 2, b: 1 }, guests })).toBeNull()
    expect(choiceProblem({ option: 'tagged', bags: { a: 0, b: 0 }, guests })).toBe('noBags')
    expect(choiceProblem({ option: 'selfAssist', bags: { a: 3, b: 1 }, guests })).toBe('tooManyToCarry')
    expect(choiceProblem({ option: 'selfAssist', bags: { a: 2, b: 0 }, guests })).toBeNull()
    expect(choiceProblem({ option: 'tagged', bags: { a: 1, b: 1.5 }, guests })).toBe('badBags')
    expect(choiceProblem({ option: 'tagged', bags: { a: 1, b: 1, c: 1 }, guests })).toBe('badBags')
    expect(choiceProblem({ option: 'swim' as never, bags: { a: 1, b: 1 }, guests })).toBe('badOption')
  })
})

describe('customs', () => {
  it('checks the answers and works out what to declare against the family allowance', () => {
    expect(customsProblem(blankCustoms())).toBeNull()
    expect(customsProblem({ ...blankCustoms(), goodsUsd: -1 })).toBe('badGoods')
    expect(customsProblem({ ...blankCustoms(), goodsUsd: 12.5 })).toBe('badGoods')
    expect(customsProblem({ ...blankCustoms(), note: 'x'.repeat(201) })).toBe('badNote')
    expect(customsSummary(blankCustoms(), 4)).toEqual({ declare: [], overUsd: 0, allowanceUsd: ALLOWANCE_USD * 4 })
    expect(customsSummary({ food: true, cash: true, goodsUsd: 1000, note: '' }, 1)).toMatchObject({ declare: ['food', 'cash', 'goods'], overUsd: 200 })
    expect(customsSummary({ ...blankCustoms(), goodsUsd: 1000 }, 2).declare).toEqual([])
  })
})

describe('onward travel', () => {
  const plan = (over: Partial<OnwardPlan> = {}): OnwardPlan => ({ mode: 'airportTransfer', flightAt: '', flight: '', note: '', ...over })
  const early = offAt(s, 'earlyWalkOff', TAG_GROUPS[1])

  it('says whether a flight can be made from the time the guest leaves the ship', () => {
    // 06:30 off, 45 minutes to clear, 25 on the coach, 3 hours at the airport: 10:45 after rounding up to a quarter hour.
    expect(onwardCheck(s, plan({ flightAt: '10:30' }), early)).toMatchObject({ status: 'tooEarly', earliestFlight: '10:45' })
    expect(onwardCheck(s, plan({ flightAt: '10:45' }), early).status).toBe('tight')
    const ok = onwardCheck(s, plan({ flightAt: '13:00' }), early)
    expect(ok.status).toBe('ok')
    expect(ok.leaveBy).toBe(zonedToEpoch('2027-03-28', '09:35', 'America/New_York'))
    expect(onwardCheck(s, plan(), early)).toMatchObject({ status: 'noFlight', leaveBy: null })
  })

  it('takes longer to leave later, and a later group needs a later flight', () => {
    const late = offAt(s, 'tagged', TAG_GROUPS[5])
    expect(onwardCheck(s, plan({ flightAt: '13:00' }), late).status).not.toBe('ok')
  })

  it('checks the plan fields', () => {
    expect(onwardProblem(plan())).toBeNull()
    expect(onwardProblem(plan({ mode: 'boat' as never }))).toBe('badMode')
    expect(onwardProblem(plan({ flightAt: '25:00' }))).toBe('badFlightTime')
    expect(onwardProblem(plan({ flight: 'LONGFLIGHT1' }))).toBe('badFlight')
    expect(onwardProblem(plan({ note: 'x'.repeat(201) }))).toBe('badNote')
  })
})

describe('the final night', () => {
  const base = { sailing: s, option: null, customsDone: false, tagsOn: false, ticked: [] as string[] }
  const at = (time: string, date = '2027-03-27') => zonedToEpoch(date, time, 'America/New_York')

  it('marks items done, late, due soon or later against the clock', () => {
    const by = (now: number, over = {}) => Object.fromEntries(nightEntries({ ...base, now, ...over }).map((e) => [e.id, e.state]))
    expect(by(at('12:00'))).toMatchObject({ bill: 'upcoming', choose: 'upcoming', documents: 'upcoming' })
    expect(by(at('19:00'))).toMatchObject({ bill: 'dueSoon', carryOn: 'upcoming' })
    expect(by(at('21:00'))).toMatchObject({ bill: 'overdue', carryOn: 'dueSoon' })
    expect(by(at('21:00'), { ticked: ['bill'] }).bill).toBe('done')
  })

  it('ticks choice, customs and tags by themselves, and only asks about tagged bags for tagged guests', () => {
    const entries = nightEntries({ ...base, now: at('12:00'), option: 'tagged', customsDone: true, tagsOn: true })
    expect(Object.fromEntries(entries.map((e) => [e.id, e.automatic]))).toMatchObject({ choose: true, customs: true, tags: true, bagsOut: false })
    const carrying = nightEntries({ ...base, now: at('12:00'), option: 'selfAssist' })
    expect(carrying.map((e) => e.id)).not.toContain('bagsOut')
    expect(carrying.map((e) => e.id)).not.toContain('tags')
  })

  it('names the soonest thing left, and nothing when all is done', () => {
    const entries = nightEntries({ ...base, now: at('12:00') })
    expect(nextNightItem(entries)?.id).toBe('bill')
    expect(nextNightItem(entries.map((e) => ({ ...e, state: 'done' as const })))).toBeNull()
  })
})

describe('the gratuity', () => {
  it('charges seven nights unless a package includes it, and credits the part not kept', () => {
    expect(gratuityCharged([{ suite: false, included: false }, { suite: false, included: true }])).toBe(7 * 1650)
    expect(gratuityCharged([{ suite: true, included: false }])).toBe(7 * 1850)
    expect(tipCredit(11_550, 100)).toBe(0)
    expect(tipCredit(11_550, 50)).toBe(5775)
    expect(tipCredit(11_550, 0)).toBe(11_550)
  })
})

describe('cases', () => {
  const c = { kind: 'lostItem' as const, number: caseNumber('lostItem', 'daniel', 0), openedAt: 1_000_000_000_000, cents: 0 }

  it('gives a steady number per booking, kind and count', () => {
    expect(c.number).toMatch(/^PC-LF-\d{5}$/)
    expect(caseNumber('lostItem', 'daniel', 0)).toBe(c.number)
    expect(caseNumber('lostItem', 'daniel', 1)).not.toBe(c.number)
    expect(caseNumber('billing', 'daniel', 0)).toMatch(/^PC-BD-/)
  })

  it('moves from received to being looked at to answered, on the clock', () => {
    expect(caseStatus(c, c.openedAt + HOUR).stage).toBe('received')
    expect(caseStatus(c, c.openedAt + 25 * HOUR).stage).toBe('inReview')
    const done = caseStatus(c, c.openedAt + SLA_HOURS.lostItem * HOUR)
    expect(done.stage).toBe('resolved')
    expect(['found', 'notFound']).toContain(done.outcome)
    expect(caseWithdrawable(caseStatus(c, c.openedAt + HOUR))).toBe(true)
    expect(caseWithdrawable(done)).toBe(false)
  })

  it('gives the same answer every time for the same case', () => {
    const at = c.openedAt + 100 * HOUR
    expect(caseStatus(c, at)).toEqual(caseStatus(c, at))
  })

  it('refunds a bill query only after the answer, and says when the money arrives', () => {
    const refunded = (['daniel', 'gerald', 'maria', 'linda', 'marcus', 'priya', 'elena', 'alexander'] as const).map((b) => ({ kind: 'billing' as const, number: caseNumber('billing', b, 0), openedAt: 0, cents: 2000 })).find((x) => caseStatus(x, 200 * HOUR).outcome === 'refunded')!
    const due = SLA_HOURS.billing * HOUR
    expect(caseStatus(refunded, due - HOUR).refund).toBeNull()
    expect(caseStatus(refunded, due).refund).toMatchObject({ cents: 2000, sent: false })
    expect(caseStatus(refunded, due + 4 * 24 * HOUR).refund?.sent).toBe(true)
  })

  it('offers half of a claim and a credit after poor feedback', () => {
    const claim = { kind: 'claim' as const, number: 'PC-CL-12345', openedAt: 0, cents: 10_000 }
    expect(caseStatus(claim, 300 * HOUR)).toMatchObject({ outcome: 'goodwill', refund: { cents: 5000 } })
    expect(caseStatus({ ...claim, kind: 'recovery' }, 60 * HOUR)).toMatchObject({ outcome: 'credit', refund: { cents: 5000, sent: true } })
  })

  it('withdrawn cases stay withdrawn', () => {
    expect(caseStatus({ ...c, withdrawnAt: c.openedAt + HOUR }, c.openedAt + 500 * HOUR).stage).toBe('withdrawn')
  })

  it('checks what a guest sends', () => {
    const base = { kind: 'lostItem' as const, summary: 'A blue scarf', place: 'The Piazza', lineId: '', cents: 0 }
    expect(caseProblem(base)).toBeNull()
    expect(caseProblem({ ...base, kind: 'recovery' })).toBe('badKind')
    expect(caseProblem({ ...base, summary: 'no' })).toBe('badSummary')
    expect(caseProblem({ ...base, place: '' })).toBe('noPlace')
    expect(caseProblem({ ...base, kind: 'claim', place: '', cents: 0 })).toBe('badAmount')
    expect(caseProblem({ ...base, kind: 'billing', place: '', cents: 500 })).toBe('noLine')
    expect(caseProblem({ ...base, kind: 'billing', place: '', lineId: 'x', cents: 500 })).toBeNull()
  })
})

describe('feedback', () => {
  const ok = { ...blankFeedback(), overall: 4 }

  it('needs an overall rating and keeps every part in range', () => {
    expect(feedbackProblem(blankFeedback())).toBe('noOverall')
    expect(feedbackProblem(ok)).toBeNull()
    expect(feedbackProblem({ ...ok, areas: { ship: 6 } })).toBe('badRating')
    expect(feedbackProblem({ ...ok, areas: { bar: 3 } as never })).toBe('badRating')
    expect(feedbackProblem({ ...ok, crew: ['a', 'b', 'c', 'd'] })).toBe('badCrew')
    expect(feedbackProblem({ ...ok, crew: [' '] })).toBe('badCrew')
    expect(feedbackProblem({ ...ok, comment: 'x'.repeat(1001) })).toBe('badComment')
  })

  it('starts service recovery for a rating of 2 or below, overall or in any area', () => {
    expect(needsRecovery(ok)).toBe(false)
    expect(needsRecovery({ ...ok, overall: 2 })).toBe(true)
    expect(needsRecovery({ ...ok, areas: { dining: 1, ship: 5 } })).toBe(true)
    expect(needsRecovery({ ...ok, areas: { dining: 3 } })).toBe(false)
    expect(FEEDBACK_EDIT_DAYS).toBeGreaterThan(0)
  })
})

describe("Captain's Circle", () => {
  it('turns cruise days into levels', () => {
    expect(tierForDays(0)).toBe('none')
    expect(tierForDays(5)).toBe('gold')
    expect(tierForDays(29)).toBe('gold')
    expect(tierForDays(30)).toBe('ruby')
    expect(tierForDays(150)).toBe('elite')
  })

  it('moves a first-time cruiser to Gold and a nearly-Ruby guest to Ruby once the cruise is counted', () => {
    expect(loyaltyStatus('maria', 7, false)).toMatchObject({ after: 'none', promoted: false, next: 'gold', daysToNext: 5 })
    expect(loyaltyStatus('maria', 7, true)).toMatchObject({ after: 'gold', promoted: true, daysAfter: 7, daysToNext: 23 })
    expect(loyaltyStatus('marcus', 7, true)).toMatchObject({ before: 'gold', after: 'ruby', promoted: true })
  })

  it('never loses a level and has no next level at the top', () => {
    expect(loyaltyStatus('alexander', 7, true)).toMatchObject({ after: 'elite', next: null, daysToNext: null, promoted: false })
    expect(loyaltyStatus('gerald', 7, false).after).toBe('platinum')
  })

  it('makes a steady referral code from the name', () => {
    expect(referralCode('gerald')).toMatch(/^GERALD\d{3}$/)
    expect(referralCode('gerald')).toBe(referralCode('gerald'))
  })
})

describe('holding a cruise', () => {
  it('takes a fifth as the deposit, or the lower onboard deposit for each guest', () => {
    expect(holdDeposit(500_000, 2, false)).toBe(100_000)
    expect(holdDeposit(500_000, 2, true)).toBe(20_000)
    expect(holdDeposit(50_000, 2, true)).toBe(10_000)
  })
})
