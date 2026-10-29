import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { clockAt } from '../domain/clock'
import { defaultDemoState, type DemoState } from '../demo/state'
import type { PaymentPart } from '../domain/fares'
import type { PersonaId } from '../domain/personas'
import type { ScenarioId } from '../domain/scenarios'
import { zonedToEpoch } from '../domain/timezones'
import { isApiError } from './errors'
import { asDiningView, asFolioView, asMusterView, asOnboardToday, asPortDayCopy, asPortDayView, asProgramView } from './guards'
import { createMockApi } from './mock'

const REAL = Date.UTC(2026, 9, 29, 16)

function setup(as: PersonaId = 'gerald') {
  let who: PersonaId | null = as
  const demo: DemoState = defaultDemoState(REAL)
  const store = createMemoryStore()
  let tick = REAL
  const api = createMockApi({ store, demo: () => demo, persona: () => who, realNow: () => (tick += 1000), sleep: async () => {} })
  return {
    api,
    as: (p: PersonaId) => { who = p },
    /** Holds the demo clock at a date and time in a zone. */
    at: (date: string, time: string, zone = 'America/New_York') => { demo.clock = clockAt(zonedToEpoch(date, time, zone), REAL, 0) },
    scenario: (...ids: ScenarioId[]) => { demo.scenarios = ids },
  }
}

const code = async (p: Promise<unknown>) => { try { await p } catch (e) { return isApiError(e) ? `${e.code}:${e.message}` : 'other' } return null }
const card = (cents: number): PaymentPart => ({ method: 'card', cardId: 'card-default', cents })

describe('today on board', () => {
  it('is not aboard before embarkation, with no weather or port countdown', async () => {
    const { api } = setup()
    const t = await api.onboard.today()
    expect(t).toMatchObject({ aboard: false, day: null, weather: null, portDay: null })
  })

  it('is aboard from embarkation day, with the muster drill still to do and the sail-away time', async () => {
    const s = setup()
    s.at('2027-03-21', '12:00')
    const t = await s.api.onboard.today()
    expect(t).toMatchObject({ aboard: true, day: 1, port: 'fll', shipZone: 'America/New_York' })
    expect(t.muster.required).toBe(true)
    expect(t.sailAwayAt).toBe(zonedToEpoch('2027-03-21', '15:00', 'America/New_York'))
    expect(t.portDay?.port).toBe('cozumel')
    expect(t.weather?.highF).toBeGreaterThan(0)
  })

  it('counts down to all-aboard on a port day and says the ship is at the port', async () => {
    const s = setup()
    s.at('2027-03-23', '15:00', 'America/Cancun')
    const t = await s.api.onboard.today()
    expect(t).toMatchObject({ day: 3, port: 'cozumel' })
    expect(t.portDay).toMatchObject({ port: 'cozumel', allAboardLocal: '4:30 pm', allAboardShip: '5:30 pm' })
    expect(t.portDay?.state).toMatchObject({ level: 'soon', minutesLeft: 90 })
  })

  it('warns the evening before the ship’s clocks change, by two hours in March because the US has changed to daylight time and Belize has not', async () => {
    const s = setup()
    s.at('2027-03-23', '20:00', 'America/Cancun')
    expect((await s.api.onboard.today()).clockChange).toMatchObject({ hours: -2 })
    s.at('2027-03-22', '09:00')
    expect((await s.api.onboard.today()).clockChange).toBeNull()
  })

  it('is no longer aboard on the morning of arrival', async () => {
    const s = setup()
    s.at('2027-03-28', '07:30')
    expect((await s.api.onboard.today()).aboard).toBe(false)
  })
})

