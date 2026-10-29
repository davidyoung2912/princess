import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { clockAt } from '../domain/clock'
import { defaultDemoState, type DemoState } from '../demo/state'
import type { OrderInput } from '../domain/orders'
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
  const api = createMockApi({ store, demo: () => demo, persona: () => who, realNow: () => REAL, sleep: async () => {} })
  return {
    api,
    as: (p: PersonaId) => { who = p },
    at: (date: string, time: string, zone = 'America/New_York') => { demo.clock = clockAt(zonedToEpoch(date, time, zone), REAL, 0) },
    /** Moves the held clock on by minutes. */
    later: (minutes: number) => { demo.clock = clockAt(demo.clock.anchorDemo + minutes * 60_000, REAL, 0) },
    scenario: (...ids: ScenarioId[]) => { demo.scenarios = ids },
  }
}

const code = async (p: Promise<unknown>) => { try { await p } catch (e) { return isApiError(e) ? `${e.code}:${e.message}` : 'other' } return null }
const order = (over: Partial<OrderInput> = {}): OrderInput => ({ kind: 'delivery', lines: [{ itemId: 'fries', qty: 1, extras: [], guest: 'daniel' }], location: { kind: 'cabin' }, tip: 0, ...over })

describe('ordering', () => {
  it('is closed before the cruise and for a supervised child', async () => {
    const s = setup()
    expect((await s.api.orders.menu()).open).toBe(false)
    expect(await code(s.api.orders.place(order()))).toBe('conflict:closed')
    s.at('2027-03-22', '12:00')
    s.as('ethan')
    expect((await s.api.orders.menu()).canOrder).toBe(false)
    expect(await code(s.api.orders.place(order()))).toBe('forbidden:This account is supervised')
  })

  it('places an order, shows it moving through the stages with an ETA, and puts it on the bill', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    const placed = await s.api.orders.place(order({ lines: [{ itemId: 'cheeseburger', qty: 1, extras: ['bacon'], guest: 'daniel' }], tip: 200 }))
    expect(placed).toMatchObject({ stage: 'received', total: 1200 + 200, canCancel: true })
    expect(placed.etaAt).toBe(zonedToEpoch('2027-03-22', '12:30', 'America/New_York'))
    s.later(10)
    expect((await s.api.orders.list())[0].stage).toBe('preparing')
    s.later(15)
    expect((await s.api.orders.list())[0].stage).toBe('onTheWay')
    s.later(10)
    expect((await s.api.orders.list())[0].stage).toBe('delivered')
    const folio = await s.api.onboard.folio()
    const mine = folio.lines.filter((l) => l.id.startsWith('order-'))
    expect(mine.map((l) => l.cents)).toEqual([1200, 200])
    expect(folio.totals.balance).toBeGreaterThanOrEqual(1400)
  })

  it('applies the drinks package visibly and the bar service charge', async () => {
    const s = setup('daniel')
    s.at('2027-03-22', '19:00')
    const placed = await s.api.orders.place(order({ kind: 'room', lines: [{ itemId: 'premium-cocktail', qty: 1, extras: [], guest: 'daniel' }] }))
    expect(placed.lines[0]).toMatchObject({ gross: 2200, charge: 700, coveredBy: 'package' })
    expect(placed.covered).toBe(1500)
    expect(placed.service).toBe(396)
    const line = (await s.api.onboard.folio()).lines.find((l) => l.id === `order-${placed.id}-0`)!
    expect(line).toMatchObject({ cents: 700, value: 2200, coveredBy: 'package' })
  })

  it('refuses alcohol for someone under 21 and anyone off the booking', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    expect(await code(s.api.orders.place(order({ lines: [{ itemId: 'beer', qty: 1, extras: [], guest: 'ethan' }] })))).toBe('invalid:underage')
    expect(await code(s.api.orders.place(order({ lines: [{ itemId: 'fries', qty: 1, extras: [], guest: 'marcus' }] })))).toBe('invalid:noGuest')
  })

  it('flags an item that is out of stock before checkout and refuses it', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    s.scenario('orderStock')
    expect((await s.api.orders.menu()).outOfStock).toEqual(['fish-tacos'])
    expect(await code(s.api.orders.place(order({ lines: [{ itemId: 'fish-tacos', qty: 1, extras: [], guest: 'daniel' }] })))).toBe('conflict:unavailable')
    expect(await s.api.orders.list()).toEqual([])
  })

  it('stops the order when an item runs out in the kitchen, and lets the guest swap it without losing the rest', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    s.scenario('orderStock')
    const lines = [{ itemId: 'lava-cake', qty: 2, extras: [], guest: 'daniel' as PersonaId }, { itemId: 'fries', qty: 1, extras: [], guest: 'daniel' as PersonaId }]
    const placed = await s.api.orders.place(order({ lines }))
    expect(placed.unavailable).toEqual([])
    s.later(6)
    const stuck = (await s.api.orders.list())[0]
    expect(stuck).toMatchObject({ stage: 'needsChoice', etaAt: null, unavailable: [0], canCancel: true })
    s.later(30)
    expect((await s.api.orders.list())[0].stage).toBe('needsChoice')
    expect(await code(s.api.orders.resolve(placed.id, {}))).toBe('invalid:incomplete')
    const fixed = await s.api.orders.resolve(placed.id, { 0: 'substitute' })
    expect(fixed.lines[0]).toMatchObject({ name: 'Seasonal fruit plate', substitutedFor: 'lava-cake', charge: 1200 })
    expect(fixed.lines[1].name).toBe('Fries')
    expect(fixed.stage).toBe('preparing')
    expect(fixed.etaAt).not.toBeNull()
    expect(await code(s.api.orders.resolve(placed.id, { 0: 'remove' }))).toBe('conflict:nothingToChoose')
    s.later(40)
    expect((await s.api.orders.list())[0].stage).toBe('delivered')
  })

  it('removes a line, and cancels the whole order with a refund if every line is removed', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    s.scenario('orderStock')
    const placed = await s.api.orders.place(order({ lines: [{ itemId: 'lava-cake', qty: 1, extras: [], guest: 'daniel' }], tip: 200 }))
    s.later(6)
    const gone = await s.api.orders.resolve(placed.id, { 0: 'remove' })
    expect(gone).toMatchObject({ stage: 'cancelled', total: 0 })
  })

  it('cancels with a full refund shown on the bill, and refuses once cooking has started', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    const first = await s.api.orders.place(order({ tip: 200 }))
    s.later(2)
    const cancelled = await s.api.orders.cancel(first.id)
    expect(cancelled).toMatchObject({ stage: 'cancelled', refund: 700 })
    const lines = (await s.api.onboard.folio()).lines.filter((l) => l.id.startsWith(`order-${first.id}`))
    expect(lines.reduce((n, l) => n + l.cents, 0)).toBe(0)
    const second = await s.api.orders.place(order())
    s.later(8)
    expect(await code(s.api.orders.cancel(second.id))).toBe('conflict:tooLate')
  })

  it('corrects the delivery location until it arrives, and adds the delivery fee away from the stateroom', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    const placed = await s.api.orders.place(order())
    expect(placed.fee).toBe(0)
    const moved = await s.api.orders.moveTo(placed.id, { kind: 'zone', placeId: 'lido-pool' })
    expect(moved).toMatchObject({ fee: 200, location: { kind: 'zone', placeId: 'lido-pool' } })
    expect(await code(s.api.orders.moveTo(placed.id, { kind: 'other', text: 'x' }))).toBe('invalid:badLocation')
    s.later(40)
    expect(await code(s.api.orders.moveTo(placed.id, { kind: 'cabin' }))).toBe('conflict:tooLate')
  })

  it('counts a call to Guest Services about an order', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    const placed = await s.api.orders.place(order())
    expect((await s.api.orders.contact(placed.id)).contacted).toBe(1)
  })

  it('schedules room-service breakfast with notice, holds it, and delivers at the time', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    const menu = await s.api.orders.menu()
    const slot = menu.mornings[0].slots.find((x) => x.time === '07:30')!
    const b = order({ kind: 'breakfast', deliverAt: slot.at, lines: [{ itemId: 'continental', qty: 2, extras: [], guest: 'daniel' }] })
    expect(await code(s.api.orders.place({ ...b, deliverAt: slot.at + 1 }))).toBe('invalid:noTime')
    expect(await code(s.api.orders.place({ ...b, deliverAt: REAL }))).toBe('invalid:noTime')
    const placed = await s.api.orders.place(b)
    expect(placed).toMatchObject({ stage: 'scheduled', total: 0, etaAt: slot.at })
    s.at('2027-03-23', '07:30')
    expect((await s.api.orders.list())[0].stage).toBe('delivered')
  })

  it('makes meals and delivery free while the booking is isolating for illness', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    await s.api.health.report({ guests: ['maya'], symptoms: ['vomiting'], startedHoursAgo: 3 })
    expect((await s.api.orders.menu()).isolating).toBe(true)
    const placed = await s.api.orders.place(order({ lines: [{ itemId: 'cheeseburger', qty: 1, extras: [], guest: 'maya' }], location: { kind: 'zone', placeId: 'dome' } }))
    expect(placed).toMatchObject({ total: 0, free: true, fee: 0 })
    s.as('marcus')
    expect((await s.api.orders.menu()).isolating).toBe(false)
  })
})

