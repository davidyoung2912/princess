import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { clockAt } from '../domain/clock'
import { defaultDemoState, type DemoState } from '../demo/state'
import type { PersonaId } from '../domain/personas'
import type { ScenarioId } from '../domain/scenarios'
import { zonedToEpoch } from '../domain/timezones'
import { isApiError } from './errors'
import { createMockApi } from './mock'

const REAL = Date.UTC(2026, 9, 29, 16)

function setup(as: PersonaId = 'daniel') {
  let who: PersonaId | null = as
  const demo: DemoState = defaultDemoState(REAL)
  const store = createMemoryStore()
  const make = () => createMockApi({ store, demo: () => demo, persona: () => who, realNow: () => REAL, sleep: async () => {} })
  const api = make()
  return {
    api,
    as: (p: PersonaId) => { who = p },
    at: (date: string, time: string, zone = 'America/New_York') => { demo.clock = clockAt(zonedToEpoch(date, time, zone), REAL, 0) },
    later: (minutes: number) => { demo.clock = clockAt(demo.clock.anchorDemo + minutes * 60_000, REAL, 0) },
    scenario: (...ids: ScenarioId[]) => { demo.scenarios = ids },
  }
}

const code = async (p: Promise<unknown>) => { try { await p } catch (e) { return isApiError(e) ? `${e.code}:${e.message}` : 'other' } return null }
const SEA_DAY = ['2027-03-22', '12:00'] as const

describe('bookings and orders on board', () => {
  it('books a treatment, puts it on the bill, and takes it off again', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    const list = await s.api.aboard.selections.add({ item: 'spa-swedish', day: 3, time: '10:00', qty: 1 })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ item: 'spa-swedish', day: 3, total: 13900 })
    const folio = await s.api.onboard.folio()
    expect(folio.lines.find((l) => l.description === 'Swedish massage')).toMatchObject({ category: 'spa', cents: 13900 })
    expect(await code(s.api.aboard.selections.add({ item: 'spa-swedish', day: 3, time: '10:00', qty: 1 }))).toBe('conflict:duplicate')
    expect(await s.api.aboard.selections.remove(list[0].id)).toEqual([])
    expect((await s.api.onboard.folio()).lines.some((l) => l.description === 'Swedish massage')).toBe(false)
  })

  it('orders goods for pickup, and replaces the quantity', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    await s.api.aboard.selections.add({ item: 'shop-hat', day: 0, time: '', qty: 2 })
    const list = await s.api.aboard.selections.add({ item: 'shop-hat', day: 0, time: '', qty: 3 })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ qty: 3, total: 8700 })
    expect((await s.api.onboard.folio()).lines.find((l) => l.description.includes('sun hat'))).toMatchObject({ category: 'shops', cents: 8700 })
  })

  it('lets a guest say they are going to a free service without a charge', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    const list = await s.api.aboard.selections.add({ item: 'faith-mass', day: 6, time: '08:30', qty: 1 })
    expect(list[0].total).toBe(0)
  })

  it('refuses before boarding, for a time that has passed, bad input, and for a supervised child', async () => {
    const s = setup()
    expect(await code(s.api.aboard.selections.add({ item: 'spa-swedish', day: 3, time: '10:00', qty: 1 }))).toBe('conflict:closed')
    s.at('2027-03-22', '14:00')
    expect(await code(s.api.aboard.selections.add({ item: 'spa-swedish', day: 2, time: '13:00', qty: 1 }))).toBe('conflict:past')
    expect(await code(s.api.aboard.selections.add({ item: 'nope', day: 2, time: '', qty: 1 }))).toBe('invalid:unknown')
    expect(await code(s.api.aboard.selections.add({ item: 'spa-swedish', day: 3, time: '10:00', qty: 0 }))).toBe('invalid:badQty')
    expect(await code(s.api.aboard.selections.remove('nope'))).toBe('notFound:notFound')
    s.as('ethan')
    expect(await code(s.api.aboard.selections.add({ item: 'shop-hat', day: 0, time: '', qty: 1 }))).toMatch(/^forbidden/)
  })

  it('keeps one person’s picks from showing for another booking', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    await s.api.aboard.selections.add({ item: 'faith-mass', day: 6, time: '08:30', qty: 1 })
    s.as('maria')
    expect(await s.api.aboard.selections.list()).toEqual([])
  })
})