describe('daily programme', () => {
  it('rejects a day that does not exist', async () => {
    const { api } = setup()
    expect(await code(api.onboard.program(0))).toBe('invalid:Choose a day from 1 to 8')
    expect(await code(api.onboard.program(9))).toBe('invalid:Choose a day from 1 to 8')
    expect(await code(api.onboard.program(2.5))).toBe('invalid:Choose a day from 1 to 8')
  })

  it('shows the plan changes only while the scenario is on', async () => {
    const s = setup()
    expect((await s.api.onboard.program(2)).changed).toBe(false)
    s.scenario('planChange')
    const p = await s.api.onboard.program(2)
    expect(p.changed).toBe(true)
    expect(p.events.find((e) => e.id === 'trivia')?.status).toBe('cancelled')
  })

  it('keeps each person’s own plan, adds and removes events, and refuses unknown ones', async () => {
    const s = setup()
    expect(await s.api.onboard.togglePlan('bingo', true)).toEqual(['bingo'])
    expect(await s.api.onboard.togglePlan('jazz', true)).toEqual(['bingo', 'jazz'])
    expect(await s.api.onboard.togglePlan('bingo', true)).toEqual(['jazz', 'bingo'])
    expect((await s.api.onboard.program(2)).mine).toEqual(['jazz', 'bingo'])
    expect(await s.api.onboard.togglePlan('jazz', false)).toEqual(['bingo'])
    expect(await code(s.api.onboard.togglePlan('nope', true))).toBe('invalid:Unknown event')
    s.as('maria')
    expect((await s.api.onboard.program(2)).mine).toEqual([])
  })

  it('lets a supervised child look at the plan but not change it', async () => {
    const s = setup('ethan')
    expect((await s.api.onboard.program(2)).canEdit).toBe(false)
    expect(await code(s.api.onboard.togglePlan('bingo', true))).toBe('forbidden:This account is supervised')
  })
})

describe('muster drill', () => {
  it('names the station, in step with the boarding pass, and lists everyone on the booking', async () => {
    const s = setup('daniel')
    const m = await s.api.onboard.muster()
    const pass = await s.api.boarding.pass()
    expect(m.station).toBe(pass.passes[0].muster)
    expect(m.guests.map((g) => g.id)).toEqual(['daniel', 'priya', 'ethan', 'maya'])
    expect(m).toMatchObject({ required: true, done: false, canConfirm: true })
  })

  it('opens an hour before the drill and not before', async () => {
    const s = setup()
    s.at('2027-03-21', '12:30')
    expect(await code(s.api.onboard.confirmMuster(['gerald']))).toBe('conflict:notOpen')
    s.at('2027-03-21', '13:00')
    const m = await s.api.onboard.confirmMuster(['gerald'])
    expect(m.done).toBe(true)
    expect(m.guests[0].confirmedAt).toBe(zonedToEpoch('2027-03-21', '13:00', 'America/New_York'))
  })

  it('needs everyone on the booking before it counts as done, and keeps who has checked in', async () => {
    const s = setup('daniel')
    s.at('2027-03-21', '14:00')
    let m = await s.api.onboard.confirmMuster(['daniel', 'priya'])
    expect(m.done).toBe(false)
    expect(m.guests.filter((g) => g.confirmedAt !== null).map((g) => g.id)).toEqual(['daniel', 'priya'])
    m = await s.api.onboard.confirmMuster(['ethan', 'maya'])
    expect(m.done).toBe(true)
    s.as('priya')
    expect((await s.api.onboard.muster()).done).toBe(true)
  })

  it('refuses someone not on the booking, a child account and a drill long over', async () => {
    const s = setup('daniel')
    s.at('2027-03-21', '14:00')
    expect(await code(s.api.onboard.confirmMuster(['gerald' as PersonaId]))).toBe('forbidden:Not on your booking')
    expect(await code(s.api.onboard.confirmMuster([]))).toBe('forbidden:Not on your booking')
    s.as('ethan')
    expect(await code(s.api.onboard.confirmMuster(['ethan']))).toBe('forbidden:This account is supervised')
    s.as('daniel')
    s.at('2027-03-23', '10:00')
    expect(await code(s.api.onboard.confirmMuster(['daniel']))).toBe('conflict:closed')
  })
})

