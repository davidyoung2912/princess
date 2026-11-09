import { describe, expect, it } from 'vitest'
import { emptyDraft } from './booking'
import { en } from '../i18n/locales/en'
import { alertPaths, casesFact, draftFact, loyaltyFact, medallionFact, statusFact, tabsNeedingAttention, unreadFact, allAboardFact, billFact, clubsFact, familyFact, laundryFact, minutesText, musterFact, ordersFact, wifiFact, assistanceFact, checkinFact, diningFact, excursionsFact, floatByTone, localDate, needsAttention, packagesFact, paymentFact, sourcesFor, tileLines, tonightsDinner, type Say } from './tileLive'

/** Real English, with the `count` plural forms picked the way `t` picks them. */
const say: Say = (key, vars = {}) => {
  const table = en as Record<string, string>
  const form = 'count' in vars ? (Number(vars.count) === 1 ? 'one' : 'other') : null
  const text = (form && (table[`${key}_${form}`] ?? table[`${key}_other`])) ?? table[key] ?? key
  return text.replace(/\{(\w+)\}/g, (w, n: string) => (n in vars ? String(vars[n]) : w))
}
const text = (facts: Parameters<typeof tileLines>[0], path: string) => tileLines(facts, say)[path]?.text

describe('tileLines', () => {
  it('words the checklist and packing progress, and calls a finished one ok', () => {
    const l = tileLines({ checklist: { done: 2, total: 9 }, packing: { ticked: 40, total: 40 } }, say)
    expect(l['/plan/checklist']).toEqual({ text: '2 of 9 done', tone: 'neutral', ring: { done: 2, total: 9 } })
    expect(l['/plan/packing']).toEqual({ text: '40 of 40 packed', tone: 'ok', ring: { done: 40, total: 40 } })
  })
  it('says nothing for missing or empty facts, and never more done than total', () => {
    expect(tileLines({}, say)).toEqual({})
    expect(tileLines({ checklist: { done: 0, total: 0 }, packing: null }, say)).toEqual({})
    expect(text({ packing: { ticked: 50, total: 40 } }, '/plan/packing')).toBe('40 of 40 packed')
  })
  it('counts dinners, including none, in the singular for one', () => {
    expect(text({ dinners: 0 }, '/plan/reservations')).toBe('0 dinners booked')
    expect(text({ dinners: 1 }, '/plan/reservations')).toBe('1 dinner booked')
    expect(tileLines({ dinners: null }, say)).toEqual({})
  })
  it('puts a passport problem before missing documents before ready, with matching tones', () => {
    expect(tileLines({ documents: { missing: 2, passportProblems: 1 } }, say)['/me/documents']).toEqual({ text: '1 passport to check', tone: 'warn' })
    expect(tileLines({ documents: { missing: 2, passportProblems: 0 } }, say)['/me/documents']).toEqual({ text: '2 missing', tone: 'warn' })
    expect(tileLines({ documents: { missing: 0, passportProblems: 0 } }, say)['/me/documents']).toEqual({ text: 'All ready', tone: 'ok' })
    expect(tileLines({ documents: null }, say)).toEqual({})
  })
  it('adds tonight\'s dinner time when there is one', () => {
    expect(text({ dinners: 2, tonight: '18:30' }, '/plan/reservations')).toBe('2 dinners booked, tonight at 18:30')
    expect(text({ dinners: 2, tonight: null }, '/plan/reservations')).toBe('2 dinners booked')
  })
  it('counts places open now, including none', () => {
    expect(text({ venuesOpen: 6 }, '/ship/venues')).toBe('6 open now')
    expect(text({ venuesOpen: 0 }, '/ship/venues')).toBe('0 open now')
    expect(tileLines({ venuesOpen: null }, say)).toEqual({})
  })
})

describe('sourcesFor', () => {
  it('lists only what the given screens need', () => {
    expect([...sourcesFor(['/plan/packing', '/me/documents', '/home/quiz'])].sort()).toEqual(['packing', 'trips'])
    expect(sourcesFor(['/home/quiz']).size).toBe(0)
  })
})