describe('family and clubs', () => {
  it('shows the children on the booking with a club, zones and a place', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    const v = await s.api.family.view()
    expect(v.kids.map((k) => k.id).sort()).toEqual(['ethan', 'maya'])
    const maya = v.kids.find((k) => k.id === 'maya')!
    expect(maya.club).toMatchObject({ id: 'neon-grove', open: true })
    expect(maya.zones).toContain('neon-grove')
    expect(v.canEdit).toBe(true)
    expect(v.reunion.placeId).toBe('guest-services')
    s.as('gerald')
    expect((await s.api.family.view()).kids).toEqual([])
  })

  it('checks a child in and out and tells the parents', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    const v = await s.api.family.checkIn('maya')
    const maya = v.kids.find((k) => k.id === 'maya')!
    expect(maya).toMatchObject({ status: 'inClub', canCheckOut: true, seen: { placeId: 'neon-grove', source: 'club' } })
    expect(v.log[0].text).toMatch(/Maya checked in to Neon Grove/)
    expect(await code(s.api.family.checkIn('maya'))).toBe('invalid:alreadyIn')
    s.as('priya')
    expect((await s.api.family.view()).kids.find((k) => k.id === 'maya')!.inClub).not.toBeNull()
    const out = await s.api.family.checkOut('maya')
    expect(out.kids.find((k) => k.id === 'maya')!.inClub).toBeNull()
    expect(out.log[0].text).toMatch(/checked out/)
    expect(await code(s.api.family.checkOut('maya'))).toBe('conflict:notIn')
  })

  it('refuses a club that is closed, or a child outside the booking', async () => {
    const s = setup()
    s.at('2027-03-22', '07:00')
    expect(await code(s.api.family.checkIn('maya'))).toBe('invalid:closed')
    s.at('2027-03-22', '12:00')
    expect(await code(s.api.family.checkIn('lucas'))).toBe('forbidden:Not a child on your booking')
    s.as('marcus')
    expect((await s.api.family.checkIn('lucas')).kids.find((k) => k.id === 'lucas')!.club?.id).toBe('firefly')
  })

  it('lets only an authorised adult collect a child, and a child sign out alone only where allowed', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    await s.api.family.checkIn('maya')
    await s.api.family.setAuth('maya', { pickup: ['daniel'], signOutAlone: false, photos: true })
    s.as('priya')
    expect(await code(s.api.family.checkOut('maya'))).toBe('forbidden:notAuthorised')
    s.as('daniel')
    expect(await code(s.api.family.setAuth('maya', { pickup: [], signOutAlone: false, photos: false }))).toBe('invalid:noPickup')
    expect(await code(s.api.family.setAuth('maya', { pickup: ['daniel'], signOutAlone: true, photos: false }))).toBe('invalid:tooYoungAlone')
    await s.api.family.checkIn('ethan')
    await s.api.family.setAuth('ethan', { pickup: ['daniel'], signOutAlone: true, photos: false })
    s.as('ethan')
    expect((await s.api.family.view()).kids.find((k) => k.id === 'ethan')!.canCheckOut).toBe(true)
    expect((await s.api.family.checkOut('ethan')).kids.find((k) => k.id === 'ethan')!.inClub).toBeNull()
    expect(await code(s.api.family.setZones('ethan', ['lido-pool']))).toBe('forbidden:This account is supervised')
  })

  it('sets zones and the meeting plan with checks', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    expect(await code(s.api.family.setZones('maya', []))).toBe('invalid:badZones')
    expect(await code(s.api.family.setZones('maya', ['casino']))).toBe('invalid:badZones')
    const v = await s.api.family.setZones('maya', ['lido-pool', 'piazza'])
    expect(v.kids.find((k) => k.id === 'maya')!.zones).toEqual(['lido-pool', 'piazza'])
    expect(await code(s.api.family.setReunion({ placeId: 'piazza', backupId: 'piazza', note: '' }))).toBe('invalid:badMeeting')
    const r = await s.api.family.setReunion({ placeId: 'piazza', backupId: 'eatery', note: 'Under the clock' })
    expect(r.reunion).toEqual({ placeId: 'piazza', backupId: 'eatery', note: 'Under the clock' })
  })

  it('flags the youngest child as not seen for a while in the missing-child scenario', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    s.scenario('childMissing')
    const v = await s.api.family.view()
    expect(v.kids.find((k) => k.id === 'maya')).toMatchObject({ status: 'overdue' })
    expect(v.kids.find((k) => k.id === 'ethan')!.status).not.toBe('overdue')
    await s.api.family.checkIn('maya')
    expect((await s.api.family.view()).kids.find((k) => k.id === 'maya')!.status).toBe('inClub')
  })
})

