import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { clockAt } from '../domain/clock'
import { defaultDemoState, type DemoState } from '../demo/state'
import type { PersonaId } from '../domain/personas'
import { blankFeedback } from '../domain/postcruise'
import { zonedToEpoch } from '../domain/timezones'
import { isApiError } from './errors'
import { createMockApi } from './mock'

const REAL = Date.UTC(2026, 9, 29, 16)
const HOUR = 60

function setup(as: PersonaId = 'daniel') {
  let who: PersonaId | null = as
  const demo: DemoState = defaultDemoState(REAL)
  const store = createMemoryStore()
  const api = createMockApi({ store, demo: () => demo, persona: () => who, realNow: () => REAL, sleep: async () => {} })
  return {
    api,
    as: (p: PersonaId) => { who = p },
    at: (date: string, time: string, zone = 'America/New_York') => { demo.clock = clockAt(zonedToEpoch(date, time, zone), REAL, 0) },
    later: (minutes: number) => { demo.clock = clockAt(demo.clock.anchorDemo + minutes * 60_000, REAL, 0) },
  }
}

const code = async (p: Promise<unknown>) => { try { await p } catch (e) { return isApiError(e) ? `${e.code}:${e.message}` : 'other' } return null }
const EVE = ['2027-03-27', '12:00'] as const
const OFF = ['2027-03-28', '07:00'] as const

describe('choosing how to get off', () => {
  it('opens once the ship is boarded, and not for a supervised child', async () => {
    const s = setup()
    expect(await code(s.api.disembark.choose({ option: 'tagged', bags: { daniel: 1 } }))).toBe('conflict:closed')
    s.at(...EVE)
    s.as('ethan')
    expect(await code(s.api.disembark.choose({ option: 'tagged', bags: {} }))).toBe('forbidden:This account is supervised')
    expect((await s.api.disembark.view()).canChoose).toBe(false)
  })

  it('saves a tagged choice with a tag for each guest who has bags, in the booking’s group', async () => {
    const s = setup()
    s.at(...EVE)
    const before = await s.api.disembark.view()
    expect(before).toMatchObject({ option: null, canChoose: true, closed: false })
    const v = await s.api.disembark.choose({ option: 'tagged', bags: { daniel: 2, priya: 1, ethan: 0, maya: 1 } })
    expect(v.option).toBe('tagged')
    const labels = v.guests.map((g) => g.label)
    expect(labels.filter(Boolean)).toHaveLength(3)
    expect(labels.find((l) => l?.includes('HARPER/DANIEL'))).toContain(v.group.color.toUpperCase())
    expect(v.guests.find((g) => g.id === 'ethan')?.label).toBeNull()
    expect(v.offAt.tagged).toBe(zonedToEpoch('2027-03-28', v.group.time, 'America/New_York'))
  })

  it('puts a priority guest in the first group', async () => {
    const s = setup('alexander')
    s.at(...EVE)
    const v = await s.api.disembark.view()
    expect(v).toMatchObject({ priority: true, group: { color: 'gold', number: 1 } })
  })

  it('explains what is wrong with a choice and changes nothing', async () => {
    const s = setup()
    s.at(...EVE)
    expect(await code(s.api.disembark.choose({ option: 'tagged', bags: { daniel: 0, priya: 0, ethan: 0, maya: 0 } }))).toBe('invalid:noBags')
    expect(await code(s.api.disembark.choose({ option: 'selfAssist', bags: { daniel: 3, priya: 0, ethan: 0, maya: 0 } }))).toBe('invalid:tooManyToCarry')
    expect(await code(s.api.disembark.choose({ option: 'tagged', bags: { daniel: 1, stranger: 1 } }))).toBe('invalid:badBags')
    expect((await s.api.disembark.view()).option).toBeNull()
  })

  it('closes at 10 pm and then keeps the choice made', async () => {
    const s = setup()
    s.at('2027-03-27', '21:00')
    await s.api.disembark.choose({ option: 'earlyWalkOff', bags: { daniel: 1 } })
    s.at('2027-03-27', '22:01')
    expect(await code(s.api.disembark.choose({ option: 'tagged', bags: { daniel: 1 } }))).toBe('conflict:deadline')
    const v = await s.api.disembark.view()
    expect(v).toMatchObject({ option: 'earlyWalkOff', closed: true, canChoose: false })
  })

  it('tags are only for tagged bags, and the guest says when they are on', async () => {
    const s = setup()
    s.at(...EVE)
    await s.api.disembark.choose({ option: 'selfAssist', bags: { daniel: 1 } })
    expect(await code(s.api.disembark.setTagsOn(true))).toBe('conflict:notTagged')
    await s.api.disembark.choose({ option: 'tagged', bags: { daniel: 1 } })
    expect((await s.api.disembark.setTagsOn(true)).tagsOn).toBe(true)
    expect((await s.api.disembark.choose({ option: 'selfAssist', bags: { daniel: 1 } })).tagsOn).toBe(false)
  })

  it('keeps each family’s choice to itself', async () => {
    const s = setup('daniel')
    s.at(...EVE)
    await s.api.disembark.choose({ option: 'tagged', bags: { daniel: 1 } })
    s.as('marcus')
    expect((await s.api.disembark.view()).option).toBeNull()
  })
})

