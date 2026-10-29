import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { defaultDemoState, type DemoState } from '../demo/state'
import { decodePass, EMBARK } from '../domain/boarding'
import { SAMPLE_PHOTOS } from '../domain/checkin'
import { clockAt } from '../domain/clock'
import { personaById, type PersonaId } from '../domain/personas'
import { bookingNumber } from '../domain/trip'
import { zonedToEpoch } from '../domain/timezones'
import { isApiError } from './errors'
import { createMockApi } from './mock'
import type { Api } from './types'

const REAL = Date.UTC(2026, 9, 29, 16)
const at = (date: string, time = '10:00') => zonedToEpoch(date, time, 'America/New_York')

/** The demo starts 14 days before the 21 March 2027 sailing; check-in opens at midnight on the 18th. */
function setup(as: PersonaId | null = 'gerald') {
  let who: PersonaId | null = as
  const demo: DemoState = defaultDemoState(REAL)
  const store = createMemoryStore()
  let tick = REAL
  const api = createMockApi({ store, demo: () => demo, persona: () => who, realNow: () => (tick += 1000), sleep: async () => {} })
  return { api, demo, as: (p: PersonaId | null) => { who = p }, moveClock: (date: string, time?: string) => { demo.clock = clockAt(at(date, time), REAL, 0) } }
}
const code = async (p: Promise<unknown>) => { try { await p } catch (e) { return isApiError(e) ? `${e.code}:${e.message}` : 'other' } return null }
const GOOD = { country: 'United States', number: 'A1234567', expires: '2031-01-01' }

/** Completes every step for everyone on the booking of `who`, through the API. */
async function completeAll(api: Api, ids: PersonaId[]) {
  const v = await api.checkin.view()
  await api.checkin.save({ step: 'confirm', guests: ids })
  for (const id of ids) {
    await api.checkin.save({ step: 'document', guest: id, kind: 'passport', ...GOOD })
    await api.checkin.save({ step: 'photo', guest: id, metrics: SAMPLE_PHOTOS.good })
    await api.checkin.save({ step: 'health', guest: id, answers: { symptoms: false, positive: false, contact: false } })
  }
  await api.checkin.save({ step: 'emergency', guests: ids, name: 'Sam Example', phone: '555-0142', relationship: 'Friend' })
  await api.checkin.save({ step: 'contract', guests: ids })
  await api.checkin.save({ step: 'payment', cardId: v.cards[0].id })
  return api.checkin.save({ step: 'arrival', window: v.suggested })
}

describe('opening and closing', () => {
  it('stays shut before the third day, opens at midnight, and closes at 10:00 on sailing day', async () => {
    const { api, moveClock } = setup()
    expect((await api.checkin.status()).state).toBe('notOpen')
    expect(await code(api.checkin.save({ step: 'confirm', guests: ['gerald'] }))).toBe('conflict:notOpen')
    expect(await code(api.checkin.submit())).toBe('conflict:notOpen')
    moveClock('2027-03-18', '00:00')
    expect((await api.checkin.status()).state).toBe('open')
    moveClock('2027-03-21', '10:00')
    const closed = await api.checkin.status()
    expect(closed.state).toBe('closed')
    expect(closed.closesAt).toBe(at('2027-03-21'))
    expect(await code(api.checkin.save({ step: 'confirm', guests: ['gerald'] }))).toBe('conflict:closed')
    expect((await api.checkin.view()).canEdit).toBe(false)
  })
})

