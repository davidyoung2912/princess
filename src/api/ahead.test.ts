import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { clockAt } from '../domain/clock'
import { defaultDemoState, type DemoState } from '../demo/state'
import { blankContact, blankGuest, emptyDraft, type Draft, type GuestDraft } from '../domain/booking'
import { blankRegistration, consentCode, loyaltyNumberOf } from '../domain/ahead'
import { slotsFor } from '../domain/dining'
import { SCA_DEMO_CODE, type PaymentPart } from '../domain/fares'
import type { PersonaId } from '../domain/personas'
import { zonedToEpoch } from '../domain/timezones'
import { isApiError } from './errors'
import { createMockApi } from './mock'

const REAL = Date.UTC(2026, 9, 29, 16)
const SAILING = 'sun-2027-03-21'

function setup(as: PersonaId = 'daniel') {
  let who: PersonaId | null = as
  const demo: DemoState = defaultDemoState(REAL)
  let tick = REAL
  const api = createMockApi({ store: createMemoryStore(), demo: () => demo, persona: () => who, realNow: () => (tick += 1000), sleep: async () => {} })
  return {
    api,
    as: (p: PersonaId) => { who = p },
    at: (date: string, time: string, zone = 'America/New_York') => { demo.clock = clockAt(zonedToEpoch(date, time, zone), REAL, 0) },
    later: (minutes: number) => { demo.clock = clockAt(demo.clock.anchorDemo + minutes * 60_000, REAL, 0) },
  }
}

const code = async (p: Promise<unknown>) => { try { await p } catch (e) { return isApiError(e) ? `${e.code}:${e.message}` : 'other' } return null }
const guest = (first: string, dob: string): GuestDraft => ({ ...blankGuest(), firstName: first, lastName: 'Whitfield', dob, gender: 'M', citizenship: 'us', dietaryStatus: 'none' })
const draft = (over: Partial<Draft> = {}): Draft => ({
  ...emptyDraft('draft-1'), sailingId: SAILING, category: 'balcony', guests: 2, fare: 'plus',
  people: [guest('Gerald', '1955-01-15'), guest('Ruth', '1957-02-01')],
  contact: { ...blankContact(), email: 'gerald@example.com', phone: '555-0142', street: '1 Main St', city: 'Tampa', region: 'FL', postcode: '33601' },
  dining: 'anytime', accepted: { terms: true, health: true, age: true, pregnancy: true }, ...over,
})
const card = (cents: number): PaymentPart => ({ method: 'card', cardId: 'card-default', cents })

describe('Captain’s Circle number and future cruise credit in the booking (BOK-11, BOK-12)', () => {
  it('knows the signed-in person’s number, level and credit', async () => {
    const s = setup('gerald')
    expect(await s.api.ahead.perks.mine()).toEqual({ number: loyaltyNumberOf('gerald'), tier: 'platinum', creditLeft: 15_000 })
    s.as('maria')
    expect((await s.api.ahead.perks.mine()).creditLeft).toBe(0)
  })

  it('prices with the discount and credit, books at that price, and spends the credit once', async () => {
    const s = setup('gerald')
    const plain = await s.api.booking.quote(draft())
    expect(plain.total).toBe(plain.quote.total)
    expect(plain.perks).toMatchObject({ numberOk: false, discount: 0, credit: 0, creditLeft: 15_000 })
    const d = draft({ loyaltyNumber: loyaltyNumberOf('gerald'), useCredit: true })
    const q = await s.api.booking.quote(d)
    expect(q.perks.numberOk).toBe(true)
    expect(q.perks.tier).toBe('platinum')
    expect(q.perks.discount).toBeGreaterThan(0)
    expect(q.perks.credit).toBe(15_000)
    expect(q.total).toBe(plain.quote.total - q.perks.discount - q.perks.credit)
    expect(await code(s.api.booking.book({ draft: d, expectedTotal: plain.quote.total, option: 'full', parts: [card(plain.quote.total)], challenge: SCA_DEMO_CODE }))).toBe('conflict:priceChanged')
    const booked = await s.api.booking.book({ draft: d, expectedTotal: q.total, option: 'full', parts: [card(q.total)], challenge: SCA_DEMO_CODE })
    expect(booked.total).toBe(q.total)
    expect((await s.api.ahead.perks.mine()).creditLeft).toBe(0)
    expect((await s.api.booking.quote(draft({ id: 'draft-2', useCredit: true }))).perks.credit).toBe(0)
  })

  it('ignores a number that does not check out, and another person’s level', async () => {
    const s = setup('gerald')
    expect((await s.api.booking.quote(draft({ loyaltyNumber: 'CC1234567' }))).perks.discount).toBe(0)
    const other = (await s.api.booking.quote(draft({ loyaltyNumber: loyaltyNumberOf('maria') }))).perks
    expect(other.tier).toBe('gold')
  })
})