describe('customs and onward travel', () => {
  it('saves one declaration for the family and says what to tell the officer', async () => {
    const s = setup()
    s.at(...EVE)
    expect((await s.api.disembark.customs()).declaration).toBeNull()
    const v = await s.api.disembark.saveCustoms({ food: true, cash: false, goodsUsd: 4000, note: ' wine  ' })
    expect(v).toMatchObject({ people: 4, allowanceUsd: 3200, overUsd: 800, declare: ['food', 'goods'], declaration: { note: 'wine' } })
    expect(await code(s.api.disembark.saveCustoms({ food: false, cash: false, goodsUsd: -5, note: '' }))).toBe('invalid:badGoods')
    s.as('priya')
    expect((await s.api.disembark.customs()).declaration?.goodsUsd).toBe(4000)
    expect((await s.api.disembark.view()).customsDone).toBe(true)
  })

  it('checks a flight against when the guest leaves the ship', async () => {
    const s = setup()
    s.at(...EVE)
    await s.api.disembark.choose({ option: 'earlyWalkOff', bags: { daniel: 1 } })
    const tight = await s.api.disembark.saveOnward({ mode: 'airportTransfer', flightAt: '10:30', flight: 'ab123', note: '' })
    expect(tight.plan?.flight).toBe('AB123')
    expect(tight.check).toMatchObject({ status: 'tooEarly', earliestFlight: '10:45' })
    expect((await s.api.disembark.saveOnward({ mode: 'airportTransfer', flightAt: '14:00', flight: '', note: '' })).check?.status).toBe('ok')
    expect(await code(s.api.disembark.saveOnward({ mode: 'airportTransfer', flightAt: '99:00', flight: '', note: '' }))).toBe('invalid:badFlightTime')
  })

  it('moves the check when the choice changes', async () => {
    const s = setup()
    s.at(...EVE)
    await s.api.disembark.choose({ option: 'earlyWalkOff', bags: { daniel: 1 } })
    await s.api.disembark.saveOnward({ mode: 'rideshare', flightAt: '12:00', flight: '', note: '' })
    const early = (await s.api.disembark.onward()).check!
    await s.api.disembark.choose({ option: 'tagged', bags: { daniel: 1 } })
    const tagged = (await s.api.disembark.onward()).check!
    expect(tagged.spare!).toBeLessThan(early.spare!)
  })
})

describe('the final night', () => {
  it('lists what is due, ticks by itself, and lets the guest tick the rest', async () => {
    const s = setup()
    s.at(...EVE)
    const first = await s.api.disembark.night()
    expect(first.entries.find((e) => e.id === 'choose')).toMatchObject({ state: 'upcoming', automatic: false })
    await s.api.disembark.choose({ option: 'tagged', bags: { daniel: 1 } })
    await s.api.disembark.saveCustoms({ food: false, cash: false, goodsUsd: 0, note: '' })
    const v = await s.api.disembark.night()
    expect(v.entries.filter((e) => e.automatic).map((e) => e.id).sort()).toEqual(['choose', 'customs'])
    expect((await s.api.disembark.tick('valuables', true)).entries.find((e) => e.id === 'valuables')?.state).toBe('done')
    expect((await s.api.disembark.tick('valuables', false)).entries.find((e) => e.id === 'valuables')?.state).not.toBe('done')
    expect(await code(s.api.disembark.tick('choose', true))).toBe('invalid:automatic')
    expect(await code(s.api.disembark.tick('nonsense', true))).toBe('invalid:badItem')
  })

  it('marks a late item late', async () => {
    const s = setup()
    s.at('2027-03-27', '23:00')
    expect((await s.api.disembark.night()).entries.find((e) => e.id === 'charge')?.state).toBe('overdue')
  })
})