describe('floatByTone', () => {
  it('moves urgent then warn ahead, keeping every other order', () => {
    const tone = (id: string) => ({ a: 'ok', b: 'warn', c: undefined, d: 'urgent', e: 'warn' } as const)[id as 'a']
    expect(floatByTone(['a', 'b', 'c', 'd', 'e'], tone)).toEqual(['d', 'b', 'e', 'a', 'c'])
  })
  it('flags only an urgent line for attention', () => {
    expect(needsAttention({ text: 'x', tone: 'urgent' })).toBe(true)
    expect(needsAttention({ text: 'x', tone: 'warn' })).toBe(false)
    expect(needsAttention(undefined)).toBe(false)
  })
})

describe('dates', () => {
  it('finds the earliest dinner on today\'s date only', () => {
    const days = [{ date: '2027-01-02', entries: [{ kind: 'dinner', time: '20:00' }, { kind: 'dinner', time: '18:00' }, { kind: 'tour', time: '09:00' }] }, { date: '2027-01-03', entries: [{ kind: 'dinner', time: '17:00' }] }]
    expect(tonightsDinner(days, '2027-01-02')).toBe('18:00')
    expect(tonightsDinner(days, '2027-01-04')).toBeNull()
  })
  it('formats a local date', () => {
    expect(localDate(new Date(2027, 0, 5, 12).getTime())).toBe('2027-01-05')
  })
})

describe('phase 2 tiles', () => {
  const path = (facts: Parameters<typeof tileLines>[0], p: string) => tileLines(facts, say)[p]
  it('words the balance by how close it is, urgent once overdue', () => {
    const pay = (state: 'paid' | 'upcoming' | 'dueSoon' | 'overdue', daysToFinal: number) => path({ payment: { state, balance: 125050, daysToFinal } }, '/plan/money-plan')
    expect(pay('paid', 0)).toEqual({ text: 'Paid in full', tone: 'ok' })
    expect(pay('upcoming', 90)).toEqual({ text: 'Balance $1,250.50 due in 90 days', tone: 'neutral' })
    expect(pay('dueSoon', 1)).toEqual({ text: 'Balance $1,250.50 due in 1 day', tone: 'warn' })
    expect(pay('dueSoon', 0)).toEqual({ text: 'Balance $1,250.50 due today', tone: 'warn' })
    expect(pay('overdue', -3)).toEqual({ text: 'Balance $1,250.50 is overdue', tone: 'urgent' })
    expect(path({ payment: { state: 'paid', balance: 0, daysToFinal: 0 } }, '/me/payments')?.text).toBe('Paid in full')
    expect(path({ payment: null }, '/me/payments')).toBeUndefined()
  })
  it('says where check-in stands, and shows the pass only once checked in', () => {
    const ci = (state: 'notOpen' | 'open' | 'closed' | 'done', opensInDays = 0) => path({ checkin: { state, opensInDays } }, '/home/check-in')
    expect(ci('notOpen', 3)?.text).toBe('Opens in 3 days')
    expect(ci('notOpen', 1)?.text).toBe('Opens in 1 day')
    expect(ci('notOpen', 0)?.text).toBe('Opens today')
    expect(ci('open')).toEqual({ text: 'Open now, not done yet', tone: 'warn' })
    expect(ci('closed')?.tone).toBe('warn')
    expect(ci('done')).toEqual({ text: 'Checked in', tone: 'ok' })
    expect(path({ checkin: { state: 'done', opensInDays: 0 } }, '/home/boarding-pass')?.text).toBe('Ready to show')
    expect(path({ checkin: { state: 'open', opensInDays: 0 } }, '/home/boarding-pass')).toBeUndefined()
  })
  it('counts the days to sailing, and is quiet once sailed', () => {
    expect(text({ daysToDeparture: 42 }, '/me/trips')).toBe('Sails in 42 days')
    expect(text({ daysToDeparture: 0 }, '/me/trips')).toBe('Sails today')
    expect(path({ daysToDeparture: -2 }, '/me/trips')).toBeUndefined()
  })
  it('joins what is true about excursions and dining, and says nothing when nothing is', () => {
    expect(text({ excursions: { booked: 2, inCart: 1, creditLeft: 30000 } }, '/plan/excursions')).toBe('2 booked · 1 in your cart · $300 credit left')
    expect(path({ excursions: { booked: 0, inCart: 0, creditLeft: 0 } }, '/plan/excursions')).toBeUndefined()
    expect(text({ dining: { seating: '18:00', reservations: 1, mealsLeft: 2 } }, '/plan/dining')).toBe('Dinner at 18:00 · 1 reserved · 2 specialty dinners included')
    expect(path({ dining: { seating: null, reservations: 0, mealsLeft: 0 } }, '/plan/dining')).toBeUndefined()
  })
  it('counts packages bought only when there are some', () => {
    expect(text({ packages: { bought: 3 } }, '/me/packages')).toBe('3 bought')
    expect(path({ packages: { bought: 0 } }, '/me/packages')).toBeUndefined()
  })
  it('nudges on assistance only for waiting requests or a close cut-off', () => {
    expect(text({ assistance: { waiting: 2, cutoffDays: 3 } }, '/plan/assistance')).toBe('2 requests waiting for a reply')
    expect(path({ assistance: { waiting: 0, cutoffDays: 5 } }, '/plan/assistance')).toEqual({ text: 'Last day to ask is in 5 days', tone: 'warn' })
    expect(path({ assistance: { waiting: 0, cutoffDays: 40 } }, '/plan/assistance')).toBeUndefined()
    expect(path({ assistance: { waiting: 0, cutoffDays: null } }, '/plan/assistance')).toBeUndefined()
  })
})