describe('cabin requests (MSG-03)', () => {
  it('moves through the stages with the clock, and can be cancelled only early', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    const made = await s.api.aboard.requests.create('towels', 2, 'by the door')
    expect(made[0]).toMatchObject({ item: 'towels', qty: 2, stage: 'received', canCancel: true, note: 'by the door' })
    expect(await code(s.api.aboard.requests.create('towels', 1, ''))).toBe('conflict:duplicate')
    s.later(12)
    expect((await s.api.aboard.requests.list())[0]).toMatchObject({ stage: 'onTheWay', canCancel: false })
    expect(await code(s.api.aboard.requests.cancel(made[0].id))).toBe('conflict:tooLate')
    s.later(20)
    expect((await s.api.aboard.requests.list())[0].stage).toBe('done')
    expect((await s.api.aboard.requests.create('towels', 1, '')).length).toBe(2)
  })

  it('cancels while received, and refuses nonsense and an early request', async () => {
    const s = setup()
    expect(await code(s.api.aboard.requests.create('towels', 1, ''))).toBe('conflict:closed')
    s.at(...SEA_DAY)
    const made = await s.api.aboard.requests.create('light', 1, '')
    expect((await s.api.aboard.requests.cancel(made[0].id))[0]).toMatchObject({ stage: 'cancelled', canCancel: false })
    expect(await code(s.api.aboard.requests.create('towels', 9, ''))).toBe('invalid:Choose an item and how many')
    expect(await code(s.api.aboard.requests.create('sword', 1, ''))).toBe('invalid:Choose an item and how many')
    s.as('ethan')
    expect(await code(s.api.aboard.requests.create('towels', 1, ''))).toMatch(/^forbidden/)
  })
})

describe('security reports (SAF-04)', () => {
  it('records a report with a reference, and keeps urgent ones from being anonymous', async () => {
    const s = setup('maria')
    s.at(...SEA_DAY)
    const first = await s.api.aboard.reports.create({ kind: 'theft', where: 'Deck 9 pool', note: 'A bag was taken', anonymous: true })
    expect(first[0]).toMatchObject({ kind: 'theft', reference: 'SEC-001', anonymous: true })
    const second = await s.api.aboard.reports.create({ kind: 'overboard', where: 'Deck 12 aft starboard', note: 'Saw someone fall', anonymous: true })
    expect(second[0]).toMatchObject({ kind: 'overboard', reference: 'SEC-002', anonymous: false })
    expect(await code(s.api.aboard.reports.create({ kind: 'theft', where: '', note: 'a bag', anonymous: false }))).toBe('invalid:noWhere')
  })

  it('lets a supervised child report', async () => {
    const s = setup('ethan')
    s.at(...SEA_DAY)
    expect((await s.api.aboard.reports.create({ kind: 'harassment', where: 'Teen lounge', note: 'Someone is bothering me', anonymous: false })).length).toBe(1)
  })
})

describe('drinks (DIN-06)', () => {
  it('tracks the day against the package and warns', async () => {
    const s = setup('daniel')
    s.at(...SEA_DAY)
    let v = await s.api.aboard.drinks.view()
    expect(v.capUsd).toBeGreaterThan(0)
    for (let i = 0; i < 4; i++) v = await s.api.aboard.drinks.log('beer')
    expect(v.summary).toMatchObject({ today: 4, covered: 4, alert: 'slow' })
    v = await s.api.aboard.drinks.undo(v.logs[0].id)
    expect(v.summary.alert).toBe('none')
  })

  it('starts the next day afresh, and keeps alcohol from under-21s', async () => {
    const s = setup('daniel')
    s.at(...SEA_DAY)
    await s.api.aboard.drinks.log('wine')
    s.at('2027-03-23', '12:00')
    expect((await s.api.aboard.drinks.view()).logs).toEqual([])
    expect(await code(s.api.aboard.drinks.log('nope'))).toBe('invalid:Choose a drink')
    s.as('ethan')
    expect(await code(s.api.aboard.drinks.log('beer'))).toBe('forbidden:age')
    expect((await s.api.aboard.drinks.log('soda')).summary.today).toBe(1)
  })
})

