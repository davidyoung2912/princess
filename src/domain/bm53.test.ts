import { describe, expect, it } from 'vitest'
import { liveSignals, normalizeSignals, sendSignal, signalsOpen } from './arrivalSignal'
import { alertState, newAlert, normalizeAlerts, removeAlert, setPaused } from './fareAlert'
import { activeShare, normalizeShares, previewFor, revoke, share } from './passport'
import { earlierDates, noteDeadlines } from './deadlineLog'
import { impactedOn } from './recompose'
import { normalizeContributions, payerView, planContributions, setStatus, summary } from './contributions'
import { creditLine } from './creditLines'
import { eventAccess } from './eventAccess'
import { closePoll, castVote, newPoll, normalizeBoard, pollResultText } from './board'
import { travelItems, EMPTY_PLAN } from './travel'
import { deliveryOf, CHAT_NOTIFICATION_PREVIEW } from './chat'
import { openDuplicate, withContact } from './services'
import { PUSH_KINDS } from '../push/push'
import type { ExcursionItem } from './excursions'
import type { PlanDay } from './plan'

describe('arrival signals (GTS-10)', () => {
  it('are open only before embarkation and sent once', () => {
    expect(signalsOpen('checkIn')).toBe(true)
    expect(signalsOpen('embarkation')).toBe(false)
    const once = sendSignal([], 'departed', 5, true)
    expect(sendSignal(once, 'departed', 9, true)).toEqual(once)
    expect(sendSignal([], 'arrived', 5, false)).toEqual([])
  })
  it('are not shown once embarkation has begun, and bad data is dropped', () => {
    const sent = sendSignal([], 'atMeetingPoint', 5, true)
    expect(liveSignals(sent, false)).toEqual([])
    expect(normalizeSignals([{ kind: 'x', at: 1 }, { kind: 'arrived', at: 2 }, { kind: 'arrived', at: 3 }])).toEqual([{ kind: 'arrived', at: 2 }])
  })
})

describe('fare alerts (DRM-16)', () => {
  it('are tied to a sailing and room type, pause and delete', () => {
    const one = newAlert({ id: 'a', sailingId: 's1', category: 'Balcony', belowCents: 100_000 }, 1, [])!
    expect(newAlert({ id: 'b', sailingId: 's1', category: 'Balcony', belowCents: 90_000 }, 2, one)).toBeNull()
    expect(newAlert({ id: 'c', sailingId: 's1', category: 'Balcony', belowCents: 50 }, 2, [])).toBeNull()
    expect(alertState(one[0], 99_000)).toBe('met')
    expect(alertState(one[0], 120_000)).toBe('watching')
    const paused = setPaused(one, 'a', true)
    expect(alertState(paused[0], 99_000)).toBe('paused')
    expect(removeAlert(paused, 'a')).toEqual([])
    expect(normalizeAlerts([{ id: 'a', sailingId: 's', category: 'c', belowCents: 5 }])).toEqual([])
  })
})

describe('accessibility passport (QOL-20)', () => {
  const reqs = [{ kind: 'wheelchair', guest: 'a' }, { kind: 'dietary', guest: 'a' }, { kind: 'assistiveListening', guest: 'b' }]
  it('previews only what a recipient needs', () => {
    expect(previewFor('transfers', reqs).map((r) => r.kind)).toEqual(['wheelchair'])
    expect(previewFor('excursions', reqs).map((r) => r.kind)).toEqual(['wheelchair', 'assistiveListening'])
    expect(previewFor('booking', reqs)).toHaveLength(3)
  })
  it('shares, revokes and can share again', () => {
    const on = share([], 'ship', 10)
    expect(activeShare(on, 'ship')?.sharedAt).toBe(10)
    expect(share(on, 'ship', 20)).toEqual(on)
    const off = revoke(on, 'ship', 30)
    expect(activeShare(off, 'ship')).toBeUndefined()
    expect(activeShare(share(off, 'ship', 40), 'ship')?.sharedAt).toBe(40)
    expect(normalizeShares([{ recipient: 'nobody', sharedAt: 1 }])).toEqual([])
  })
})

describe('deadline history (MNG-15)', () => {
  it('starts a new event when a date moves and keeps the old one', () => {
    const a = noteDeadlines([], [{ id: 'pay', date: '2027-01-10' }], 1)
    expect(noteDeadlines(a, [{ id: 'pay', date: '2027-01-10' }], 2)).toEqual(a)
    const b = noteDeadlines(a, [{ id: 'pay', date: '2027-01-17' }], 3)
    expect(b).toHaveLength(2)
    expect(earlierDates(b, 'pay').map((e) => e.date)).toEqual(['2027-01-10'])
    expect(b.find((e) => e.date === '2027-01-17')?.supersededAt).toBeNull()
  })
})