describe('health', () => {
  it('gives hours by day type and the illness notice only in the scenario', async () => {
    const s = setup()
    s.at('2027-03-22', '09:00')
    expect(await s.api.health.view()).toMatchObject({ day: 'sea', open: true, notice: false })
    s.at('2027-03-23', '11:00')
    expect(await s.api.health.view()).toMatchObject({ day: 'port', open: false, nextOpen: '17:30' })
    s.scenario('illness')
    expect((await s.api.health.view()).notice).toBe(true)
  })

  it('records an illness report and a request privately, not in the shared history', async () => {
    const s = setup()
    s.at('2027-03-25', '09:00')
    expect(await code(s.api.health.report({ guests: ['marcus'], symptoms: ['fever'], startedHoursAgo: 2 }))).toBe('forbidden:Not on your booking')
    expect(await code(s.api.health.report({ guests: ['daniel'], symptoms: [], startedHoursAgo: 2 }))).toBe('invalid:noSymptoms')
    const v = await s.api.health.report({ guests: ['daniel', 'maya'], symptoms: ['vomiting', 'fever'], startedHoursAgo: 5 })
    expect(v.reports[0]).toMatchObject({ guests: ['daniel', 'maya'], symptoms: ['vomiting', 'fever'] })
    expect(v.isolating).toBe(true)
    expect(await code(s.api.health.request('headache' as never, ''))).toBe('invalid:badKind')
    expect((await s.api.health.request('seasick', 'Ginger tablets please')).requests[0]).toMatchObject({ kind: 'seasick', note: 'Ginger tablets please' })
    s.as('priya')
    const priya = await s.api.health.view()
    expect(priya.reports).toEqual([])
    expect(priya.isolating).toBe(true)
    expect((await s.api.account.history()).some((h) => /vomit|fever|ill/i.test(h.detail))).toBe(false)
    s.later(80 * 60)
    expect((await s.api.health.view()).isolating).toBe(false)
  })
})