describe('the final bill', () => {
  it('lets a guest keep part of the gratuity until 8 pm, and shows the credit on the bill', async () => {
    const s = setup('maria')
    s.at('2027-03-27', '15:00')
    const before = await s.api.disembark.finalBill()
    expect(before.tip).toMatchObject({ charged: 11_550, keepPercent: 100, credit: 0, canAdjust: true })
    const after = await s.api.disembark.adjustTip(50)
    expect(after.tip).toMatchObject({ keepPercent: 50, credit: 5775 })
    const line = (await s.api.onboard.folio()).lines.find((l) => l.id === 'tip-adjust')!
    expect(line).toMatchObject({ cents: -5775, category: 'credit' })
    expect(await code(s.api.disembark.adjustTip(33))).toBe('invalid:badTip')
    s.at('2027-03-27', '20:01')
    expect(await code(s.api.disembark.adjustTip(100))).toBe('conflict:deadline')
    expect((await s.api.disembark.finalBill()).tip.canAdjust).toBe(false)
  })

  it('has nothing to adjust when a package pays the gratuity', async () => {
    const s = setup('alexander')
    s.at('2027-03-27', '15:00')
    const b = await s.api.disembark.finalBill()
    expect(b.tip.charged).toBe(0)
    expect(b.tip.canAdjust).toBe(false)
  })

  it('opens receipts on the last day, and emails them to a hidden address', async () => {
    const s = setup('maria')
    s.at('2027-03-26', '12:00')
    expect(await code(s.api.disembark.emailReceipt())).toBe('conflict:closed')
    expect((await s.api.disembark.finalBill()).receipts.find((r) => r.id === 'folio')?.available).toBe(false)
    s.at(...EVE)
    const sent = await s.api.disembark.emailReceipt()
    expect(sent.emailedAt).not.toBeNull()
    expect(sent.emailedTo).toMatch(/^\w\*\*\*@/)
    expect(sent.receipts.every((r) => r.available)).toBe(true)
  })

  it('queries a charge, and the bill is not settled until it is answered', async () => {
    const s = setup('maria')
    s.at(...EVE)
    expect((await s.api.disembark.finalBill()).settled).toBe(true)
    await s.api.cases.open({ kind: 'billing', summary: 'I did not order this', place: '', lineId: 'tip-maria-1', cents: 1650 })
    const queried = await s.api.disembark.finalBill()
    expect(queried.settled).toBe(false)
    expect(queried.queries).toHaveLength(1)
    expect(await code(s.api.cases.open({ kind: 'billing', summary: 'Same one again', place: '', lineId: 'tip-maria-1', cents: 1650 }))).toBe('conflict:alreadyQueried')
    s.later(130 * HOUR)
    expect((await s.api.disembark.finalBill()).settled).toBe(true)
  })
})