describe('fact builders', () => {
  it('counts check-in days up so a closed check-in never reads 0 days early', () => {
    const now = 1_000_000
    expect(checkinFact({ state: 'notOpen', opensAt: now + 3_600_000 }, now)?.opensInDays).toBe(1)
    expect(checkinFact({ state: 'notOpen', opensAt: now + 2 * 86_400_000 }, now)?.opensInDays).toBe(2)
    expect(checkinFact({ state: 'open', opensAt: now - 5 }, now)?.opensInDays).toBe(0)
    expect(checkinFact(null, now)).toBeNull()
  })
  it('leaves cancelled tours and purchases out', () => {
    expect(excursionsFact({ booked: [{ status: 'booked' }, { status: 'cancelled' }], cart: [1], creditLeft: 5 })).toEqual({ booked: 1, inCart: 1, creditLeft: 5 })
    expect(packagesFact({ purchases: [{ status: 'active' }, { status: 'cancelled' }] })).toEqual({ bought: 1 })
  })
  it('finds the nearest cut-off among kinds not yet asked for', () => {
    const v = { requests: [{ kind: 'a', status: 'received' }, { kind: 'b', status: 'confirmed' }], deadlines: [{ kind: 'a', deadline: { daysLeft: 1 } }, { kind: 'b', deadline: { daysLeft: 2 } }, { kind: 'c', deadline: { daysLeft: 9 } }, { kind: 'd', deadline: { daysLeft: -1 } }] }
    expect(assistanceFact(v)).toEqual({ waiting: 1, cutoffDays: 9 })
  })
  it('builds the balance and dining facts', () => {
    expect(paymentFact({ payment: 'dueSoon', plan: { balance: 500 } }, 4)).toEqual({ state: 'dueSoon', balance: 500, daysToFinal: 4 })
    expect(paymentFact(null, 0)).toBeNull()
    expect(diningFact({ seating: null, reservations: [1, 2], mealsLeft: 1 })).toEqual({ seating: null, reservations: 2, mealsLeft: 1 })
  })
})