describe('stateroom', () => {
  it('shows the cabin card and keeps settings with the booking', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    const r = await s.api.room.view()
    expect(r.number).toMatch(/^\d+$/)
    expect(r.steward.length).toBeGreaterThan(0)
    expect(r.amenities).toContain('balcony')
    expect(r.hasView).toBe(true)
    await s.api.room.setHousekeeping({ mode: 'dnd', window: 'afternoon' })
    s.as('priya')
    expect((await s.api.room.view()).housekeeping).toMatchObject({ mode: 'dnd', window: 'afternoon' })
  })

  it('switches Do Not Disturb and Make Up Room, keeping when it began, and flags a long Do Not Disturb', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    const on = await s.api.room.setHousekeeping({ mode: 'dnd' })
    const since = on.housekeeping.since
    expect(since).not.toBeNull()
    s.later(60)
    expect((await s.api.room.setHousekeeping({ window: 'evening' })).housekeeping.since).toBe(since)
    expect((await s.api.room.view()).checkDue).toBe(false)
    s.later(24 * 60)
    expect((await s.api.room.view()).checkDue).toBe(true)
    const makeUp = await s.api.room.setHousekeeping({ mode: 'makeUp' })
    expect(makeUp).toMatchObject({ checkDue: false, housekeeping: { mode: 'makeUp' } })
    expect((await s.api.room.setHousekeeping({ mode: 'none' })).housekeeping.since).toBeNull()
    expect(await code(s.api.room.setHousekeeping({ mode: 'party' as never }))).toBe('invalid:badMode')
  })

  it('controls the mock devices within their range and keeps the others when one changes', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    await s.api.room.setDevices({ lights: 'dim', tempF: 68 })
    const r = await s.api.room.setDevices({ tv: true })
    expect(r.devices).toEqual({ lights: 'dim', tempF: 68, tv: true, shades: 'open' })
    expect(await code(s.api.room.setDevices({ tempF: 90 }))).toBe('invalid:badTemp')
    s.as('ethan')
    expect((await s.api.room.view()).canEdit).toBe(false)
    expect(await code(s.api.room.setDevices({ tv: false }))).toBe('forbidden:This account is supervised')
  })
})