describe('steps and plain-language problems', () => {
  it('refuses a passport that is too close to expiry, but takes a birth certificate from a US guest', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-19')
    const v = await api.checkin.view()
    expect(v.guests[0].defaults.passportExpires).toBe('2027-08-14')
    expect(await code(api.checkin.save({ step: 'document', guest: 'gerald', kind: 'passport', country: 'United States', number: 'A1234567', expires: '2027-08-14' }))).toBe('invalid:document:tooSoon')
    const after = await api.checkin.save({ step: 'document', guest: 'gerald', kind: 'birthCertificate', country: '', number: '', expires: '' })
    expect(after.guests[0].record.document).toMatchObject({ kind: 'birthCertificate' })
  })

  it('keeps only the last four characters of a passport number', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-19')
    const v = await api.checkin.save({ step: 'document', guest: 'gerald', kind: 'passport', ...GOOD, number: 'a 1234-567' })
    expect(v.guests[0].record.document).toMatchObject({ last4: '4567', country: 'United States' })
    expect(JSON.stringify(v)).not.toContain('A1234567')
  })

  it('names every photo problem at once and keeps no picture', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-19')
    expect(await code(api.checkin.save({ step: 'photo', guest: 'gerald', metrics: { width: 300, height: 1200, brightness: 30, sharpness: 2 } }))).toBe('invalid:photo:small,shape,dark,blurry')
    const v = await api.checkin.save({ step: 'photo', guest: 'gerald', metrics: SAMPLE_PHOTOS.good })
    expect(Object.keys(v.guests[0].record.photo!)).toEqual(['at'])
  })

  it('checks the emergency contact, health answers, card and arrival window', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-19')
    expect(await code(api.checkin.save({ step: 'emergency', guests: ['gerald'], name: 'Gerald Whitfield', phone: '555-0142', relationship: 'Self' }))).toBe('invalid:emergency:travelling')
    expect(await code(api.checkin.save({ step: 'emergency', guests: ['gerald'], name: 'Sam', phone: 'x', relationship: 'Friend' }))).toBe('invalid:emergency:phone')
    expect(await code(api.checkin.save({ step: 'health', guest: 'gerald', answers: { symptoms: false } }))).toBe('invalid:health:answers')
    expect(await code(api.checkin.save({ step: 'payment', cardId: 'nope' }))).toBe('invalid:payment:card')
    expect(await code(api.checkin.save({ step: 'arrival', window: '09:00' }))).toBe('invalid:arrival:window')
    expect(await code(api.checkin.save({ step: 'confirm', guests: ['maria'] }))).toBe('invalid:guests')
  })

  it('declines a card ending 0002', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-19')
    const cards = await api.payments.addCard('visa', '0002', '12/29')
    expect(await code(api.checkin.save({ step: 'payment', cardId: cards[cards.length - 1].id }))).toBe('declined:Visa ending 0002')
  })

  it('shares the arrival window with the travel plan so nothing is entered twice', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-19')
    await api.checkin.save({ step: 'arrival', window: '11:30' })
    expect((await api.plan.travel.get()).plan.window).toBe('11:30')
    await api.plan.travel.save({ window: '12:00', mode: null, hotel: null })
    expect((await api.checkin.view()).arrival).toBe('12:00')
  })

  it('loses nothing when a save fails: the first save drops, the retry works', async () => {
    const { api, demo, moveClock } = setup()
    moveClock('2027-03-19')
    demo.scenarios = ['checkinDrop']
    expect(await code(api.checkin.save({ step: 'confirm', guests: ['gerald'] }))).toBe('network:network')
    expect((await api.checkin.view()).guests[0].record.confirm).toBeUndefined()
    expect((await api.checkin.save({ step: 'confirm', guests: ['gerald'] })).guests[0].record.confirm).toBeDefined()
  })
})

describe('a family does it once', () => {
  it('lets a parent answer shared steps for everyone and tracks what is left per guest', async () => {
    const { api, as, moveClock } = setup('daniel')
    moveClock('2027-03-19')
    const ids: PersonaId[] = ['daniel', 'priya', 'ethan', 'maya']
    let v = await api.checkin.save({ step: 'confirm', guests: ids })
    v = await api.checkin.save({ step: 'emergency', guests: ids, name: 'Grandma Joan', phone: '555-0177', relationship: 'Grandmother' })
    v = await api.checkin.save({ step: 'contract', guests: ids })
    expect(v.guests.every((g) => g.progress.done.length === 3)).toBe(true)
    expect(v.guests.find((g) => g.id === 'maya')!.record.contract).toMatchObject({ by: 'daniel' })
    expect(v.progress).toMatchObject({ done: 12, total: 4 * 6 + 2, complete: false, next: { step: 'document', guest: 'daniel' } })
    // The children's own accounts see the same progress but cannot change anything.
    as('ethan')
    const kid = await api.checkin.view()
    expect(kid.canEdit).toBe(false)
    expect(kid.progress.done).toBe(12)
    expect(await code(api.checkin.save({ step: 'confirm', guests: ['ethan'] }))).toBe('forbidden:This account is supervised')
  })

  it('fills the emergency contact from the profile first, then from the person booking', async () => {
    const { api, moveClock } = setup('daniel')
    moveClock('2027-03-19')
    const v = await api.checkin.view()
    expect(v.guests.find((g) => g.id === 'daniel')!.defaults.emergency.name).toBe('Sam Example')
    expect(v.guests.find((g) => g.id === 'maya')!.defaults.emergency.name).toBe('Sam Example')
  })
})