describe('weather recomposer (QOL-15)', () => {
  const ex = (id: string, start: string, hours: number, rating: number): ExcursionItem => ({ id, port: 'cozumel', name: id, summary: '', hours, price: 100, activity: 'easy', wheelchair: true, family: true, interests: [], rating, reviews: 1, meeting: '', start, capacity: 10 })
  const catalogue = [ex('snorkel', '09:00', 3, 4.5), ex('ruins', '09:30', 3, 4.9), ex('beach', '14:00', 2, 4.0), ex('tequila', '14:30', 2, 4.7), ex('spa', '16:00', 1, 3.0)]
  const day = { day: 3, date: '2027-03-01', port: 'cozumel', place: 'Cozumel', gaps: [], entries: [{ kind: 'tour', time: '09:00', name: 'snorkel', id: 'b1', guests: ['a'] }, { kind: 'dinner', time: '19:00', name: 'Sala', id: 'd1', guests: ['a'] }] } as unknown as PlanDay
  it('lists the reservations, suggests tours that fit, and changes nothing', () => {
    const out = impactedOn(day, catalogue, (id) => (id === 'b1' ? 'snorkel' : null))
    expect(out.map((i) => i.kind)).toEqual(['tour', 'dinner'])
    expect(out[0].alternatives.map((a) => a.id)).toEqual(['ruins', 'tequila'])
    expect(out[1].alternatives).toEqual([])
    expect(impactedOn(undefined, catalogue, () => null)).toEqual([])
  })
})

describe('invited payers (BOK-10)', () => {
  const payers = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cy' }]
  it('splits to the cent, shows a payer only their own row, and counts status', () => {
    const plan = planContributions(10_001, payers, '2027-01-10')!
    expect(plan.rows.map((r) => r.cents)).toEqual([3334, 3334, 3333])
    expect(plan.rows.reduce((s, r) => s + r.cents, 0)).toBe(10_001)
    expect(payerView(plan, 'b')).toMatchObject({ payer: 'b', cents: 3334, due: '2027-01-10', status: 'pending' })
    expect(payerView(plan, 'z')).toBeNull()
    const next = setStatus(setStatus(plan, 'a', 'paid'), 'c', 'failed')
    expect(summary(next)).toEqual({ paid: 1, pending: 1, failed: 1, paidCents: 3334, leftCents: 6667 })
    expect(normalizeContributions(JSON.parse(JSON.stringify(next)))).toEqual(next)
  })
  it('needs two payers, a total and a date', () => {
    expect(planContributions(100, payers.slice(0, 1), '2027-01-10')).toBeNull()
    expect(planContributions(0, payers, '2027-01-10')).toBeNull()
    expect(planContributions(100, payers, 'soon')).toBeNull()
  })
})

describe('credit lines (BOK-12)', () => {
  it('shows source, amount, use and residual, and why a credit is not fully used', () => {
    expect(creditLine(0, 0, true)).toBeNull()
    expect(creditLine(50_000, 0, false)).toMatchObject({ amount: 50_000, applied: 0, residual: 50_000, eligible: true, why: 'notChosen' })
    expect(creditLine(50_000, 30_000, true)).toMatchObject({ applied: 30_000, residual: 20_000, why: 'minimumPaid' })
    expect(creditLine(50_000, 50_000, true)).toMatchObject({ residual: 0, why: 'none' })
    expect(creditLine(50_000, 0, true)).toMatchObject({ eligible: false, why: 'minimumPaid' })
  })
})

describe('event access (SEA-18)', () => {
  it('shows only verified features', () => {
    expect(eventAccess('stage-show')).toContain('captions')
    expect(eventAccess('trivia')).toEqual([])
  })
})

describe('closing a poll (DRM-14)', () => {
  const poll = castVote(castVote(newPoll('p', 'Where?', ['Alaska', 'Greece'])!, 'a', 'o1'), 'b', 'o1')
  it('stops further votes and keeps the result', () => {
    const closed = closePoll(poll, 9)
    expect(castVote(closed, 'c', 'o2')).toEqual(closed)
    expect(closePoll(closed, 99).closedAt).toBe(9)
    expect(normalizeBoard({ polls: [JSON.parse(JSON.stringify(closed))] }).polls[0].closedAt).toBe(9)
  })
  it('exports the result without voter names', () => {
    const text = pollResultText(poll, { winner: 'Chosen: {label}', tie: 'tie', none: 'none', votes: (n) => `${n} votes` })
    expect(text).toBe('Where?\n- Alaska: 2 votes\n- Greece: 0 votes\nChosen: Alaska')
  })
})

describe('travel to the port (MNG-09)', () => {
  it('lists chosen items with provider, contact, timing and a plan, and flags outside bookings', () => {
    expect(travelItems(EMPTY_PLAN)).toEqual([])
    const items = travelItems({ window: '11:00', mode: 'shuttle', hotel: 'seabreeze' })
    expect(items.map((i) => i.kind)).toEqual(['hotel', 'transport', 'terminal'])
    for (const i of items) expect(i.provider && i.contact && i.timing && i.ifDisrupted).toBeTruthy()
    expect(items[0].external).toBe(true)
    expect(travelItems({ window: null, mode: 'transfer', hotel: null })[0].external).toBe(false)
  })
})

describe('party chat (SEA-16)', () => {
  it('shows a delivery state and never notifies', () => {
    expect(deliveryOf({})).toBe('sent')
    expect(deliveryOf({ seenBy: ['a'] })).toBe('seen')
    expect(CHAT_NOTIFICATION_PREVIEW).toBe('none')
    expect(PUSH_KINDS.some((k) => /chat|message/i.test(k))).toBe(false)
  })
})

describe('cabin issue cases (EMB-07)', () => {
  it('points a repeat request at the open one, and carries the contact choice', () => {
    const rows = [{ id: '1', item: 'towels', stage: 'received' }, { id: '2', item: 'pillow', stage: 'done' }]
    expect(openDuplicate(rows, 'towels')?.id).toBe('1')
    expect(openDuplicate(rows, 'pillow')).toBeUndefined()
    expect(withContact('phone', '  hi ')).toBe('[contact: phone] hi')
  })
})