describe('travel advisors (DIS-15)', () => {
  it('answers a chat at once and promises a call-back within a day', async () => {
    const s = setup()
    const chat = await s.api.ahead.advisors.ask({ advisorId: 'adv-ocean', way: 'chat', phone: '', question: 'Which room is quietest?' })
    expect(chat[0].reply).toContain('Renata')
    expect(chat[0].callbackBy).toBeNull()
    const call = await s.api.ahead.advisors.ask({ advisorId: 'adv-ease', way: 'callback', phone: '305-555-0100', question: 'Wheelchair access please' })
    expect(call[0].callbackBy).toBe(call[0].at + 24 * 3_600_000)
    expect(call[0].reply).toBeNull()
    expect(await code(s.api.ahead.advisors.ask({ advisorId: 'nope', way: 'chat', phone: '', question: 'Hello there' }))).toBe('invalid:badAdvisor')
    s.as('ethan')
    expect(await code(s.api.ahead.advisors.ask({ advisorId: 'adv-ocean', way: 'chat', phone: '', question: 'Hello there' }))).toMatch(/^forbidden/)
  })
})

describe('marketing consent (DIS-16)', () => {
  it('subscribes in one step where that is enough', async () => {
    const s = setup()
    expect((await s.api.ahead.marketing.view()).choices.map((c) => c.state)).toEqual(['none', 'none'])
    const v = await s.api.ahead.marketing.subscribe('email', 'daniel@example.com', 'us')
    expect(v.choices[0]).toMatchObject({ state: 'confirmed', contact: 'd***@example.com' })
    expect((await s.api.ahead.marketing.withdraw('email')).choices[0].state).toBe('none')
  })

  it('needs the code from the first message where the region asks for a second step', async () => {
    const s = setup()
    const v = await s.api.ahead.marketing.subscribe('email', 'daniel@example.com', 'uk')
    expect(v.choices[0]).toMatchObject({ state: 'pending', needsCode: true, demoCode: consentCode('daniel@example.com') })
    expect(await code(s.api.ahead.marketing.confirm('email', '000000'))).toBe('invalid:wrongCode')
    expect((await s.api.ahead.marketing.confirm('email', consentCode('daniel@example.com'))).choices[0].state).toBe('confirmed')
    expect(await code(s.api.ahead.marketing.confirm('email', consentCode('daniel@example.com')))).toBe('conflict:nothingPending')
  })

  it('lets an unconfirmed ask expire, and refuses bad input and children', async () => {
    const s = setup()
    await s.api.ahead.marketing.subscribe('sms', '305-555-0100', 'eu')
    s.later(25 * 60)
    expect((await s.api.ahead.marketing.view()).choices[1].state).toBe('expired')
    expect(await code(s.api.ahead.marketing.confirm('sms', consentCode('305-555-0100')))).toBe('conflict:expired')
    expect(await code(s.api.ahead.marketing.subscribe('email', 'nope', 'us'))).toBe('invalid:badEmail')
    expect(await code(s.api.ahead.marketing.subscribe('sms', '12', 'us'))).toBe('invalid:badPhone')
    expect(await code(s.api.ahead.marketing.subscribe('fax' as never, 'x', 'us'))).toBe('invalid:badChannel')
    expect(await code(s.api.ahead.marketing.subscribe('email', 'a@b.co', 'mars' as never))).toBe('invalid:badRegion')
    s.as('ethan')
    expect(await code(s.api.ahead.marketing.subscribe('email', 'a@b.co', 'us'))).toMatch(/^forbidden/)
  })

  it('keeps one person’s choice from another', async () => {
    const s = setup()
    await s.api.ahead.marketing.subscribe('email', 'daniel@example.com', 'us')
    s.as('priya')
    expect((await s.api.ahead.marketing.view()).choices[0].state).toBe('none')
  })
})