describe('money (ACC-03, ACC-05, ACC-07)', () => {
  it('tops up by card at once and by cash after the desk has it, as credits on the bill', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    await s.api.aboard.money.topUp(100, 'card')
    let v = await s.api.aboard.money.topUp(50, 'cash')
    expect(v.topUps.find((t) => t.source === 'cash')?.settledAt).toBeNull()
    let credits = (await s.api.onboard.folio()).lines.filter((l) => l.description.includes('Top-up') || l.description.includes('Cash deposit'))
    expect(credits.map((l) => l.cents)).toEqual([-10000])
    s.later(130)
    v = await s.api.aboard.money.view()
    expect(v.topUps.find((t) => t.source === 'cash')?.settledAt).not.toBeNull()
    credits = (await s.api.onboard.folio()).lines.filter((l) => l.description.includes('Top-up') || l.description.includes('Cash deposit'))
    expect(credits.map((l) => l.cents).sort()).toEqual([-10000, -5000])
    expect(v.topUpTotal).toBe(150)
  })

  it('refuses amounts off the list, past the limit, and a card that is not there', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    expect(await code(s.api.aboard.money.topUp(30, 'card'))).toBe('invalid:badAmount')
    await s.api.aboard.money.topUp(1000, 'card')
    await s.api.aboard.money.topUp(1000, 'card')
    expect(await code(s.api.aboard.money.topUp(25, 'card'))).toBe('conflict:tooMuch')
    s.as('maria')
    await s.api.payments.removeCard('card-default')
    expect(await code(s.api.aboard.money.topUp(25, 'card'))).toBe('conflict:noCard')
    s.as('ethan')
    expect(await code(s.api.aboard.money.topUp(25, 'cash'))).toMatch(/^forbidden/)
  })

  it('sets and changes a PIN only with the current one, and asks the desk for a reset', async () => {
    const s = setup()
    expect((await s.api.aboard.money.view()).pinSet).toBe(false)
    expect(await code(s.api.aboard.money.setPin('1111'))).toBe('invalid:weak')
    expect((await s.api.aboard.money.setPin('4827')).pinSet).toBe(true)
    expect(await code(s.api.aboard.money.setPin('9051'))).toBe('forbidden:wrongPin')
    expect(await code(s.api.aboard.money.setPin('9051', '0000'))).toBe('forbidden:wrongPin')
    expect((await s.api.aboard.money.setPin('9051', '4827')).pinSet).toBe(true)
    expect(await code(s.api.aboard.money.setPin('8264', '4827'))).toBe('forbidden:wrongPin')
    expect((await s.api.aboard.money.forgotPin()).pinSet).toBe(true)
  })

  it('prepays gratuities once, with a credit on the bill', async () => {
    const s = setup('maria')
    s.at(...SEA_DAY)
    const before = (await s.api.aboard.money.view()).gratuity
    expect(before).toMatchObject({ choice: 'standard', canChange: true })
    expect(before.due).toBeGreaterThan(0)
    const v = await s.api.aboard.money.gratuity('prepaid')
    expect(v.gratuity).toMatchObject({ choice: 'prepaid', canChange: false })
    expect((await s.api.onboard.folio()).lines.find((l) => l.description === 'Gratuities prepaid by card')?.cents).toBe(-before.due)
    expect(await code(s.api.aboard.money.gratuity('removal', 'The service was very poor on day two'))).toBe('conflict:already')
  })

  it('takes a removal request only with a reason, and has nothing to pay with a package that includes them', async () => {
    const s = setup('maria')
    s.at(...SEA_DAY)
    expect(await code(s.api.aboard.money.gratuity('removal', 'bad'))).toBe('invalid:noReason')
    const v = await s.api.aboard.money.gratuity('removal', 'Our cabin was not cleaned twice')
    expect(v.gratuity).toMatchObject({ choice: 'removal', reason: 'Our cabin was not cleaned twice' })
    expect(await code(s.api.aboard.money.gratuity('nope' as never))).toBe('invalid:badChoice')
    s.as('alexander')
    const alex = (await s.api.aboard.money.view()).gratuity
    expect(alex.due).toBe(0)
    expect(await code(s.api.aboard.money.gratuity('prepaid'))).toBe('conflict:nothingDue')
  })

  it('remembers the currency for each person', async () => {
    const s = setup()
    expect((await s.api.aboard.money.view()).currency).toBe('USD')
    expect((await s.api.aboard.money.setCurrency('EUR')).currency).toBe('EUR')
    expect(await code(s.api.aboard.money.setCurrency('XXX'))).toBe('invalid:badCurrency')
    s.as('maria')
    expect((await s.api.aboard.money.view()).currency).toBe('USD')
  })
})