describe('emergency card', () => {
  it('gives the stateroom, deck and station the boarding pass shows', async () => {
    const s = setup('linda')
    const c = await s.api.onboard.emergency()
    const pass = (await s.api.boarding.pass()).passes[0]
    expect(c).toMatchObject({ guest: 'Linda Okafor', stateroom: pass.cabin, deck: pass.deck, muster: pass.muster })
    expect(c.script).toContain(pass.cabin)
  })

  it('opens for a supervised child too, since a child may need it most', async () => {
    const s = setup('maya')
    expect((await s.api.onboard.emergency()).guest).toBe('Maya Harper')
  })
})

describe('port day', () => {
  it('is null after the last port', async () => {
    const s = setup()
    s.at('2027-03-26', '12:00')
    expect(await s.api.onboard.portDay()).toBeNull()
  })

  it('has no tender in Cozumel, which has a pier', async () => {
    const s = setup()
    s.at('2027-03-23', '09:00', 'America/Cancun')
    const v = (await s.api.onboard.portDay())!
    expect(v.day.port).toBe('cozumel')
    expect(v.tender).toBeNull()
    expect(v.skipped).toBe(false)
  })

  it('gives a tender group, call time and last tender in Belize, with priority for a ship tour', async () => {
    const s = setup()
    s.at('2027-03-24', '08:00', 'America/Belize')
    const v = (await s.api.onboard.portDay())!
    expect(v.tender).toMatchObject({ mayTender: false, delayMinutes: 0 })
    expect(v.tender!.group.id).toBe('priority')
    expect(v.tender!.lastTenderAt).toBeLessThan(v.day.allAboardAt)
    expect(v.tender!.callAt).toBeGreaterThan(zonedToEpoch('2027-03-24', '07:45', 'America/Belize'))
  })

  it('puts a guest who needs help with steps in the assistance group', async () => {
    const s = setup('linda')
    await s.api.account.saveProfile('linda', { ...(await s.api.account.profile('linda')).profile, needs: ['mobility'] })
    s.at('2027-03-24', '08:00', 'America/Belize')
    const v = (await s.api.onboard.portDay())!
    expect(v.tender).toMatchObject({ assistance: true })
    expect(v.tender!.group.id).toBe('priority')
  })

  it('delays every group in the Belize scenario and says so', async () => {
    const s = setup('maria')
    s.at('2027-03-24', '08:00', 'America/Belize')
    const normal = (await s.api.onboard.portDay())!
    s.scenario('belizeTender')
    const late = (await s.api.onboard.portDay())!
    expect(late.delayMinutes).toBe(40)
    expect(late.tender!.callAt - normal.tender!.callAt).toBe(40 * 60_000)
    expect(late.tender!.status).toBe('delayed')
  })

  it('warns that Roatán may switch to tender in the weather scenario, and not otherwise', async () => {
    const s = setup()
    s.at('2027-03-25', '09:00', 'America/Tegucigalpa')
    expect((await s.api.onboard.portDay())!.tender).toBeNull()
    s.scenario('belizeTender')
    expect((await s.api.onboard.portDay())!.tender).toMatchObject({ mayTender: true })
  })

  it('marks Cozumel skipped in the port-skipped scenario', async () => {
    const s = setup()
    s.scenario('portSkipped')
    s.at('2027-03-23', '09:00', 'America/Cancun')
    expect((await s.api.onboard.portDay())!.skipped).toBe(true)
    s.at('2027-03-24', '09:00', 'America/Belize')
    expect((await s.api.onboard.portDay())!.skipped).toBe(false)
  })

  it('lists tours booked for the port with a code for each guest', async () => {
    const s = setup()
    await s.api.plan.excursions.addToCart('coz-snorkel', ['gerald'])
    await s.api.plan.excursions.checkout([card(7900)])
    s.at('2027-03-23', '08:00', 'America/Cancun')
    const v = (await s.api.onboard.portDay())!
    expect(v.tours).toHaveLength(1)
    expect(v.tours[0]).toMatchObject({ excursionId: 'coz-snorkel', tender: false })
    expect(v.tours[0].guests[0]).toMatchObject({ id: 'gerald' })
    expect(v.tours[0].guests[0].code.startsWith('PCX1|gerald|')).toBe(true)
    s.at('2027-03-24', '08:00', 'America/Belize')
    expect((await s.api.onboard.portDay())!.tours).toEqual([])
    expect((await s.api.onboard.portDay())!.tender!.group.id).toBe('priority')
  })

  it('puts a guest with a ship tour at the front of the tender line', async () => {
    const s = setup('maria')
    await s.api.plan.excursions.addToCart('bze-cave', ['maria'])
    const price = (await s.api.plan.excursions.list()).cartTotal
    await s.api.plan.excursions.checkout([card(price)])
    s.at('2027-03-24', '08:00', 'America/Belize')
    expect((await s.api.onboard.portDay())!.tender!.group.id).toBe('tour')
  })
})