describe('upgrade bids (MNG-06)', () => {
  it('offers higher rooms, accepts the fixed price at once, and holds a lower bid until it is decided', async () => {
    const s = setup('gerald')
    const v = await s.api.ahead.upgrades.view()
    expect(v.open).toBe(true)
    expect(v.offers.length).toBeGreaterThan(0)
    const o = v.offers[0]
    expect(await code(s.api.ahead.upgrades.bid(o.category, o.minBid - 100))).toBe('invalid:tooLow')
    expect(await code(s.api.ahead.upgrades.bid(o.category, o.buyNow + 100))).toBe('invalid:tooHigh')
    const placed = await s.api.ahead.upgrades.bid(o.category, o.minBid + 100)
    expect(placed.bids[0]).toMatchObject({ category: o.category, status: 'open' })
    expect(await code(s.api.ahead.upgrades.bid(o.category, o.minBid + 200))).toBe('conflict:duplicate')
    const withdrawn = await s.api.ahead.upgrades.withdraw(placed.bids[0].id)
    expect(withdrawn.bids[0].status).toBe('withdrawn')
    const bought = await s.api.ahead.upgrades.bid(o.category, o.buyNow)
    expect(bought.bids[0]).toMatchObject({ status: 'accepted', buyNow: true })
  })

  it('decides open bids three days before sailing, the same way each time, and then closes', async () => {
    const s = setup('gerald')
    const o = (await s.api.ahead.upgrades.view()).offers[0]
    await s.api.ahead.upgrades.bid(o.category, o.minBid)
    s.at('2027-03-19', '12:00')
    const after = await s.api.ahead.upgrades.view()
    expect(after.open).toBe(false)
    expect(['accepted', 'declined']).toContain(after.bids[0].status)
    expect((await s.api.ahead.upgrades.view()).bids[0].status).toBe(after.bids[0].status)
    expect(await code(s.api.ahead.upgrades.bid(o.category, o.buyNow))).toBe('conflict:closed')
  })

  it('is for adults only', async () => {
    const s = setup('ethan')
    const o = (await s.api.ahead.upgrades.view()).offers[0]
    expect(await code(s.api.ahead.upgrades.bid(o.category, o.buyNow))).toMatch(/^forbidden/)
  })
})