describe('cases', () => {
  it('opens only from boarding and not for a child', async () => {
    const s = setup()
    expect((await s.api.cases.list()).canOpen).toBe(false)
    expect(await code(s.api.cases.open({ kind: 'lostItem', summary: 'A blue scarf', place: 'Piazza', lineId: '', cents: 0 }))).toBe('conflict:closed')
    s.at(...EVE)
    s.as('ethan')
    expect(await code(s.api.cases.open({ kind: 'lostItem', summary: 'A blue scarf', place: 'Piazza', lineId: '', cents: 0 }))).toBe('forbidden:This account is supervised')
  })

  it('follows a lost item from received to answered, and keeps it with the booking', async () => {
    const s = setup()
    s.at(...OFF)
    const list = await s.api.cases.open({ kind: 'lostItem', summary: 'A blue scarf with white dots', place: 'Eclipse Dining Room', lineId: '', cents: 0 })
    const c = list.cases[0]
    expect(c).toMatchObject({ kind: 'lostItem', stage: 'received', canWithdraw: true, outcome: null })
    expect(c.number).toMatch(/^PC-LF-\d{5}$/)
    expect(c.dueAt).toBe(c.openedAt + 72 * 3_600_000)
    s.later(25 * HOUR)
    expect((await s.api.cases.list()).cases[0].stage).toBe('inReview')
    s.later(48 * HOUR)
    const done = (await s.api.cases.list()).cases[0]
    expect(done.stage).toBe('resolved')
    expect(['found', 'notFound']).toContain(done.outcome)
    expect(await code(s.api.cases.withdraw(done.id))).toBe('conflict:tooLate')
    s.as('priya')
    expect((await s.api.cases.list()).cases).toHaveLength(1)
  })

  it('withdraws a case before it is answered, and says what is wrong with a bad one', async () => {
    const s = setup()
    s.at(...OFF)
    expect(await code(s.api.cases.open({ kind: 'lostItem', summary: 'x', place: 'y', lineId: '', cents: 0 }))).toBe('invalid:badSummary')
    expect(await code(s.api.cases.open({ kind: 'claim', summary: 'A cracked suitcase', place: '', lineId: '', cents: 0 }))).toBe('invalid:badAmount')
    const list = await s.api.cases.open({ kind: 'claim', summary: 'A cracked suitcase', place: '', lineId: '', cents: 12_000 })
    const out = await s.api.cases.withdraw(list.cases[0].id)
    expect(out.cases[0]).toMatchObject({ stage: 'withdrawn', canWithdraw: false })
    expect(await code(s.api.cases.withdraw('nope'))).toBe('notFound:notFound')
  })

  it('refunds a billing dispute to the card after the answer', async () => {
    const s = setup()
    s.at(...OFF)
    let found = null
    for (const who of ['daniel', 'gerald', 'maria', 'linda', 'marcus', 'alexander', 'priya'] as const) {
      s.as(who)
      const l = await s.api.cases.open({ kind: 'billing', summary: 'Charged twice for a coffee', place: '', lineId: `line-${who}`, cents: 900 })
      s.later(121 * HOUR)
      const c = (await s.api.cases.list()).cases[0]
      if (c.outcome === 'refunded') { found = { c, who }; break }
      expect(l.cases).toHaveLength(1)
      s.at(...OFF)
    }
    expect(found).not.toBeNull()
    expect(found!.c.refund).toMatchObject({ cents: 900, sent: false })
    s.later(4 * 24 * HOUR)
    expect((await s.api.cases.list()).cases[0].refund?.sent).toBe(true)
  })
})

describe('feedback', () => {
  it('opens when the guest leaves the ship', async () => {
    const s = setup()
    s.at(...EVE)
    expect((await s.api.post.feedback()).open).toBe(false)
    expect(await code(s.api.post.saveFeedback({ ...blankFeedback(), overall: 5 }))).toBe('conflict:closed')
    s.at(...OFF)
    const v = await s.api.post.feedback()
    expect(v).toMatchObject({ open: true, feedback: null, recovery: null })
    expect(v.steward).toMatch(/^[A-Z]/)
  })

  it('keeps a good rating with its detail, and lets the guest change it', async () => {
    const s = setup()
    s.at(...OFF)
    const v = await s.api.post.saveFeedback({ ...blankFeedback(), overall: 5, areas: { dining: 4, ship: 5 }, comment: '  Lovely.  ', crew: ['Marisol', ' Marisol '], shareName: true })
    expect(v.feedback).toMatchObject({ overall: 5, areas: { dining: 4, ship: 5 }, comment: 'Lovely.', crew: ['Marisol'], shareName: true })
    expect(v.submittedAt).not.toBeNull()
    expect(v.recovery).toBeNull()
    expect((await s.api.post.saveFeedback({ ...v.feedback!, overall: 4 })).feedback?.overall).toBe(4)
    expect((await s.api.cases.list()).cases).toHaveLength(0)
  })

  it('opens a recovery case for poor feedback only when the guest allows contact, once', async () => {
    const s = setup()
    s.at(...OFF)
    const quiet = await s.api.post.saveFeedback({ ...blankFeedback(), overall: 2, comment: 'Our room was never cleaned' })
    expect(quiet.recovery).toBeNull()
    expect((await s.api.cases.list()).cases).toHaveLength(0)
    const v = await s.api.post.saveFeedback({ ...blankFeedback(), overall: 2, comment: 'Our room was never cleaned', allowContact: true })
    expect(v.recovery).toMatchObject({ stage: 'received' })
    await s.api.post.saveFeedback({ ...blankFeedback(), overall: 1, comment: 'Worse', allowContact: true })
    const cases = (await s.api.cases.list()).cases
    expect(cases).toHaveLength(1)
    expect(cases[0]).toMatchObject({ kind: 'recovery', fromFeedback: true })
    expect(cases[0].dueAt - cases[0].openedAt).toBe(48 * 3_600_000)
    s.later(49 * HOUR)
    expect((await s.api.cases.list()).cases[0]).toMatchObject({ outcome: 'credit', refund: { cents: 5000 } })
  })

  it('checks the answers, locks after the edit window, and is not open to a child', async () => {
    const s = setup()
    s.at(...OFF)
    expect(await code(s.api.post.saveFeedback(blankFeedback()))).toBe('invalid:noOverall')
    expect(await code(s.api.post.saveFeedback({ ...blankFeedback(), overall: 9 }))).toBe('invalid:noOverall')
    expect(await code(s.api.post.saveFeedback({ ...blankFeedback(), overall: 3, crew: ['a', 'b', 'c', 'd'] }))).toBe('invalid:badCrew')
    s.at('2027-04-12', '12:00')
    expect(await code(s.api.post.saveFeedback({ ...blankFeedback(), overall: 3 }))).toBe('conflict:expired')
    expect((await s.api.post.feedback()).open).toBe(false)
    s.at(...OFF)
    s.as('ethan')
    expect(await code(s.api.post.saveFeedback({ ...blankFeedback(), overall: 3 }))).toBe('forbidden:This account is supervised')
  })
})