describe('onboard account', () => {
  it('is empty before the cruise, and charges the daily gratuity from the first night', async () => {
    const s = setup()
    expect((await s.api.onboard.folio()).lines).toEqual([])
    s.at('2027-03-24', '12:00', 'America/Belize')
    const f = await s.api.onboard.folio()
    expect(f.throughDay).toBe(4)
    expect(f.lines.filter((l) => l.category === 'gratuities')).toHaveLength(4)
    expect(f.totals.balance).toBe(f.totals.charges - f.totals.credits)
    expect(f.lines.every((l) => l.at <= zonedToEpoch('2027-03-24', '12:00', 'America/Belize'))).toBe(true)
  })

  it('shows what a package covered, using the guest’s own package', async () => {
    const s = setup('daniel')
    s.at('2027-03-27', '23:00', 'America/New_York')
    const f = await s.api.onboard.folio()
    expect(f.lines.filter((l) => l.category === 'gratuities' && l.guest === 'daniel').every((l) => l.coveredBy === 'package')).toBe(true)
    expect(f.totals.covered).toBeGreaterThan(0)
    expect(f.guests.map((g) => g.id)).toEqual(['daniel', 'priya', 'ethan', 'maya'])
  })

  it('adds a specialty cover charge once the dinner time has passed', async () => {
    const s = setup()
    await s.api.plan.dining.reserve({ venueId: 'crown', day: 6, time: '19:00', guests: ['gerald'], note: '' })
    s.at('2027-03-26', '18:00', 'America/Belize')
    expect((await s.api.onboard.folio()).lines.some((l) => l.category === 'dining')).toBe(false)
    s.at('2027-03-26', '21:00', 'America/Belize')
    const dine = (await s.api.onboard.folio()).lines.find((l) => l.category === 'dining')
    expect(dine).toMatchObject({ guest: 'gerald', cents: 4500 })
  })

  it('keeps the account closed to a supervised child', async () => {
    const s = setup('ethan')
    expect(await code(s.api.onboard.folio())).toBe('forbidden:This account is supervised')
  })
})