describe('finishing, the pass and the receipt', () => {
  it('will not finish until every step is done, then finishes once and issues a pass', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-19')
    expect(await code(api.checkin.submit())).toBe('conflict:incomplete')
    const before = await api.boarding.pass()
    expect(before).toMatchObject({ checkinDone: false, lane: 'blue' })
    expect(before.passes[0]).toMatchObject({ ready: false, code: '' })
    expect(await code(api.boarding.addToWallet())).toBe('conflict:notDone')

    const v = await completeAll(api, ['gerald'])
    expect(v.progress.complete).toBe(true)
    expect((await api.checkin.submit()).state).toBe('done')
    expect((await api.checkin.submit()).state).toBe('done')
    expect((await api.checkin.view()).finishedAt).not.toBeNull()

    const pass = await api.boarding.pass()
    expect(pass).toMatchObject({ checkinDone: true, lane: 'green', terminal: { name: 'Terminal 2' }, number: bookingNumber('gerald') })
    const p = pass.passes[0]
    expect(p).toMatchObject({ ready: true, printed: 'WHITFIELD/GERALD', group: 'Priority' })
    expect(decodePass(p.code)).toMatchObject({ booking: bookingNumber('gerald'), name: 'WHITFIELD/GERALD', cabin: p.cabin, group: 'Priority' })
    expect(p.muster).toMatch(/^Station [A-F]$/)
  })

  it('puts the whole party on one booking with their own numbered passes', async () => {
    const { api, moveClock } = setup('daniel')
    moveClock('2027-03-19')
    await completeAll(api, ['daniel', 'priya', 'ethan', 'maya'])
    await api.checkin.submit()
    const pass = await api.boarding.pass()
    expect(pass.passes.map((x) => [x.seq, x.printed])).toEqual([[1, 'HARPER/DANIEL'], [2, 'HARPER/PRIYA'], [3, 'HARPER/ETHAN'], [4, 'HARPER/MAYA']])
    expect(new Set(pass.passes.map((x) => x.cabin)).size).toBe(1)
    expect(new Set(pass.passes.map((x) => x.code)).size).toBe(4)
  })

  it('adds the pass to the simulated wallet once check-in is done', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-19')
    await completeAll(api, ['gerald'])
    await api.checkin.submit()
    expect((await api.boarding.pass()).inWallet).toBe(false)
    expect((await api.boarding.addToWallet()).inWallet).toBe(true)
    expect((await api.boarding.pass()).inWallet).toBe(true)
  })

  it('shows what is on file for each guest, with when it was saved and how to correct it', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-19')
    const empty = await api.checkin.receipt()
    expect(empty.complete).toBe(false)
    expect(empty.guests[0].items.every((i) => i.savedAt === null && i.detail === null)).toBe(true)
    await completeAll(api, ['gerald'])
    const r = await api.checkin.receipt()
    expect(r.complete).toBe(true)
    const byStep = Object.fromEntries(r.guests[0].items.map((i) => [i.step, i]))
    expect(byStep.document.detail).toBe('Passport ending 4567, United States')
    expect(byStep.photo.detail).toBe('Photo accepted')
    expect(byStep.emergency.detail).toBe('Sam Example, 555-0142')
    expect(byStep.document.savedAt).toBeGreaterThan(0)
    expect(r.booking.map((i) => i.step)).toEqual(['payment', 'arrival'])
    expect(r.booking[0].detail).toMatch(/ending 4242$/)
    // It survives: a new request (as after sign-out or an app update) reads the same records.
    expect((await api.checkin.receipt()).guests[0].items[1].savedAt).toBe(byStep.document.savedAt)
  })

  it('records a health yes for the terminal nurse without stopping check-in', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-19')
    await completeAll(api, ['gerald'])
    await api.checkin.save({ step: 'health', guest: 'gerald', answers: { symptoms: true, positive: false, contact: false } })
    expect((await api.checkin.submit()).state).toBe('done')
    expect((await api.checkin.receipt()).guests[0].items.find((i) => i.step === 'health')!.detail).toMatch(/nurse/)
    expect((await api.boarding.embark()).nurseCheck).toEqual(['Gerald Whitfield'])
  })
})