describe('phase 3 tiles (aboard)', () => {
  const path = (facts: Parameters<typeof tileLines>[0], p: string) => tileLines(facts, say)[p]
  it('puts the drill first: done is ok, due within the hour urgent, later a nudge, none says nothing', () => {
    const m = (done: boolean, required: boolean, soon: boolean) => path({ muster: { done, required, time: '4:00 PM', soon } }, '/ship/muster')
    expect(m(true, false, false)).toEqual({ text: 'Drill done', tone: 'ok' })
    expect(m(false, true, true)).toEqual({ text: 'Drill at 4:00 PM, not done yet', tone: 'urgent' })
    expect(m(false, true, false)?.tone).toBe('warn')
    expect(m(false, false, false)).toBeUndefined()
  })
  it('counts down to all-aboard on both port screens, tightening the tone', () => {
    const a = (minutesLeft: number) => path({ allAboard: { time: '4:30 pm', minutesLeft } }, '/ship/port')
    expect(a(192)).toEqual({ text: 'All aboard 4:30 pm · 3h 12m left', tone: 'neutral' })
    expect(a(90)?.tone).toBe('warn')
    expect(a(30)).toEqual({ text: 'All aboard 4:30 pm · 30 min left', tone: 'urgent' })
    expect(path({ allAboard: { time: '4:30 pm', minutesLeft: 10 } }, '/ship/safe-ashore')?.tone).toBe('urgent')
    expect(minutesText(60)).toBe('1h 0m')
  })
  it('words the bill, with what is still posting, and the ledger', () => {
    expect(path({ bill: { balance: 48210, pending: 1500, lines: 12, throughDay: 4 } }, '/me/bill')?.text).toBe('$482.10 so far · $15 still posting')
    expect(path({ bill: { balance: 48210, pending: 0, lines: 12, throughDay: 4 } }, '/me/bill/final')?.text).toBe('Final balance $482.10')
    expect(path({ bill: { balance: 0, pending: 0, lines: 0, throughDay: 1 } }, '/me/bill')?.text).toBe('Nothing owed so far')
    expect(path({ bill: { balance: 0, pending: 0, lines: 0, throughDay: 1 } }, '/me/ledger')).toBeUndefined()
    expect(path({ bill: { balance: 100, pending: 0, lines: 1, throughDay: 1 } }, '/me/ledger')?.text).toBe('1 line through day 1')
  })
  it('words orders, asking first for one that needs a choice', () => {
    expect(path({ orders: { active: 0, needsChoice: 0, etaMinutes: null } }, '/ship/order')).toBeUndefined()
    expect(path({ orders: { active: 2, needsChoice: 1, etaMinutes: 5 } }, '/ship/order')).toEqual({ text: '1 order needs your choice', tone: 'warn' })
    expect(path({ orders: { active: 1, needsChoice: 0, etaMinutes: 12 } }, '/ship/order')?.text).toBe('1 order in progress, about 12 min')
    expect(path({ orders: { active: 2, needsChoice: 0, etaMinutes: null } }, '/ship/order')?.text).toBe('2 orders in progress')
  })
  it('words laundry and Wi-Fi', () => {
    expect(path({ laundry: { inProgress: 1, freeBagLeft: true } }, '/ship/laundry')?.text).toBe('1 load with the laundry')
    expect(path({ laundry: { inProgress: 0, freeBagLeft: true } }, '/ship/laundry')?.text).toBe('Free bag still available')
    expect(path({ laundry: { inProgress: 0, freeBagLeft: false } }, '/ship/laundry')).toBeUndefined()
    expect(path({ wifi: { devices: 2, expired: 0, includedLeft: 1 } }, '/ship/wifi')).toEqual({ text: '2 devices online · 1 included left', tone: 'neutral' })
    expect(path({ wifi: { devices: 1, expired: 1, includedLeft: 0 } }, '/ship/wifi')).toEqual({ text: '1 plan expired · 1 device online', tone: 'warn' })
    expect(path({ wifi: { devices: 0, expired: 0, includedLeft: 0 } }, '/ship/wifi')).toBeUndefined()
  })
  it('puts a child not seen first, then one out of zone, then the club count', () => {
    expect(path({ family: { overdue: ['Mia'], outOfZone: ['Sam'], inClub: 1 } }, '/ship/family')).toEqual({ text: 'Mia has not been seen for a while', tone: 'urgent' })
    expect(path({ family: { overdue: ['Mia', 'Sam'], outOfZone: [], inClub: 0 } }, '/ship/family')?.text).toBe('2 children have not been seen for a while')
    expect(path({ family: { overdue: [], outOfZone: ['Sam'], inClub: 1 } }, '/ship/family')).toEqual({ text: 'Sam is outside the set zones', tone: 'warn' })
    expect(path({ family: { overdue: [], outOfZone: [], inClub: 2 } }, '/ship/family')?.text).toBe('2 in the club')
    expect(path({ family: { overdue: [], outOfZone: [], inClub: 0 } }, '/ship/family')).toBeUndefined()
  })
  it('counts club registrations, ok when all are in', () => {
    expect(path({ clubs: { registered: 2, total: 3 } }, '/plan/clubs')).toEqual({ text: '2 of 3 registered', tone: 'neutral' })
    expect(path({ clubs: { registered: 3, total: 3 } }, '/plan/clubs')?.tone).toBe('ok')
    expect(path({ clubs: { registered: 0, total: 0 } }, '/plan/clubs')).toBeUndefined()
  })
})