describe('history and Captain’s Circle', () => {
  it('adds the cruise just sailed to the history, with documents, and the photo window', async () => {
    const s = setup('gerald')
    s.at(...EVE)
    expect((await s.api.post.history()).trips).toHaveLength(3)
    s.at(...OFF)
    const h = await s.api.post.history()
    expect(h.sailed).toBe(true)
    expect(h.trips).toHaveLength(4)
    expect(h.trips[0]).toMatchObject({ current: true, ship: 'Sun Princess', nights: 7 })
    expect(h.trips[0].fareCents).toBeGreaterThan(0)
    expect(h.trips[0].documents.map((d) => d.id)).toEqual(['fareReceipt', 'folioStatement', 'gratuityStatement', 'taxSummary'])
    expect(h.photosUntil).toBe(zonedToEpoch('2027-04-11', '23:59', 'America/New_York'))
  })

  it('counts the cruise toward the level only once it is sailed', async () => {
    const s = setup('maria')
    s.at(...EVE)
    expect(await s.api.post.loyalty()).toMatchObject({ counted: false, status: { after: 'none', promoted: false } })
    s.at(...OFF)
    const v = await s.api.post.loyalty()
    expect(v).toMatchObject({ counted: true, status: { before: 'none', after: 'gold', promoted: true } })
    expect(v.perks).toContain('memberEvents')
    expect(v.referral.code).toMatch(/^MARIA\d{3}$/)
  })

  it('shows credit earned from friends who have sailed', async () => {
    const s = setup('gerald')
    s.at(...OFF)
    const v = await s.api.post.loyalty()
    expect(v.referral.earned).toBe(5000)
    expect(v.referral.friends.map((f) => f.state)).toEqual(['sailed', 'invited'])
  })
})