describe('kids’ clubs, and health data kept private (PRE-08, SEC-07, SEC-08)', () => {
  const reg = (over = {}) => ({ ...blankRegistration('ethan'), allergies: 'Peanuts', emergencyPhone: '305-555-0100', pickups: [{ name: 'Daniel Harper', relation: 'Father', phone: '305-555-0100' }], confirmed: true, ...over })

  it('registers a child and keeps the details', async () => {
    const s = setup('daniel')
    const before = await s.api.ahead.clubs.view()
    expect(before.children.map((c) => c.id)).toEqual(expect.arrayContaining(['ethan', 'maya']))
    expect(before.children.every((c) => !c.registered)).toBe(true)
    const after = await s.api.ahead.clubs.save(reg())
    expect(after.children.find((c) => c.id === 'ethan')).toMatchObject({ registered: true, registration: { allergies: 'Peanuts' } })
    expect((await s.api.ahead.clubs.withdraw('ethan')).children.find((c) => c.id === 'ethan')?.registered).toBe(false)
    expect(await code(s.api.ahead.clubs.withdraw('ethan'))).toBe('notFound:notFound')
  })

  it('refuses a registration with something missing, an adult, or a self sign-out under 13', async () => {
    const s = setup('daniel')
    expect(await code(s.api.ahead.clubs.save(reg({ confirmed: false })))).toBe('invalid:confirm')
    expect(await code(s.api.ahead.clubs.save(reg({ pickups: [] })))).toBe('invalid:noPickup')
    expect(await code(s.api.ahead.clubs.save({ ...reg(), childId: 'daniel' as never }))).toBe('invalid:noClub')
    expect(await code(s.api.ahead.clubs.save({ ...reg({ selfSignOut: true }), childId: 'maya' }))).toBe('invalid:selfSignOut')
  })

  it('is hidden from other bookings, and from a supervised child on the same booking', async () => {
    const s = setup('daniel')
    await s.api.ahead.clubs.save(reg())
    s.as('marcus')
    const other = await s.api.ahead.clubs.view()
    expect(other.children.every((c) => c.registration === null && !c.registered)).toBe(true)
    s.as('ethan')
    const child = await s.api.ahead.clubs.view()
    expect(child.canEdit).toBe(false)
    expect(child.children.every((c) => c.registration === null)).toBe(true)
    expect(await code(s.api.ahead.clubs.save(reg()))).toMatch(/^forbidden/)
    expect(await code(s.api.ahead.clubs.withdraw('ethan'))).toMatch(/^forbidden/)
  })

  it('closes once the cruise is over', async () => {
    const s = setup('daniel')
    s.at('2027-03-29', '12:00')
    expect(await code(s.api.ahead.clubs.save(reg()))).toBe('conflict:closed')
  })
})

describe('medallion (CHK-06)', () => {
  it('follows the date, switches on once it has arrived, and can be reported lost', async () => {
    const s = setup('gerald')
    const first = await s.api.ahead.medallion.view()
    expect(['preparing', 'shipped', 'delivered', 'collect']).toContain(first.stage)
    s.at('2027-03-15', '12:00')
    const near = await s.api.ahead.medallion.view()
    expect(near.stage).toBe('delivered')
    expect(near.canActivate).toBe(true)
    const on = await s.api.ahead.medallion.activate()
    expect(on.activatedAt).not.toBeNull()
    expect(await code(s.api.ahead.medallion.activate())).toBe('conflict:already')
    const lost = await s.api.ahead.medallion.lost()
    expect(lost).toMatchObject({ lostAt: expect.any(Number), replacement: true, activatedAt: null })
    expect(await code(s.api.ahead.medallion.lost())).toBe('conflict:already')
    expect(await code(s.api.ahead.medallion.activate())).toBe('conflict:lost')
  })

  it('cannot be switched on before it arrives or by a child', async () => {
    const s = setup('gerald')
    s.at('2026-12-01', '12:00')
    expect(await code(s.api.ahead.medallion.activate())).toBe('conflict:notDelivered')
    s.as('ethan')
    expect(await code(s.api.ahead.medallion.activate())).toMatch(/^forbidden/)
  })
})