describe('dining on board', () => {
  /** Crown Grill on night 6 has tables all evening; night 4 at 19:00 is full; night 5 at 18:30 and 20:00 have two. */
  const reserve = (s: ReturnType<typeof setup>, venueId = 'crown', day = 6, time = '18:00', guests: PersonaId[] = ['gerald']) => s.api.plan.dining.reserve({ venueId, day, time, guests, note: '' })

  it('still takes reservations once the cruise has started, for nights and times that have not passed', async () => {
    const s = setup()
    s.at('2027-03-22', '20:00')
    const v = await reserve(s, 'sabatini', 5, '19:00')
    expect(v.canBook).toBe(true)
    expect(v.reservations).toHaveLength(1)
    expect(await code(reserve(s, 'sabatini', 1, '19:00'))).toBe('conflict:closed')
    expect(await code(reserve(s, 'sabatini', 2, '17:30'))).toBe('conflict:closed')
  })

  it('moves a reservation in place, keeping its address and recording the change', async () => {
    const s = setup()
    const first = (await reserve(s)).reservations[0]
    const moved = await s.api.plan.dining.move(first.id, { day: 6, time: '20:00' })
    expect(moved.reservations).toHaveLength(1)
    expect(moved.reservations[0]).toMatchObject({ id: first.id, day: 6, time: '20:00', venueId: 'crown' })
    const trail = (await s.api.account.history()).filter((h) => h.what === 'dining')
    expect(trail[0].detail).toContain('night 6, 18:00 moved to night 6, 20:00')
  })

  it('leaves the original untouched when the new table is full, clashes, is unchanged or does not exist', async () => {
    const s = setup()
    const first = (await reserve(s)).reservations[0]
    expect(await code(s.api.plan.dining.move(first.id, { day: 4, time: '19:00' }))).toBe('conflict:full')
    await reserve(s, 'catch', 5, '18:30')
    expect(await code(s.api.plan.dining.move(first.id, { day: 5, time: '20:00' }))).toBe('conflict:clash')
    expect(await code(s.api.plan.dining.move(first.id, { day: 6, time: '18:00' }))).toBe('conflict:unchanged')
    expect(await code(s.api.plan.dining.move(first.id, { day: 6, time: '03:00' }))).toBe('invalid:Choose a night and a time')
    expect(await code(s.api.plan.dining.move('nope', { day: 6, time: '19:00' }))).toBe('notFound:notFound')
    const after = (await s.api.plan.dining.view()).reservations.find((r) => r.id === first.id)!
    expect(after).toMatchObject({ day: 6, time: '18:00' })
  })

  it('does not count the guest’s own table as a clash when moving to a nearby time the same night', async () => {
    const s = setup()
    const first = (await reserve(s)).reservations[0]
    const v = await s.api.plan.dining.move(first.id, { day: 6, time: '18:30' })
    expect(v.reservations[0]).toMatchObject({ id: first.id, time: '18:30' })
  })

  it('fails once in the reschedule scenario and leaves the booking as it was, then works on retry', async () => {
    const s = setup()
    const first = (await reserve(s)).reservations[0]
    s.scenario('dinnerReschedule')
    expect(await code(s.api.plan.dining.move(first.id, { day: 6, time: '20:00' }))).toBe('server:server')
    expect((await s.api.plan.dining.view()).reservations[0]).toMatchObject({ id: first.id, day: 6, time: '18:00' })
    expect((await s.api.plan.dining.move(first.id, { day: 6, time: '20:00' })).reservations[0]).toMatchObject({ day: 6, time: '20:00' })
  })

  it('refuses to move a dinner that is over or to a time that has already gone', async () => {
    const s = setup()
    const early = (await reserve(s, 'crown', 3, '20:00')).reservations[0]
    const late = (await reserve(s, 'crown', 6, '18:00')).reservations.find((r) => r.day === 6)!
    s.at('2027-03-23', '22:00', 'America/New_York')
    expect(await code(s.api.plan.dining.move(early.id, { day: 6, time: '19:00' }))).toBe('conflict:closed')
    expect(await code(s.api.plan.dining.move(late.id, { day: 3, time: '20:00' }))).toBe('conflict:closed')
  })

  it('tells the restaurant about a late arrival, within limits, and shows it on the reservation', async () => {
    const s = setup()
    const first = (await reserve(s)).reservations[0]
    expect(first.lateMinutes).toBe(0)
    expect(await code(s.api.plan.dining.late(first.id, 3))).toBe('invalid:Choose 5 to 30 minutes')
    expect(await code(s.api.plan.dining.late(first.id, 45))).toBe('invalid:Choose 5 to 30 minutes')
    expect(await code(s.api.plan.dining.late('nope', 10))).toBe('notFound:notFound')
    const v = await s.api.plan.dining.late(first.id, 15)
    expect(v.reservations[0].lateMinutes).toBe(15)
    const moved = await s.api.plan.dining.move(first.id, { day: 6, time: '20:00' })
    expect(moved.reservations[0].lateMinutes).toBe(0)
  })

  it('does not let a supervised child change a reservation', async () => {
    const s = setup('daniel')
    const first = (await reserve(s, 'crown', 6, '19:00', ['daniel', 'priya'])).reservations[0]
    s.as('ethan')
    expect(await code(s.api.plan.dining.move(first.id, { day: 6, time: '20:00' }))).toBe('forbidden:This account is supervised')
    expect(await code(s.api.plan.dining.late(first.id, 10))).toBe('forbidden:This account is supervised')
  })
})