describe('cabin parties (ROM-06)', () => {
  it('invites cabins and gets the same answers every time', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    const made = await s.api.aboard.parties.create({ title: 'Sunset drinks', day: 3, time: '18:00', cabins: ['8123', '8125'] })
    expect(made[0].invited.map((i) => i.cabin)).toEqual(['8123', '8125'])
    expect((await s.api.aboard.parties.list())[0].invited).toEqual(made[0].invited)
    expect(await s.api.aboard.parties.cancel(made[0].id)).toEqual([])
  })

  it('refuses quiet hours, a day gone by, and a child', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    expect(await code(s.api.aboard.parties.create({ title: 'Late', day: 3, time: '23:30', cabins: ['8123'] }))).toBe('invalid:quiet')
    expect(await code(s.api.aboard.parties.create({ title: 'Old', day: 1, time: '18:00', cabins: ['8123'] }))).toBe('conflict:past')
    s.as('ethan')
    expect(await code(s.api.aboard.parties.create({ title: 'Kids', day: 3, time: '18:00', cabins: ['8123'] }))).toMatch(/^forbidden/)
  })
})

describe('group dining (DIN-09)', () => {
  it('adds and removes friends, and remembers how to split', async () => {
    const s = setup()
    const a = await s.api.aboard.groups.addFriend('res-1', { name: 'Sam Lee', cabin: '8123' }, 2)
    expect(a.friends).toEqual([{ name: 'Sam Lee', cabin: '8123' }])
    expect((await s.api.aboard.groups.setSplit('res-1', 'even')).split).toBe('even')
    expect((await s.api.aboard.groups.get('res-1')).friends).toHaveLength(1)
    expect((await s.api.aboard.groups.get('res-2')).friends).toHaveLength(0)
    expect((await s.api.aboard.groups.removeFriend('res-1', 0)).friends).toEqual([])
    expect(await code(s.api.aboard.groups.removeFriend('res-1', 3))).toBe('notFound:notFound')
    expect(await code(s.api.aboard.groups.addFriend('res-1', { name: 'S', cabin: '8123' }, 2))).toBe('invalid:noName')
    expect(await code(s.api.aboard.groups.setSplit('res-1', 'x' as never))).toBe('invalid:badSplit')
  })
})