describe('luggage tags (CHK-09)', () => {
  it('lets you choose a way, and a post only in time', async () => {
    const s = setup('daniel')
    const v = await s.api.ahead.tags.view()
    expect(v.way).toBeNull()
    expect(v.guests.length).toBe(4)
    expect(v.guests[0].printed).toContain('/')
    expect((await s.api.ahead.tags.choose('etag')).way).toBe('etag')
    expect((await s.api.ahead.tags.choose('order')).orderedAt).not.toBeNull()
    expect(await code(s.api.ahead.tags.choose('fax' as never))).toBe('invalid:badWay')
    s.at('2027-03-14', '12:00')
    expect(await code(s.api.ahead.tags.choose('order'))).toBe('conflict:tooLate')
  })

  it('estimates where the bags are once they are handed over on embarkation day', async () => {
    const s = setup('daniel')
    await s.api.ahead.tags.choose('print')
    expect(await code(s.api.ahead.tags.handedOver(true))).toBe('conflict:notYet')
    s.at('2027-03-21', '13:00')
    expect((await s.api.ahead.tags.handedOver(true)).stage).toBe('handedOver')
    s.later(130)
    expect((await s.api.ahead.tags.view()).stage).toBe('onShip')
    s.later(240)
    expect((await s.api.ahead.tags.view()).stage).toBe('delivered')
    expect((await s.api.ahead.tags.handedOver(false)).stage).toBe('atHome')
  })

  it('needs a choice first', async () => {
    const s = setup('daniel')
    s.at('2027-03-21', '13:00')
    expect(await code(s.api.ahead.tags.handedOver(true))).toBe('conflict:noTags')
  })
})

describe('fix-it flows (MNG-18)', () => {
  it('opens a case with a reference, refuses an empty one or a second while the first is fresh, and moves on with time', async () => {
    const s = setup()
    expect(await code(s.api.ahead.fix.escalate('nope' as never, 'something is wrong'))).toBe('invalid:badFlow')
    expect(await code(s.api.ahead.fix.escalate('noBooking', 'no'))).toBe('invalid:noNote')
    const rows = await s.api.ahead.fix.escalate('noBooking', 'I cannot see my booking at all')
    expect(rows[0]).toMatchObject({ flow: 'noBooking', stage: 'received', reference: 'FX-10001' })
    expect(await code(s.api.ahead.fix.escalate('noBooking', 'Still cannot see it'))).toBe('conflict:duplicate')
    s.later(25 * 60)
    expect((await s.api.ahead.fix.list())[0].stage).toBe('contacted')
    expect((await s.api.ahead.fix.escalate('noBooking', 'Still cannot see it'))).toHaveLength(2)
  })
})

describe('extra support, and cancelling kindly (SUP-07)', () => {
  it('takes a request, decides it in two days, waives the fee and lets you choose', async () => {
    const s = setup('gerald')
    expect(await code(s.api.ahead.assist.ask({ kind: 'nope' as never, phone: '305-555-0100', note: 'My wife died' }))).toBe('invalid:badKind')
    const rows = await s.api.ahead.assist.ask({ kind: 'bereavement', phone: '305-555-0100', note: 'My sister died this week' })
    expect(rows[0]).toMatchObject({ kind: 'bereavement', stage: 'received', terms: null, choice: null })
    expect(rows[0].phone).toBe('***-0100')
    expect(await code(s.api.ahead.assist.choose(rows[0].id, 'refund'))).toBe('conflict:notDecided')
    s.later(49 * 60)
    const decided = (await s.api.ahead.assist.list())[0]
    expect(decided.stage).toBe('decided')
    expect(decided.terms).toMatchObject({ fee: 0 })
    expect(decided.terms!.credit).toBeGreaterThan(decided.terms!.refund)
    expect((await s.api.ahead.assist.choose(decided.id, 'credit'))[0].choice).toBe('credit')
    expect(await code(s.api.ahead.assist.choose(decided.id, 'refund'))).toBe('conflict:already')
  })

  it('books by phone for someone who needs help, with no waiver', async () => {
    const s = setup('linda')
    const rows = await s.api.ahead.assist.ask({ kind: 'assistedBooking', phone: '305-555-0100', note: 'Please call after lunch' })
    s.later(49 * 60)
    expect((await s.api.ahead.assist.list())[0]).toMatchObject({ kind: 'assistedBooking', stage: 'decided', terms: null, id: rows[0].id })
    expect(await code(s.api.ahead.assist.choose(rows[0].id, 'refund'))).toBe('conflict:notDecided')
  })
})