describe('Guest Services chat', () => {
  it('lists every channel with its usual reply time', async () => {
    const { api } = setup()
    const list = await api.service.channels()
    expect(list.map((c) => c.id)).toEqual(['guestServices', 'housekeeping', 'dining', 'medical', 'excursions'])
    expect(list.find((c) => c.id === 'housekeeping')).toMatchObject({ minutes: 10, slow: false, unanswered: false })
  })

  it('rejects an unknown channel and an empty message', async () => {
    const { api } = setup()
    expect(await code(api.service.thread('nope' as never))).toBe('invalid:Unknown channel')
    expect(await code(api.service.send('dining', '   '))).toBe('invalid:Write a message first')
  })

  it('shows waiting with a queue position, then a crew reply, then done', async () => {
    const s = setup()
    s.at('2027-03-22', '10:00')
    let th = await s.api.service.send('housekeeping', 'More towels please')
    expect(th.messages).toHaveLength(1)
    expect(th.state).toMatchObject({ status: 'waiting', expectedMinutes: 10 })
    expect(th.state!.queue).toBeGreaterThanOrEqual(1)
    expect((await s.api.service.channels()).find((c) => c.id === 'housekeeping')!.unanswered).toBe(true)
    s.at('2027-03-22', '10:11')
    th = await s.api.service.thread('housekeeping')
    expect(th.state!.status).toBe('answered')
    expect(th.messages.map((m) => m.from)).toEqual(['me', 'crew'])
    expect(th.messages[1].crew).toContain('Housekeeping')
    s.at('2027-03-22', '10:45')
    expect((await s.api.service.thread('housekeeping')).state!.status).toBe('resolved')
  })

  it('keeps channels apart and each person’s chat private', async () => {
    const s = setup()
    await s.api.service.send('dining', 'A table for six?')
    expect((await s.api.service.thread('housekeeping')).messages).toEqual([])
    s.as('maria')
    expect((await s.api.service.thread('dining')).messages).toEqual([])
  })

  it('replies only once to a burst of messages', async () => {
    const s = setup()
    s.at('2027-03-22', '10:00')
    await s.api.service.send('dining', 'One thing')
    s.at('2027-03-22', '10:02')
    await s.api.service.send('dining', 'And another')
    s.at('2027-03-22', '10:30')
    const th = await s.api.service.thread('dining')
    expect(th.messages.filter((m) => m.from === 'crew')).toHaveLength(1)
  })

  it('times out once in the slow scenario, keeps the message to retry, then waits five times as long and offers a call', async () => {
    const s = setup()
    s.scenario('chatSlow')
    s.at('2027-03-22', '10:00')
    expect(await code(s.api.service.send('guestServices', 'Hello'))).toBe('timeout:timeout')
    expect((await s.api.service.thread('guestServices')).messages).toEqual([])
    const th = await s.api.service.send('guestServices', 'Hello')
    expect(th.slow).toBe(true)
    expect(th.state).toMatchObject({ status: 'waiting', expectedMinutes: 25, canEscalate: true })
    s.at('2027-03-22', '10:10')
    expect((await s.api.service.thread('guestServices')).state!.status).toBe('waiting')
  })

  it('turns into a phone call on request, with a ticket, and refuses a bad number', async () => {
    const s = setup()
    s.at('2027-03-22', '10:00')
    await s.api.service.send('medical', 'My ankle hurts')
    expect(await code(s.api.service.escalate('medical', '12'))).toBe('invalid:Check the phone number')
    const th = await s.api.service.escalate('medical', '555 0199')
    expect(th.state!.status).toBe('escalated')
    expect(th.messages.at(-1)).toMatchObject({ from: 'crew' })
    expect(th.messages.at(-1)!.text).toContain('555 0199')
    const tickets = await s.api.support.tickets()
    expect(tickets[0]).toMatchObject({ kind: 'callback', detail: '555 0199' })
  })

  it('keeps chat with the crew to adults on the booking', async () => {
    const s = setup('ethan')
    expect(await code(s.api.service.send('dining', 'Hi'))).toBe('forbidden:This account is supervised')
    expect(await code(s.api.service.escalate('dining', '555 0199'))).toBe('forbidden:This account is supervised')
    expect((await s.api.service.thread('dining')).messages).toEqual([])
  })
})