describe('games and TV (ENT-05, ENT-06)', () => {
  it('keeps progress and does not let an answer change', async () => {
    const s = setup()
    await s.api.aboard.games.find('h-pool', true)
    await s.api.aboard.games.answer('q-ports', 1)
    expect(await code(s.api.aboard.games.answer('q-ports', 0))).toBe('conflict:answered')
    const g = await s.api.aboard.games.mark(7, true)
    expect(g).toEqual({ found: ['h-pool'], answers: { 'q-ports': 1 }, marked: [7] })
    expect((await s.api.aboard.games.find('h-pool', false)).found).toEqual([])
    expect(await code(s.api.aboard.games.find('x', true))).toBe('invalid:badClue')
    expect(await code(s.api.aboard.games.answer('q-ports', 9))).toBe('invalid:badAnswer')
    expect(await code(s.api.aboard.games.mark(99, true))).toBe('invalid:badNumber')
    s.as('maria')
    expect((await s.api.aboard.games.get()).found).toEqual([])
  })

  it('changes the TV and checks its limits and ratings', async () => {
    const s = setup()
    expect(await s.api.aboard.tv.get()).toMatchObject({ on: false, channel: 1 })
    expect(await s.api.aboard.tv.set({ on: true, channel: 4, volume: 30 })).toMatchObject({ on: true, channel: 4, volume: 30 })
    expect(await code(s.api.aboard.tv.set({ channel: 99 }))).toBe('invalid:badChannel')
    expect(await code(s.api.aboard.tv.set({ volume: 101 }))).toBe('invalid:badVolume')
    expect(await code(s.api.aboard.tv.set({ casting: '<script>' }))).toBe('invalid:badDevice')
    expect((await s.api.aboard.tv.set({ casting: "Daniel's phone" })).casting).toBe("Daniel's phone")
    const vod = await s.api.aboard.tv.set({ vod: 'v-reef' })
    expect(vod).toMatchObject({ vod: 'v-reef', channel: 12, on: true })
    expect(await code(s.api.aboard.tv.set({ vod: 'nope' }))).toBe('invalid:badTitle')
    s.as('maya')
    expect(await code(s.api.aboard.tv.set({ on: true }))).toMatch(/^forbidden/)
  })
})

describe('last-minute tours (POR-05)', () => {
  it('offers tours in port only, books on the onboard account, and counts the seats', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    expect((await s.api.aboard.lastMinute.list()).port).toBeNull()
    s.at('2027-03-23', '06:00')
    const v = await s.api.aboard.lastMinute.list()
    expect(v.port).toBe('cozumel')
    const open = v.tours.find((t) => t.closed === null)!
    expect(open).toBeTruthy()
    const after = await s.api.aboard.lastMinute.book(open.excursionId, ['daniel'])
    const row = after.tours.find((t) => t.excursionId === open.excursionId)!
    expect(row.closed).toBe('booked')
    expect(row.left).toBe(open.left - 1)
    expect(await code(s.api.aboard.lastMinute.book(open.excursionId, ['daniel']))).toBe('conflict:duplicate')
    const bill = await s.api.onboard.folio()
    expect(bill.lines.find((l) => l.id.startsWith('tour-'))).toMatchObject({ category: 'excursions', cents: expect.any(Number) })
    const today = await s.api.onboard.portDay()
    expect(today?.tours.some((t) => t.excursionId === open.excursionId)).toBe(true)
  })

  it('closes two hours before the start and refuses people off the booking', async () => {
    const s = setup()
    s.at('2027-03-23', '06:00')
    const open = (await s.api.aboard.lastMinute.list()).tours.find((t) => t.closed === null)!
    expect(await code(s.api.aboard.lastMinute.book(open.excursionId, ['gerald']))).toMatch(/^invalid/)
    expect(await code(s.api.aboard.lastMinute.book('nope', ['daniel']))).toMatch(/^invalid/)
    s.at('2027-03-23', '12:00')
    const later = (await s.api.aboard.lastMinute.list()).tours.find((t) => t.excursionId === open.excursionId)!
    expect(['started', 'tooLate']).toContain(later.closed)
    expect(await code(s.api.aboard.lastMinute.book(open.excursionId, ['daniel']))).toMatch(/^conflict/)
  })
})