describe('aboard fact builders', () => {
  it('gives the drill in ship time and flags it within the hour', () => {
    const at = Date.UTC(2027, 0, 5, 21, 0)
    expect(musterFact({ done: false, required: true, at }, 'America/New_York', at - 7_200_000)).toEqual({ done: false, required: true, time: '4:00 PM', soon: false })
    expect(musterFact({ done: false, required: true, at }, 'America/New_York', at - 1_800_000)?.soon).toBe(true)
    expect(musterFact(null, 'America/New_York', at)).toBeNull()
  })
  it('counts all-aboard only while the ship is in port, rounding minutes up', () => {
    const day = { arriveAt: 1000, allAboardAt: 1000 + 3_600_000, allAboardShip: '4:30 pm' }
    expect(allAboardFact(day, 500)).toBeNull()
    expect(allAboardFact(day, 1000 + 3_540_001)).toEqual({ time: '4:30 pm', minutesLeft: 1 })
    expect(allAboardFact(day, 1000)?.minutesLeft).toBe(60)
    expect(allAboardFact(day, 1000 + 3_600_000)).toBeNull()
    expect(allAboardFact(null, 1)).toBeNull()
  })
  it('reads the folio, orders, laundry, Wi-Fi, family and clubs', () => {
    expect(billFact({ lines: [1, 2], totals: { balance: 5, pending: 1 }, throughDay: 3 })).toEqual({ balance: 5, pending: 1, lines: 2, throughDay: 3 })
    const now = 10 * 60_000
    expect(ordersFact([{ stage: 'onTheWay', etaAt: now + 5 * 60_000 }, { stage: 'preparing', etaAt: now + 20 * 60_000 }, { stage: 'delivered', etaAt: null }, { stage: 'cancelled', etaAt: null }, { stage: 'needsChoice', etaAt: null }], now)).toEqual({ active: 3, needsChoice: 1, etaMinutes: 5 })
    expect(ordersFact([{ stage: 'onTheWay', etaAt: now - 1 }], now)?.etaMinutes).toBeNull()
    expect(laundryFact({ requests: [{ stage: 'cleaning' }, { stage: 'returned' }, { stage: 'cancelled' }], freeBagLeft: false })).toEqual({ inProgress: 1, freeBagLeft: false })
    expect(wifiFact({ devices: [{ expired: false }, { expired: true }], includedLeft: 2 })).toEqual({ devices: 1, expired: 1, includedLeft: 2 })
    expect(familyFact({ kids: [{ name: 'Mia Ray', status: 'overdue' }, { name: 'Sam', status: 'inClub' }, { name: 'Lou Day', status: 'outOfZone' }] })).toEqual({ overdue: ['Mia'], outOfZone: ['Lou'], inClub: 1 })
    expect(clubsFact({ children: [{ registered: true }, { registered: false }] })).toEqual({ registered: 1, total: 2 })
  })
})