describe('photos', () => {
  it('has no photos before the cruise, and some by the portrait night', async () => {
    const s = setup()
    expect((await s.api.photos.list()).photos).toEqual([])
    s.at('2027-03-22', '20:00')
    const v = await s.api.photos.list()
    expect(v.throughDay).toBe(2)
    expect(v.photos.length).toBe(6)
    expect(v.schedule.length).toBeGreaterThan(0)
  })

  it('keeps favourites per person', async () => {
    const s = setup()
    s.at('2027-03-22', '20:00')
    const id = (await s.api.photos.list()).photos[0].id
    expect(await s.api.photos.toggleFavourite(id)).toEqual([id])
    s.as('priya')
    expect((await s.api.photos.list()).favourites).toEqual([])
    s.as('daniel')
    expect(await s.api.photos.toggleFavourite(id)).toEqual([])
    expect(await code(s.api.photos.toggleFavourite('nope'))).toBe('invalid:unknownPhoto')
  })

  it('prices a choice before buying, buys it, and refuses to sell the same photo twice', async () => {
    const s = setup()
    s.at('2027-03-24', '20:00')
    const photos = (await s.api.photos.list()).photos
    const ids = photos.slice(0, 3).map((p) => p.id)
    const q = await s.api.photos.quote(ids)
    expect(q).toMatchObject({ included: 0, paid: 3, cheapest: 'each' })
    expect(await code(s.api.photos.quote([]))).toBe('invalid:empty')
    expect(await code(s.api.photos.buy(ids, 'bogus' as never))).toBe('invalid:badOption')
    const r = await s.api.photos.buy(ids, 'each')
    expect(r).toMatchObject({ option: 'each', paid: 5985, saved: 0, verified: false })
    expect(await code(s.api.photos.quote([ids[0]]))).toBe('invalid:alreadyOwned')
    const folio = await s.api.onboard.folio()
    expect(folio.lines.find((l) => l.id === `photos-${r.id}`)).toMatchObject({ category: 'photos', cents: 5985 })
    expect((await s.api.photos.list()).owned.sort()).toEqual([...ids].sort())
  })

  it('shows photos included with Premier as included, and charges only for the rest', async () => {
    const s = setup('alexander')
    s.at('2027-03-24', '20:00')
    const v = await s.api.photos.list()
    expect(v.includedLeft).toBe(12)
    const ids = v.photos.map((p) => p.id)
    const q = await s.api.photos.quote(ids.slice(0, 2))
    expect(q).toMatchObject({ included: 2, paid: 0 })
    const r = await s.api.photos.buy(ids.slice(0, 2), 'each')
    expect(r).toMatchObject({ option: 'included', paid: 0 })
    expect((await s.api.photos.list()).includedLeft).toBe(10)
  })

  it('buys everything with the all-digital option, including photos not yet chosen', async () => {
    const s = setup()
    s.at('2027-03-24', '20:00')
    const v = await s.api.photos.list()
    const r = await s.api.photos.buy([v.photos[0].id], 'all')
    expect(r.photoIds.length).toBe(v.photos.length)
    expect((await s.api.photos.list()).owned.length).toBe(v.photos.length)
  })

  it('downloads in batches that are counted and checked, and picks up where it left off after a failure', async () => {
    const s = setup()
    s.at('2027-03-27', '20:00')
    s.scenario('photoFail')
    const v = await s.api.photos.list()
    const ids = v.photos.slice(0, 12).map((p) => p.id)
    const r = await s.api.photos.buy(ids, 'all')
    const total = r.photoIds.length
    expect(total).toBeGreaterThanOrEqual(12)
    expect(await code(s.api.photos.download(r.id))).toBe('network:network')
    let got = await s.api.photos.download(r.id)
    expect(got.saved).toBe(5)
    expect(got.verified).toBe(false)
    expect(await code(s.api.photos.download('missing'))).toBe('notFound:notFound')
    while (!got.verified) got = await s.api.photos.download(r.id)
    expect(got.saved).toBe(total)
    s.at('2027-04-20', '12:00')
    expect(got.until).toBeGreaterThan(zonedToEpoch('2027-04-01', '00:00', 'America/New_York'))
    expect(await code(s.api.photos.download(r.id))).toBe('conflict:expired')
  })
})