describe('chat with the travel party', () => {
  it('shows read receipts only when both people have them on', async () => {
    const s = setup('daniel')
    await s.api.messages.send('Dinner at 6?')
    s.as('priya')
    expect((await s.api.messages.list())[0].seenBy).toBeUndefined()
    expect(await s.api.messages.receipts()).toBe(false)
    await s.api.messages.setReceipts(true)
    await s.api.messages.markSeen()
    s.as('daniel')
    expect((await s.api.messages.list())[0].seenBy).toBeUndefined()
    await s.api.messages.setReceipts(true)
    expect((await s.api.messages.list())[0].seenBy).toEqual(['priya'])
    s.as('priya')
    await s.api.messages.setReceipts(false)
    s.as('daniel')
    expect((await s.api.messages.list())[0].seenBy).toEqual([])
  })

  it('does not record that someone has read messages when their receipts are off', async () => {
    const s = setup('daniel')
    await s.api.messages.send('Hello')
    await s.api.messages.setReceipts(true)
    s.as('priya')
    await s.api.messages.markSeen()
    s.as('daniel')
    expect((await s.api.messages.list())[0].seenBy).toEqual([])
  })
})

describe('copies kept on the phone', () => {
  it('trust real answers from the service and reject damaged or foreign ones', async () => {
    const s = setup()
    s.at('2027-03-23', '10:00', 'America/Cancun')
    const roundTrip = <T,>(v: T): unknown => JSON.parse(JSON.stringify(v))
    expect(asOnboardToday(roundTrip(await s.api.onboard.today()))).not.toBeNull()
    expect(asProgramView(roundTrip(await s.api.onboard.program(3)))).not.toBeNull()
    expect(asDiningView(roundTrip(await s.api.plan.dining.view()))).not.toBeNull()
    expect(asFolioView(roundTrip(await s.api.onboard.folio()))).not.toBeNull()
    expect(asPortDayView(roundTrip((await s.api.onboard.portDay())!))).not.toBeNull()
    expect(asPortDayCopy(roundTrip({ view: await s.api.onboard.portDay() }))).not.toBeNull()
    expect(asMusterView(roundTrip(await s.api.onboard.muster()))).not.toBeNull()
    for (const guard of [asOnboardToday, asProgramView, asDiningView, asFolioView, asMusterView]) {
      expect(guard(null)).toBeNull()
      expect(guard('text')).toBeNull()
      expect(guard({})).toBeNull()
      expect(guard([])).toBeNull()
    }
    expect(asProgramView({ day: 1, date: 'x', mine: [], events: [{ id: 1 }] })).toBeNull()
    expect(asFolioView({ lines: [{ id: 'a', cents: 'lots' }], totals: {}, guests: [] })).toBeNull()
  })

  it('keeps a no-more-ports answer as a valid copy, so the screen does not wait for it forever', async () => {
    const s = setup()
    s.at('2027-03-26', '12:00', 'America/Belize')
    const copy = asPortDayCopy(JSON.parse(JSON.stringify({ view: await s.api.onboard.portDay() })))
    expect(copy).toEqual({ view: null })
    expect(asPortDayCopy(null)).toBeNull()
    expect(asPortDayCopy({})).toBeNull()
    expect(asPortDayCopy({ view: { day: 3 } })).toBeNull()
    expect(asPortDayView({})).toBeNull()
  })
})