describe('booking the next cruise', () => {
  it('offers dates after this cruise with the bigger offer on board, and the standard deposit after', async () => {
    const s = setup('gerald')
    s.at(...EVE)
    const onboard = await s.api.post.rebook()
    expect(onboard.onboardOffer).toBe(true)
    expect(onboard.options.length).toBeGreaterThan(0)
    expect(onboard.options.every((o) => o.departure >= '2027-04-11')).toBe(true)
    expect(onboard.options[0].credit).toBe(10_000 + 7500)
    expect(onboard.options[0].deposit).toBeLessThan(onboard.options[0].total * 0.2)
    s.at(...OFF)
    const after = await s.api.post.rebook()
    expect(after.onboardOffer).toBe(false)
    expect(after.options[0].credit).toBe(0)
    expect(after.options[0].deposit).toBeGreaterThan(onboard.options[0].deposit)
    expect(after.slots).toEqual([])
  })

  it('does not hold before boarding or for a child', async () => {
    const s = setup('gerald')
    const id = (await s.api.post.rebook()).options[0].id
    expect(await code(s.api.post.hold(id))).toBe('conflict:closed')
    s.at(...EVE)
    s.as('ethan')
    expect(await code(s.api.post.hold(id))).toBe('forbidden:This account is supervised')
  })

  it('holds a date, uses future cruise credit on the deposit, and posts the onboard credit to the bill', async () => {
    const s = setup('gerald')
    s.at(...EVE)
    const id = (await s.api.post.rebook()).options[0].id
    const v = await s.api.post.hold(id)
    expect(v.holds).toHaveLength(1)
    const h = v.holds[0]
    expect(h).toMatchObject({ onboard: true, credit: 17_500, expired: false })
    expect(h.fccApplied).toBe(Math.min(15_000, h.deposit))
    expect(v.fccLeft).toBe(15_000 - h.fccApplied)
    expect(h.expiresAt - h.placedAt).toBe(7 * 24 * 3_600_000)
    expect((await s.api.onboard.folio()).lines.find((l) => l.id === `hold-${h.id}`)).toMatchObject({ cents: -17_500, category: 'credit' })
    expect(await code(s.api.post.hold(id))).toBe('conflict:alreadyHeld')
    expect(await code(s.api.post.hold('sun-1999-01-01'))).toBe('invalid:badDeparture')
  })

  it('takes the credit off again when a hold is let go, and lets a hold lapse', async () => {
    const s = setup('gerald')
    s.at(...EVE)
    const id = (await s.api.post.rebook()).options[0].id
    const h = (await s.api.post.hold(id)).holds[0]
    const released = await s.api.post.releaseHold(h.id)
    expect(released.holds).toEqual([])
    expect(released.fccLeft).toBe(15_000)
    expect((await s.api.onboard.folio()).lines.some((l) => l.id.startsWith('hold-'))).toBe(false)
    expect(await code(s.api.post.releaseHold(h.id))).toBe('notFound:notFound')
    await s.api.post.hold(id)
    s.at('2027-04-08', '12:00')
    const lapsed = (await s.api.post.rebook()).holds[0]
    expect(lapsed.expired).toBe(true)
    expect((await s.api.post.rebook()).fccLeft).toBe(15_000)
  })

  it('holds at most three dates at a time', async () => {
    const s = setup('maria')
    s.at(...EVE)
    const opts = (await s.api.post.rebook()).options
    expect(opts.length).toBeGreaterThanOrEqual(4)
    for (const o of opts.slice(0, 3)) await s.api.post.hold(o.id)
    expect(await code(s.api.post.hold(opts[3].id))).toBe('conflict:tooManyHolds')
  })

  it('changes leftover future cruise credit into onboard credit, on board only', async () => {
    const s = setup('alexander')
    s.at(...EVE)
    expect((await s.api.post.rebook()).fccLeft).toBe(25_000)
    const v = await s.api.post.convertFcc()
    expect(v).toMatchObject({ fccLeft: 0, fccConverted: 25_000 })
    expect((await s.api.onboard.folio()).lines.find((l) => l.id.startsWith('fcc-'))).toMatchObject({ cents: -25_000 })
    expect(await code(s.api.post.convertFcc())).toBe('invalid:noCredit')
    const other = setup('gerald')
    other.at(...OFF)
    expect(await code(other.api.post.convertFcc())).toBe('conflict:closed')
  })

  it('books one appointment at the Future Cruise desk on a sea day, and lets the guest move or cancel it', async () => {
    const s = setup('daniel')
    s.at(...EVE)
    const slots = (await s.api.post.rebook()).slots
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.every((x) => x.day === 7)).toBe(true)
    const v = await s.api.post.bookSlot(slots[0].at)
    expect(v.appointment).toEqual({ at: slots[0].at })
    expect((await s.api.post.bookSlot(slots[1].at)).appointment?.at).toBe(slots[1].at)
    expect(await code(s.api.post.bookSlot(slots[1].at + 60_000))).toBe('invalid:badSlot')
    expect((await s.api.post.cancelSlot()).appointment).toBeNull()
  })

  it('offers the soonest sea-day slots from early in the cruise', async () => {
    const s = setup('daniel')
    s.at('2027-03-22', '12:00')
    const days = new Set((await s.api.post.rebook()).slots.map((x) => x.day))
    expect([...days]).toEqual([2, 6])
  })
})