describe('phase 4 tiles', () => {
  const path = (facts: Parameters<typeof tileLines>[0], p: string) => tileLines(facts, say)[p]
  it('words alerts, cases and offers, quiet when there is nothing', () => {
    expect(path({ unread: 3 }, '/me/alerts')?.text).toBe('3 unread')
    expect(path({ unread: 0 }, '/me/alerts')).toBeUndefined()
    expect(path({ cases: { open: 2, overdue: 0 } }, '/me/cases')).toEqual({ text: '2 open', tone: 'neutral' })
    expect(path({ cases: { open: 2, overdue: 1 } }, '/me/cases')).toEqual({ text: '2 open, reply date passed', tone: 'warn' })
    expect(path({ cases: { open: 0, overdue: 0 } }, '/me/cases')).toBeUndefined()
    expect(path({ offers: 1 }, '/home/offers')?.text).toBe('1 sailing on offer')
    expect(path({ offers: 0 }, '/home/offers')).toBeUndefined()
  })
  it('words the level and credit, leaving out a level of none', () => {
    expect(path({ loyalty: { tier: 'Gold', creditLeft: 8500 } }, '/me/loyalty')?.text).toBe('Gold · $85 credit left')
    expect(path({ loyalty: { tier: null, creditLeft: 0 } }, '/me/loyalty')).toBeUndefined()
  })
  it('shows booking progress on both booking screens once a step is done', () => {
    expect(path({ draft: { done: 3, total: 7 } }, '/book/:id')?.text).toBe('3 of 7 steps done')
    expect(path({ draft: { done: 3, total: 7 } }, '/book/resume/:id')?.text).toBe('3 of 7 steps done')
    expect(path({ draft: { done: 0, total: 7 } }, '/book/:id')).toBeUndefined()
  })
  it('follows the medallion from preparing to activated', () => {
    const m = (stage: 'preparing' | 'shipped' | 'delivered' | 'collect', activated = false, canActivate = false) => path({ medallion: { stage, activated, canActivate } }, '/home/medallion')
    expect(m('preparing')?.text).toBe('Being prepared')
    expect(m('shipped')?.text).toBe('On its way')
    expect(m('delivered', false, true)).toEqual({ text: 'Arrived: ready to activate', tone: 'warn' })
    expect(m('delivered')?.text).toBe('Delivered')
    expect(m('collect')?.tone).toBe('warn')
    expect(m('delivered', true)).toEqual({ text: 'Activated', tone: 'ok' })
  })
  it('says how the services are', () => {
    expect(path({ status: { down: 0, slow: 0, total: 5 } }, '/me/status')).toEqual({ text: 'All services working', tone: 'ok' })
    expect(path({ status: { down: 0, slow: 2, total: 5 } }, '/me/status')?.text).toBe('2 services are slow')
    expect(path({ status: { down: 1, slow: 2, total: 5 } }, '/me/status')).toEqual({ text: '1 service is down', tone: 'warn' })
    expect(path({ status: { down: 0, slow: 0, total: 0 } }, '/me/status')).toBeUndefined()
  })
})

describe('tab dots', () => {
  it('marks only tabs holding an urgent line, and loads only alert screens', () => {
    const live = { '/plan/money-plan': { text: 'x', tone: 'urgent' as const }, '/ship/muster': { text: 'y', tone: 'warn' as const } }
    const tabs = [{ key: 'trip', paths: ['/plan/money-plan'] }, { key: 'ship', paths: ['/ship/muster'] }, { key: 'me', paths: [] }]
    expect([...tabsNeedingAttention(tabs, live)]).toEqual(['trip'])
    expect(alertPaths(['/plan/money-plan', '/plan/packing', '/ship/family', '/home/quiz'])).toEqual(['/plan/money-plan', '/ship/family'])
  })
  it('only the alert screens can reach urgent', () => {
    const urgentOn = [
      tileLines({ payment: { state: 'overdue', balance: 1, daysToFinal: -1 }, muster: { done: false, required: true, time: 'x', soon: true }, allAboard: { time: 'x', minutesLeft: 5 }, family: { overdue: ['A'], outOfZone: [], inClub: 0 } }, say),
    ][0]!
    const urgentPaths = Object.entries(urgentOn).filter(([, l]) => l.tone === 'urgent').map(([p]) => p).sort()
    expect(alertPaths(urgentPaths)).toEqual(urgentPaths)
  })
  it('builds the draft fact from the steps before the first unfinished one', () => {
    expect(draftFact(null, { departure: null, today: '2027-01-01' })).toBeNull()
    const fresh = draftFact(emptyDraft('d'), { departure: null, today: '2027-01-01' })
    expect(fresh?.total).toBe(7)
    expect(fresh?.done).toBe(0)
  })
  it('builds the small facts', () => {
    expect(unreadFact({ unread: 2 })).toBe(2)
    expect(casesFact({ cases: [{ stage: 'inReview', dueAt: 5 }, { stage: 'resolved', dueAt: 1 }, { stage: 'received', dueAt: 50 }] }, 10)).toEqual({ open: 2, overdue: 1 })
    expect(loyaltyFact({ tier: 'gold', creditLeft: 5 }, (x) => x.toUpperCase())).toEqual({ tier: 'GOLD', creditLeft: 5 })
    expect(loyaltyFact({ tier: 'none', creditLeft: 0 }, (x) => x)?.tier).toBeNull()
    expect(medallionFact({ stage: 'delivered', activatedAt: 1, canActivate: false })).toEqual({ stage: 'delivered', activated: true, canActivate: false })
    expect(statusFact([{ health: 'ok' }, { health: 'slow' }, { health: 'down' }])).toEqual({ down: 1, slow: 1, total: 3 })
  })
})