describe('finding a pass without signing in', () => {
  it('finds it by booking number and a last name on the booking, and says the same thing for any mismatch', async () => {
    const { api, as, moveClock } = setup('daniel')
    moveClock('2027-03-19')
    await completeAll(api, ['daniel', 'priya', 'ethan', 'maya'])
    await api.checkin.submit()
    as(null)
    const number = bookingNumber('daniel')
    const found = await api.boarding.lookup(` ${number.toLowerCase().slice(0, 2)} ${number.slice(2)} `, 'harper')
    expect(found.passes).toHaveLength(4)
    expect(found.passes[0].ready).toBe(true)
    expect(await code(api.boarding.lookup(number, 'Smith'))).toBe('notFound:notFound')
    expect(await code(api.boarding.lookup('PC000000', 'Harper'))).toBe('notFound:notFound')
    expect(await code(api.boarding.lookup('', ''))).toBe('notFound:notFound')
  })
})

describe('embarkation day', () => {
  it('shows arrival, terminal, wait guide, traffic and a terminal change', async () => {
    const { api, demo, moveClock } = setup('maria')
    moveClock('2027-03-19')
    expect((await api.boarding.embark()).traffic).toBeNull()
    await api.checkin.save({ step: 'arrival', window: '12:00' })
    let e = await api.boarding.embark()
    expect(e.boarding.arrival).toMatchObject({ start: '12:00', crowd: 'busiest' })
    expect(e).toMatchObject({ traffic: 'heavy', boarding: { waitMinutes: 40, lane: 'blue', terminal: { name: 'Terminal 2' } } })
    expect(e.opensAt).toBe(at('2027-03-21', EMBARK.terminalOpens))
    expect(e.gangwayClosesAt).toBe(at('2027-03-21', EMBARK.gangwayCloses))
    demo.scenarios = ['terminalChange']
    e = await api.boarding.embark()
    expect(e.boarding.terminal).toEqual({ name: 'Terminal 4', changedFrom: 'Terminal 2' })
  })

  it('lets a priority guest in half an hour earlier', async () => {
    const { api, moveClock } = setup('alexander')
    moveClock('2027-03-19')
    expect((await api.boarding.embark()).opensAt).toBe(at('2027-03-21', EMBARK.priorityOpens))
  })

  it('saves companion steps and carry-on ticks, and follows the bags to the stateroom', async () => {
    const { api, moveClock } = setup()
    moveClock('2027-03-21', '09:00')
    let e = await api.boarding.embark()
    expect(e.current).toBe('terminal')
    expect(e.stateroomReady).toBe(false)
    expect(e.luggage.status).toBe('notDropped')
    e = await api.boarding.setCompanion('terminal', true)
    e = await api.boarding.setCompanion('security', true)
    expect(e.current).toBe('photo')
    e = await api.boarding.setCompanion('security', false)
    expect(e.current).toBe('security')
    e = await api.boarding.setCarryOn('medication', true)
    expect(e.carryOn.find((c) => c.id === 'medication')!.done).toBe(true)
    expect(await code(api.boarding.setCarryOn('nope' as never, true))).toBe('invalid:item')

    e = await api.boarding.setBags(true)
    expect(e.luggage.status).toBe('dropped')
    moveClock('2027-03-21', '12:00')
    expect((await api.boarding.embark()).luggage.status).toBe('dropped')
    moveClock('2027-03-21', '13:30')
    e = await api.boarding.embark()
    expect(e).toMatchObject({ stateroomReady: true, luggage: { status: 'delivered' } })
    expect(e.afternoon.map((a) => a.id)).toEqual(['lunch', 'stateroom', 'muster', 'sailAway'])
    expect((await api.boarding.setBags(false)).luggage.status).toBe('notDropped')
  })

  it('lists who has the documents they need', async () => {
    const { api, moveClock } = setup('maria')
    moveClock('2027-03-19')
    expect((await api.boarding.embark()).documents).toEqual([{ id: 'maria', name: 'Maria Delgado', ready: false }])
    expect(personaById('maria')).toBeDefined()
  })
})

describe('offline', () => {
  it('fails with an offline error when the phone has no signal, which the screens answer from their saved copy', async () => {
    const { api, demo, moveClock } = setup()
    moveClock('2027-03-19')
    demo.network.offline = true
    expect(await code(api.boarding.pass())).toBe('offline:offline')
    expect(await code(api.checkin.save({ step: 'confirm', guests: ['gerald'] }))).toBe('offline:offline')
  })
})