describe('laundry', () => {
  it('offers pick-up windows aboard only and refuses a window it did not offer', async () => {
    const s = setup()
    expect((await s.api.laundry.view()).pickups.washFold).toEqual([])
    s.at('2027-03-22', '10:00')
    const v = await s.api.laundry.view()
    expect(v.pickups.washFold.length).toBeGreaterThan(0)
    expect(await code(s.api.laundry.request({ service: 'washFold', qty: 1, pickupAt: 5, note: '' }))).toBe('invalid:badPickup')
    expect(await code(s.api.laundry.request({ service: 'washFold', qty: 9, pickupAt: v.pickups.washFold[0].at, note: '' }))).toBe('invalid:badQuantity')
    expect(await code(s.api.laundry.request({ service: 'iron' as never, qty: 1, pickupAt: 5, note: '' }))).toBe('invalid:badService')
  })

  it('requests, charges when collected, tracks, and cancels before collection', async () => {
    const s = setup()
    s.at('2027-03-22', '10:00')
    const pick = (await s.api.laundry.view()).pickups.press[0]
    const v = await s.api.laundry.request({ service: 'press', qty: 4, pickupAt: pick.at, note: 'Shirts on hangers' })
    expect(v.requests[0]).toMatchObject({ service: 'press', qty: 4, stage: 'requested', total: 1200, free: 0 })
    expect((await s.api.onboard.folio()).lines.some((l) => l.id.startsWith('laundry-'))).toBe(false)
    const cancelled = await s.api.laundry.cancel(v.requests[0].id)
    expect(cancelled.requests[0].stage).toBe('cancelled')
    const again = await s.api.laundry.request({ service: 'press', qty: 2, pickupAt: pick.at, note: '' })
    s.at(pick.date, '23:00')
    expect((await s.api.laundry.view()).requests[0]).toMatchObject({ id: again.requests[0].id, stage: 'cleaning' })
    expect((await s.api.onboard.folio()).lines.filter((l) => l.id.startsWith('laundry-')).map((l) => l.cents)).toEqual([600])
  })

  it('gives the loyalty perk once, as a free first bag', async () => {
    const s = setup('gerald')
    s.at('2027-03-22', '10:00')
    expect((await s.api.laundry.view()).freeBagLeft).toBe(true)
    const pick = (await s.api.laundry.view()).pickups.washFold
    const a = await s.api.laundry.request({ service: 'washFold', qty: 2, pickupAt: pick[0].at, note: '' })
    expect(a.requests[0]).toMatchObject({ total: 1800, free: 1800 })
    expect(a.freeBagLeft).toBe(false)
    const b = await s.api.laundry.request({ service: 'washFold', qty: 1, pickupAt: pick[1].at, note: '' })
    expect(b.requests[0]).toMatchObject({ total: 1800, free: 0 })
    s.as('maria')
    expect((await s.api.laundry.view()).freeBagLeft).toBe(false)
  })

  it('cannot be cancelled once collected', async () => {
    const s = setup()
    s.at('2027-03-22', '10:00')
    const pick = (await s.api.laundry.view()).pickups.washFold[0]
    const v = await s.api.laundry.request({ service: 'washFold', qty: 1, pickupAt: pick.at, note: '' })
    s.at(pick.date, '23:00')
    expect(await code(s.api.laundry.cancel(v.requests[0].id))).toBe('conflict:tooLate')
  })
})