describe('port-day checklist (POR-13)', () => {
  it('ticks per day and per person', async () => {
    const s = setup()
    s.at(...SEA_DAY)
    expect(await s.api.aboard.ready.set('sun', true)).toEqual(['sun'])
    expect(await s.api.aboard.ready.set('sun', true)).toEqual(['sun'])
    expect(await s.api.aboard.ready.set('card', true)).toEqual(['sun', 'card'])
    expect(await s.api.aboard.ready.set('sun', false)).toEqual(['card'])
    s.at('2027-03-23', '12:00')
    expect(await s.api.aboard.ready.get()).toEqual([])
    s.as('priya')
    s.at(...SEA_DAY)
    expect(await s.api.aboard.ready.get()).toEqual([])
  })
})

describe('chat safeguards (MSG-01, MSG-05)', () => {
  const photo = { type: 'image/png', bytes: 1000, dataUrl: 'data:image/png;base64,AAAA', caption: 'The view' }

  it('sends a photo that shows in the chat, with the caption', async () => {
    const s = setup()
    await s.api.aboard.chat.sendPhoto(photo)
    expect((await s.api.messages.list())[0]).toMatchObject({ from: 'daniel', text: 'The view', photo: photo.dataUrl })
  })

  it('refuses a bad type, a big file, a forged data URL, and a child', async () => {
    const s = setup()
    expect(await code(s.api.aboard.chat.sendPhoto({ ...photo, type: 'image/gif' }))).toBe('invalid:type')
    expect(await code(s.api.aboard.chat.sendPhoto({ ...photo, bytes: 5_000_000 }))).toBe('invalid:size')
    expect(await code(s.api.aboard.chat.sendPhoto({ ...photo, dataUrl: 'javascript:alert(1)' }))).toBe('invalid:size')
    s.as('ethan')
    expect(await code(s.api.aboard.chat.sendPhoto(photo))).toBe('forbidden:age')
  })

  it('hides a blocked person’s messages, and brings them back', async () => {
    const s = setup('daniel')
    s.as('priya')
    await s.api.messages.send('Hello from Priya')
    s.as('daniel')
    expect(await s.api.messages.list()).toHaveLength(1)
    expect(await s.api.aboard.chat.block('priya', true)).toEqual(['priya'])
    expect(await s.api.messages.list()).toHaveLength(0)
    expect(await s.api.aboard.chat.block('priya', false)).toEqual([])
    expect(await s.api.messages.list()).toHaveLength(1)
    expect(await code(s.api.aboard.chat.block('gerald', true))).toMatch(/^invalid/)
  })

  it('takes a report, and stops a child passing on a phone number', async () => {
    const s = setup('daniel')
    await expect(s.api.aboard.chat.report('m1', 'rude')).resolves.toBeUndefined()
    expect(await code(s.api.aboard.chat.report('m1', 'nope' as never))).toBe('invalid:badReason')
    s.as('ethan')
    expect(await code(s.api.messages.send('text me 555 123 4567'))).toBe('invalid:contactInfo')
    await expect(s.api.messages.send('see you at the pool')).resolves.toBeTruthy()
  })
})

describe('feedback (SUP-05)', () => {
  it('keeps a note with the log only when sent with it', async () => {
    const s = setup()
    const one = await s.api.aboard.feedback.send({ kind: 'bug', text: 'The map would not open', log: ['error x'], screenshot: 'data:image/png;base64,AAAA' })
    expect(one[0]).toMatchObject({ kind: 'bug', text: 'The map would not open', log: ['error x'], screenshot: true })
    const two = await s.api.aboard.feedback.send({ kind: 'praise', text: 'Loved the app', log: [], screenshot: null })
    expect(two).toHaveLength(2)
    expect(two.find((x) => x.kind === 'praise')?.screenshot).toBe(false)
    expect(await code(s.api.aboard.feedback.send({ kind: 'bug', text: 'no', log: [], screenshot: null }))).toBe('invalid:Tell us a little more')
    expect(await code(s.api.aboard.feedback.send({ kind: 'x' as never, text: 'something is wrong', log: [], screenshot: null }))).toBe('invalid:Tell us a little more')
    s.as('maria')
    expect(await s.api.aboard.feedback.list()).toEqual([])
  })
})