describe('health checklist (MNG-19) and saved items (PRE-11)', () => {
  it('remembers ticks per person and refuses an unknown item', async () => {
    const s = setup()
    expect(await s.api.ahead.prep.get()).toEqual([])
    expect(await s.api.ahead.prep.set('med-supply', true)).toEqual(['med-supply'])
    expect(await s.api.ahead.prep.set('med-supply', false)).toEqual([])
    expect(await code(s.api.ahead.prep.set('nope', true))).toBe('invalid:badItem')
    await s.api.ahead.prep.set('med-list', true)
    s.as('priya')
    expect(await s.api.ahead.prep.get()).toEqual([])
  })

  it('saves and un-saves, and refuses odd keys', async () => {
    const s = setup()
    expect(await s.api.ahead.saved.toggle('item:spa-swedish')).toEqual(['item:spa-swedish'])
    expect(await s.api.ahead.saved.toggle('excursion:coz-snorkel')).toEqual(['item:spa-swedish', 'excursion:coz-snorkel'])
    expect(await s.api.ahead.saved.toggle('item:spa-swedish')).toEqual(['excursion:coz-snorkel'])
    expect(await code(s.api.ahead.saved.toggle('x:y'))).toBe('invalid:badKey')
    expect(await code(s.api.ahead.saved.toggle('item:' + 'a'.repeat(60)))).toBe('invalid:badKey')
  })
})

describe('things you can book or buy ahead (PRE-04, PRE-05, PRE-07, PRE-10)', () => {
  it('books a gift before boarding and charges nothing until aboard', async () => {
    const s = setup('daniel')
    const picks = await s.api.aboard.selections.add({ item: 'gift-flowers', day: 0, time: '', qty: 1 })
    expect(picks[0]).toMatchObject({ item: 'gift-flowers', total: 4500 })
    expect(await code(s.api.aboard.selections.add({ item: 'gift-champagne', day: 0, time: '', qty: 1 }))).toBeNull()
  })

  it('lets onboard credit be bought and gratuities prepaid before sailing, not after', async () => {
    const s = setup('daniel')
    expect((await s.api.aboard.money.topUp(100, 'card')).topUpTotal).toBe(100)
    const grat = (await s.api.aboard.money.view()).gratuity
    expect(grat.canChange).toBe(grat.due > 0)
    s.at('2027-03-29', '12:00')
    expect(await code(s.api.aboard.money.topUp(100, 'card'))).toBe('conflict:closed')
  })
})

describe('waitlist that books for you (PRE-14)', () => {
  it('books the table when it is offered, and says so', async () => {
    const s = setup('gerald')
    s.at('2027-03-22', '12:00')
    const full = slotsFor('crown', SAILING, 4).find((x) => x.tables === 0)!
    const joined = await s.api.waits.joinWaitlist({ venueId: 'crown', day: 4, time: full.time, guests: ['gerald'], auto: true })
    expect(joined.waitlist[0].auto).toBe(true)
    expect(joined.autoBooked).toEqual([])
    s.later(4 * 60)
    const after = await s.api.waits.list()
    expect(after.waitlist).toEqual([])
    expect(after.autoBooked).toHaveLength(1)
    expect((await s.api.plan.dining.view()).reservations.some((r) => r.venueId === 'crown' && r.day === 4 && r.time === full.time)).toBe(true)
  })

  it('leaves a manual waitlist for the guest to take', async () => {
    const s = setup('gerald')
    s.at('2027-03-22', '12:00')
    const full = slotsFor('crown', SAILING, 4).find((x) => x.tables === 0)!
    await s.api.waits.joinWaitlist({ venueId: 'crown', day: 4, time: full.time, guests: ['gerald'] })
    s.later(4 * 60)
    const after = await s.api.waits.list()
    expect(after.waitlist[0].stage).toBe('offered')
    expect(after.autoBooked).toEqual([])
  })
})