describe('Wi-Fi', () => {
  it('gives the included devices free for the cruise and charges the rest', async () => {
    const s = setup('daniel')
    s.at('2027-03-22', '10:00')
    expect((await s.api.wifi.view()).includedLeft).toBe(1)
    const a = await s.api.wifi.add({ name: 'Daniel’s phone', plan: 'messaging', days: 2 })
    expect(a.devices[0]).toMatchObject({ included: true, plan: 'surf', paid: 0, capMb: 3000 })
    expect(a.includedLeft).toBe(0)
    const b = await s.api.wifi.add({ name: 'Tablet', plan: 'messaging', days: 3 })
    expect(b.devices[1]).toMatchObject({ included: false, paid: 2997, capMb: 500 })
    expect(await code(s.api.wifi.add({ name: 'tablet', plan: 'surf', days: 1 }))).toBe('invalid:duplicate')
    const lines = (await s.api.onboard.folio()).lines.filter((l) => l.id.startsWith('wifi-'))
    expect(lines.map((l) => l.cents).sort()).toEqual([0, 2997])
    expect(lines.find((l) => l.cents === 0)).toMatchObject({ coveredBy: 'package' })
  })

  it('upgrades for the days left, shows usage growing, and removes a device', async () => {
    const s = setup('maria')
    s.at('2027-03-22', '10:00')
    expect((await s.api.wifi.view()).includedLeft).toBe(0)
    const v = await s.api.wifi.add({ name: 'Phone', plan: 'messaging', days: 3 })
    const id = v.devices[0].id
    s.later(120)
    expect((await s.api.wifi.view()).devices[0].usedMb).toBeGreaterThan(0)
    expect(await code(s.api.wifi.upgrade(id, 'messaging'))).toBe('invalid:notAnUpgrade')
    const up = await s.api.wifi.upgrade(id, 'surf')
    expect(up.devices[0]).toMatchObject({ plan: 'surf', paid: 2997 + 1000 * 3 })
    s.later(4 * 24 * 60)
    expect((await s.api.wifi.view()).devices[0].expired).toBe(true)
    expect(await code(s.api.wifi.upgrade(id, 'stream'))).toBe('invalid:expired')
    expect((await s.api.wifi.remove(id)).devices).toEqual([])
  })

  it('only sells aboard, and not to a supervised account', async () => {
    const s = setup('maria')
    expect(await code(s.api.wifi.add({ name: 'Phone', plan: 'surf', days: 1 }))).toBe('conflict:closed')
    s.at('2027-03-22', '10:00')
    s.as('ethan')
    expect((await s.api.wifi.view()).canBuy).toBe(false)
    expect(await code(s.api.wifi.add({ name: 'Phone', plan: 'surf', days: 1 }))).toBe('forbidden:This account is supervised')
  })
})
