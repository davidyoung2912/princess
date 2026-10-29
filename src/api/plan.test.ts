import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { clockAt } from '../domain/clock'
import { defaultDemoState, type DemoState } from '../demo/state'
import type { PaymentPart } from '../domain/fares'
import { personaById, type PersonaId } from '../domain/personas'
import { zonedToEpoch } from '../domain/timezones'
import { isApiError } from './errors'
import { createMockApi } from './mock'

const REAL = Date.UTC(2026, 9, 29, 16)
const at = (date: string) => zonedToEpoch(date, '10:00', 'America/New_York')

/** The demo starts 14 days before the 21 March 2027 sailing. */
function setup(as: PersonaId = 'gerald') {
  let who: PersonaId | null = as
  const demo: DemoState = defaultDemoState(REAL)
  const store = createMemoryStore()
  let tick = REAL
  const api = createMockApi({ store, demo: () => demo, persona: () => who, realNow: () => (tick += 1000), sleep: async () => {} })
  return { api, as: (p: PersonaId) => { who = p }, moveClock: (date: string) => { demo.clock = clockAt(at(date), REAL, 0) } }
}
const code = async (p: Promise<unknown>) => { try { await p } catch (e) { return isApiError(e) ? `${e.code}:${e.message}` : 'other' } return null }
const card = (cents: number): PaymentPart => ({ method: 'card', cardId: 'card-default', cents })

describe('excursions', () => {
  it('lists every tour with its day, places left and return time', async () => {
    const { api } = setup()
    const v = await api.plan.excursions.list()
    expect(v.offers).toHaveLength(12)
    const snorkel = v.offers.find((o) => o.item.id === 'coz-snorkel')!
    expect(snorkel).toMatchObject({ day: 3, date: '2027-03-23', backBy: '15:45', tender: false, timing: null, daysToTour: 16 })
    expect(v.offers.find((o) => o.item.id === 'bze-cave')!.tender).toBe(true)
    expect(v.offers.find((o) => o.item.id === 'rtb-zip')!.spots).toBe(0)
    expect(v.canBook).toBe(true)
    expect(v.creditLeft).toBe(0)
  })

  it('books through a cart, refuses clashes, sold-out tours and duplicates, and charges once', async () => {
    const { api } = setup()
    expect(await code(api.plan.excursions.addToCart('rtb-zip', ['gerald']))).toBe('conflict:soldOut')
    expect(await code(api.plan.excursions.addToCart('nope', ['gerald']))).toBe('invalid:Unknown tour')
    expect(await code(api.plan.excursions.addToCart('coz-snorkel', ['maria']))).toBe('invalid:Choose who is going from your booking')
    let v = await api.plan.excursions.addToCart('coz-snorkel', ['gerald'])
    expect(v.cart).toEqual([{ excursionId: 'coz-snorkel', guests: ['gerald'], total: 7900 }])
    expect(await code(api.plan.excursions.addToCart('coz-ruins', ['gerald']))).toBe('conflict:overlap')
    v = await api.plan.excursions.addToCart('coz-glass', ['gerald'])
    expect(v.cartTotal).toBe(7900 + 4900)
    expect(await code(api.plan.excursions.checkout([card(1)]))).toBe('invalid:The amounts do not add up to what is due')
    v = await api.plan.excursions.checkout([card(12800)])
    expect(v.cart).toEqual([])
    expect(v.booked.map((b) => [b.excursionId, b.total, b.status])).toEqual([['coz-snorkel', 7900, 'booked'], ['coz-glass', 4900, 'booked']])
    expect(v.booked[0].methods).toEqual(['Visa ending 4242'])
    expect(await code(api.plan.excursions.addToCart('coz-snorkel', ['gerald']))).toBe('conflict:duplicate')
    expect(await code(api.plan.excursions.checkout([card(100)]))).toBe('invalid:The cart is empty')
  })

  it('keeps a cart between visits and lets a tour be removed from it', async () => {
    const { api } = setup()
    await api.plan.excursions.addToCart('bze-walk', ['gerald'])
    expect((await api.plan.excursions.list()).cart).toHaveLength(1)
    expect((await api.plan.excursions.removeFromCart('bze-walk')).cart).toEqual([])
  })

  it('asks for the bank’s code on a new card and refuses a declined card', async () => {
    const { api } = setup()
    await api.payments.addCard('visa', '1111', '12/29')
    const cards = await api.payments.addCard('visa', '0002', '12/29')
    await api.plan.excursions.addToCart('bze-walk', ['gerald'])
    const fresh = { method: 'card', cardId: cards[cards.length - 2].id, cents: 4500 } as const
    const declined = { method: 'card', cardId: cards[cards.length - 1].id, cents: 4500 } as const
    expect(await code(api.plan.excursions.checkout([fresh]))).toBe('challenge:required')
    expect(await code(api.plan.excursions.checkout([fresh], '000000'))).toBe('challenge:wrong')
    expect(await code(api.plan.excursions.checkout([declined]))).toBe('declined:Visa ending 0002')
    expect((await api.plan.excursions.list()).booked).toEqual([])
    expect((await api.plan.excursions.checkout([fresh], '123456')).booked).toHaveLength(1)
  })

  it('uses the Premier excursion credit first, and pays only the rest', async () => {
    const { api } = setup('alexander')
    expect((await api.plan.excursions.list()).creditLeft).toBe(10_000)
    await api.plan.excursions.addToCart('coz-glass', ['alexander'])
    let v = await api.plan.excursions.checkout([])
    expect(v.booked[0]).toMatchObject({ total: 4900, credit: 4900, methods: [] })
    expect(v.creditLeft).toBe(5100)
    await api.plan.excursions.addToCart('bze-reef', ['alexander'])
    expect((await api.plan.excursions.list()).creditApplied).toBe(5100)
    expect(await code(api.plan.excursions.checkout([card(9900)]))).toBe('invalid:The amounts do not add up to what is due')
    v = await api.plan.excursions.checkout([card(4800)])
    expect(v.creditLeft).toBe(0)
    expect(v.booked[1]).toMatchObject({ total: 9900, credit: 5100 })
  })

  it('refunds a cancelled tour to the card first and then to the credit, and a late cancel keeps the fee', async () => {
    const { api, moveClock } = setup('alexander')
    await api.plan.excursions.addToCart('bze-reef', ['alexander'])
    let v = await api.plan.excursions.checkout([])
    expect(v.booked[0]).toMatchObject({ credit: 9900, total: 9900 })
    expect(v.creditLeft).toBe(100)
    const id = v.booked[0].id
    expect(v.booked[0].cancel).toEqual({ fee: 0, refund: 9900, free: true })
    v = await api.plan.excursions.cancel(id)
    expect(v.booked[0]).toMatchObject({ status: 'cancelled', cancel: { fee: 0, refund: 9900, free: true } })
    expect(v.creditLeft).toBe(10_000)
    expect(await code(api.plan.excursions.cancel(id))).toBe('notFound:notFound')
    await api.plan.excursions.addToCart('coz-glass', ['alexander'])
    v = await api.plan.excursions.checkout([])
    moveClock('2027-03-22')
    const late = (await api.plan.excursions.list()).booked.find((b) => b.status === 'booked')!
    expect(late.cancel).toEqual({ fee: 4900, refund: 0, free: false })
    v = await api.plan.excursions.cancel(late.id)
    expect(v.creditLeft).toBe(5100)
  })

  it('lets guests come off a tour, with a refund for those who leave', async () => {
    const { api } = setup('daniel')
    await api.plan.excursions.addToCart('coz-beach', ['daniel', 'priya', 'maya'])
    let v = await api.plan.excursions.checkout([card(5900 + 5900 + 4100)])
    const b = v.booked[0]
    expect(b.total).toBe(5900 + 5900 + 4100)
    expect(await code(api.plan.excursions.changeGuests(b.id, ['maria']))).toBe('invalid:Choose who is going from your booking')
    expect(await code(api.plan.excursions.changeGuests(b.id, ['maya']))).toBe('conflict:age')
    v = await api.plan.excursions.changeGuests(b.id, ['daniel', 'maya'])
    expect(v.booked[0]).toMatchObject({ guests: ['daniel', 'maya'], total: 5900 + 4100 })
  })

  it('keeps a child off a demanding tour, and children without an adult off any tour', async () => {
    const { api } = setup('daniel')
    expect(await code(api.plan.excursions.addToCart('bze-cave', ['maya']))).toBe('conflict:age')
    expect(await code(api.plan.excursions.addToCart('coz-glass', ['ethan']))).toBe('conflict:age')
    expect(await code(api.plan.excursions.addToCart('bze-cave', ['daniel', 'ethan']))).toBeNull()
  })

  it('is read-only for a supervised child, and closes once the ship has sailed', async () => {
    const { api, as, moveClock } = setup('daniel')
    as('ethan')
    expect((await api.plan.excursions.list()).canBook).toBe(false)
    expect(await code(api.plan.excursions.addToCart('coz-glass', ['ethan']))).toBe('forbidden:This account is supervised')
    as('daniel')
    moveClock('2027-03-22')
    expect(await code(api.plan.excursions.addToCart('coz-glass', ['daniel']))).toBe('conflict:closed')
  })
})

describe('dining reservations', () => {
  const free = async (api: ReturnType<typeof setup>['api'], venue: string, day: number) => (await api.plan.dining.slots(venue, day)).find((s) => s.tables > 0)!.time

  it('shows an assigned time for fixed seating and none for Anytime Dining', async () => {
    const { api, as } = setup('gerald')
    expect(await api.plan.dining.view()).toMatchObject({ plan: 'early', seating: '17:00', window: { open: true } })
    as('alexander')
    expect(await api.plan.dining.view()).toMatchObject({ plan: 'anytime', seating: null })
  })

  it('explains that a guest who has not paid in full cannot reserve yet, and when it opens', async () => {
    const { api, as } = setup('maria')
    const v = await api.plan.dining.view()
    expect(v.window).toEqual({ open: false, reason: 'awaitingPayment', opensOn: '2027-03-11' })
    const time = await free(api, 'crown', 3)
    expect(await code(api.plan.dining.reserve({ venueId: 'crown', day: 3, time, guests: ['maria'], note: '' }))).toBe('conflict:notOpen')
    await api.payments.payBalance('card-default')
    expect((await api.plan.dining.view()).window.open).toBe(true)
    as('maria')
    expect(await code(api.plan.dining.reserve({ venueId: 'crown', day: 3, time, guests: ['maria'], note: '' }))).toBeNull()
  })

  it('reserves, passes on dietary needs, charges the cover and refuses clashes and full tables', async () => {
    const { api } = setup('daniel')
    const time = await free(api, 'sabatini', 4)
    const v = await api.plan.dining.reserve({ venueId: 'sabatini', day: 4, time, guests: ['daniel', 'priya', 'maya'], note: ' Window seat, please ' })
    const r = v.reservations[0]
    expect(r).toMatchObject({ venueId: 'sabatini', day: 4, time, note: 'Window seat, please', reminderOn: '2027-03-23' })
    expect(r.dietary).toEqual([{ name: 'Priya', needs: ['vegetarian'] }, { name: 'Maya', needs: ['nutAllergy'] }])
    expect(r.covered).toEqual(['daniel', 'priya'])
    expect(r.charge).toBe(4200)
    expect(v.mealsLeft).toBe(2)
    expect(await code(api.plan.dining.reserve({ venueId: 'crown', day: 4, time, guests: ['daniel'], note: '' }))).toBe('conflict:clash')
    expect(await code(api.plan.dining.reserve({ venueId: 'crown', day: 4, time: '25:00', guests: ['daniel'], note: '' }))).toBe('invalid:Choose a restaurant, a night and a time')
    expect(await code(api.plan.dining.reserve({ venueId: 'alfredo', day: 4, time, guests: ['daniel'], note: '' }))).toBe('invalid:Choose a restaurant, a night and a time')
    expect(await code(api.plan.dining.reserve({ venueId: 'crown', day: 5, time, guests: ['maya'], note: '' }))).toBe('conflict:age')
    const full = (await api.plan.dining.slots('crown', 3)).find((s) => s.tables === 0)
    if (full) expect(await code(api.plan.dining.reserve({ venueId: 'crown', day: 3, time: full.time, guests: ['daniel'], note: '' }))).toBe('conflict:full')
  })

  it('does not offer the main room to a fixed-seating guest, and cancels', async () => {
    const { api } = setup('gerald')
    const time = await free(api, 'eclipse', 2)
    expect(await code(api.plan.dining.reserve({ venueId: 'eclipse', day: 2, time, guests: ['gerald'], note: '' }))).toBe('conflict:fixedSeating')
    const v = await api.plan.dining.reserve({ venueId: 'crown', day: 2, time: await free(api, 'crown', 2), guests: ['gerald'], note: '' })
    expect(v.reservations[0].charge).toBe(4500)
    expect((await api.plan.dining.cancel(v.reservations[0].id)).reservations).toEqual([])
    expect(await code(api.plan.dining.cancel('nope'))).toBe('notFound:notFound')
  })

  it('uses package meals first, per person', async () => {
    const { api } = setup('alexander')
    const view = await api.plan.dining.view()
    expect(view.mealsLeft).toBe(4)
    const v = await api.plan.dining.reserve({ venueId: 'catch', day: 2, time: await free(api, 'catch', 2), guests: ['alexander'], note: '' })
    expect(v.reservations[0]).toMatchObject({ covered: ['alexander'], charge: 0 })
    expect(v.mealsLeft).toBe(3)
    const folio = await api.folio.entitlements()
    expect(folio.balances.specialtyMeals).toEqual({ total: 4, used: 1, remaining: 3 })
  })
})

describe('packages and price protection', () => {
  it('shows a price held from before a rise as locked', async () => {
    const { api } = setup('marcus')
    const v = await api.plan.packages.view()
    const seeded = v.purchases.find((p) => p.id === 'seed-drinks')!
    expect(seeded).toMatchObject({ unit: 5200, units: 14, total: 5200 * 14, guests: ['marcus', 'elena'] })
    expect(seeded.price).toEqual({ state: 'locked', perUnit: 700, total: 700 * 14 })
    expect(v.addOns.find((a) => a.id === 'drinks')).toMatchObject({ price: 5900, base: 5200, changesTo: 5900 })
    expect(v.addOns.find((a) => a.id === 'drinks')!.eligible).toEqual([])
  })

  it('offers a price-drop credit once, and not before the drop', async () => {
    const { api, moveClock } = setup('gerald')
    let v = await api.plan.packages.view()
    expect(v.purchases[0].price.state).toBe('same')
    expect(await code(api.plan.packages.claimDrop('seed-photo'))).toBe('conflict:nothing')
    moveClock('2027-03-14')
    v = await api.plan.packages.view()
    expect(v.purchases[0].price).toEqual({ state: 'dropped', perUnit: 3000, total: 3000 })
    v = await api.plan.packages.claimDrop('seed-photo')
    expect(v.purchases[0].credited).toBe(3000)
    expect(await code(api.plan.packages.claimDrop('seed-photo'))).toBe('conflict:nothing')
  })

  it('buys an add-on for the right people only, once, and charges the current price', async () => {
    const { api } = setup('daniel')
    const before = await api.plan.packages.view()
    expect(before.addOns.find((a) => a.id === 'drinks')!.eligible.map((g) => g.id)).toEqual(['daniel', 'priya'])
    expect(await code(api.plan.packages.buy({ kind: 'addOn', item: 'drinks', guests: ['maya'] }, [card(1)]))).toBe('invalid:Some guests are too young for this')
    expect(await code(api.plan.packages.buy({ kind: 'addOn', item: 'drinks', guests: ['daniel'] }, [card(1)]))).toBe('invalid:The amounts do not add up to what is due')
    const v = await api.plan.packages.buy({ kind: 'addOn', item: 'wifi', guests: ['daniel', 'priya'] }, [card(3000 * 14)])
    expect(v.purchases[0]).toMatchObject({ kind: 'addOn', item: 'wifi', unit: 3000, units: 14 })
    expect(v.people.find((p) => p.id === 'daniel')!.entitlements.wifiDevices).toBe(2)
    expect(await code(api.plan.packages.buy({ kind: 'addOn', item: 'wifi', guests: ['daniel'] }, [card(1)]))).toBe('conflict:held')
  })

  it('changes what a guest gets everywhere when they move up a package', async () => {
    const { api } = setup('maria')
    const v0 = await api.plan.packages.view()
    expect(v0.upgrades[0].options.map((o) => o.to)).toEqual(['plus', 'premier'])
    const price = v0.upgrades[0].options[0].price
    expect((await api.folio.entitlements()).entitlements.specialtyMeals).toBe(0)
    expect(await code(api.plan.packages.buy({ kind: 'upgrade', to: 'plus', guests: ['maria'] }, [card(price + 100)]))).toBe('invalid:The amounts do not add up to what is due')
    const v = await api.plan.packages.buy({ kind: 'upgrade', to: 'plus', guests: ['maria'] }, [card(price)])
    expect(v.people[0]).toMatchObject({ package: 'plus' })
    expect(v.upgrades[0].options.map((o) => o.to)).toEqual(['premier'])
    const folio = await api.folio.entitlements()
    expect(folio.entitlements).toMatchObject({ specialtyMeals: 2, wifiDevices: 1, drinkCapUsd: 15, gratuitiesIncluded: true })
    expect(await code(api.plan.packages.buy({ kind: 'upgrade', to: 'plus', guests: ['maria'] }, [card(price)]))).toBe('invalid:A guest already has this package or better')
  })

  it('cancels for a full refund until three days before sailing, and not after', async () => {
    const { api, moveClock } = setup('maria')
    const v = await api.plan.packages.buy({ kind: 'addOn', item: 'laundry', guests: ['maria'] }, [card(9900)])
    const id = v.purchases[0].id
    expect(v.purchases[0]).toMatchObject({ units: 1, total: 9900, canCancel: true })
    const after = await api.plan.packages.cancel(id)
    expect(after.purchases[0]).toMatchObject({ status: 'cancelled', canCancel: false })
    expect((await api.folio.entitlements()).entitlements.perks).not.toContain('freeLaundry')
    await api.plan.packages.buy({ kind: 'addOn', item: 'laundry', guests: ['maria'] }, [card(9900)])
    moveClock('2027-03-19')
    const id2 = (await api.plan.packages.view()).purchases.find((p) => p.status === 'active')!.id
    expect(await code(api.plan.packages.cancel(id2))).toBe('conflict:locked')
  })

  it('reports the shared excursion credit and per-person balances', async () => {
    const { api } = setup('alexander')
    const v = await api.plan.packages.view()
    expect(v.credit).toEqual({ total: 10_000, used: 0, remaining: 10_000 })
    expect(v.people[0].balances.specialtyMeals.total).toBe(4)
    expect(v.upgrades).toEqual([])
  })
})

describe('checklist and packing', () => {
  it('works out what is done for itself and lets the guest tick the rest', async () => {
    const { api } = setup('gerald')
    let v = await api.plan.checklist.get()
    expect(v.daysToDeparture).toBe(14)
    const state = (id: string) => v.entries.find((e) => e.id === id)!
    expect(state('pay')).toMatchObject({ state: 'done', automatic: true })
    expect(state('tours').state).toBe('overdue')
    expect(state('names').state).toBe('overdue')
    v = await api.plan.checklist.tick('names', true)
    expect(v.entries.find((e) => e.id === 'names')!.state).toBe('done')
    expect(await code(api.plan.checklist.tick('pay', true))).toBe('invalid:Unknown item')
    await api.plan.excursions.addToCart('coz-glass', ['gerald'])
    await api.plan.excursions.checkout([card(4900)])
    expect((await api.plan.checklist.get()).entries.find((e) => e.id === 'tours')!.state).toBe('done')
    v = await api.plan.checklist.tick('names', false)
    expect(v.entries.find((e) => e.id === 'names')!.state).toBe('overdue')
  })

  it('builds a packing list from the trip and remembers what is packed', async () => {
    const { api } = setup('daniel')
    let v = await api.plan.packing.get()
    expect(v.items.map((i) => i.id)).toEqual(expect.arrayContaining(['passport', 'tenderBag', 'games', 'teenClothes']))
    expect(v.items.map((i) => i.id)).not.toContain('waterShoes')
    expect(v.weather.rain).toBe('low')
    await api.plan.excursions.addToCart('coz-snorkel', ['daniel'])
    await api.plan.excursions.checkout([card(7900)])
    v = await api.plan.packing.tick('passport', true)
    expect(v.ticked).toEqual(['passport'])
    expect(v.items.map((i) => i.id)).toContain('waterShoes')
    expect(await code(api.plan.packing.tick('nonsense', true))).toBe('invalid:Unknown item')
    expect((await api.plan.packing.tick('passport', false)).ticked).toEqual([])
  })
})

describe('travel and assistance', () => {
  it('saves an arrival window, checking priority windows', async () => {
    const { api, as } = setup('maria')
    const v0 = await api.plan.travel.get()
    expect(v0).toMatchObject({ priority: false, suggested: '11:00', plan: { window: null, mode: null } })
    expect(await code(api.plan.travel.save({ window: '10:30', mode: null, hotel: null }))).toBe('invalid:Check your choices')
    const v = await api.plan.travel.save({ window: '12:00', mode: 'transfer', hotel: 'seabreeze' })
    expect(v.plan).toEqual({ window: '12:00', mode: 'transfer', hotel: 'seabreeze' })
    expect((await api.plan.checklist.get()).entries.find((e) => e.id === 'travel')!.state).toBe('done')
    as('alexander')
    expect(await api.plan.travel.get()).toMatchObject({ priority: true, suggested: '10:30' })
    expect((await api.plan.travel.save({ window: '10:30', mode: null, hotel: null })).plan.window).toBe('10:30')
  })

  it('records a request in the guest’s profile, tracks its cut-off and confirms it a day later', async () => {
    const { api, moveClock } = setup('linda')
    const v = await api.plan.assistance.get()
    expect(v.canRequest).toBe(true)
    expect(v.needs.linda).toEqual(['mobility'])
    expect(v.deadlines.find((d) => d.kind === 'wheelchair')!.deadline).toMatchObject({ by: '2027-02-19', state: 'late' })
    expect(v.deadlines.find((d) => d.kind === 'tender')!.deadline).toMatchObject({ by: '2027-03-14', state: 'soon' })
    expect(await code(api.plan.assistance.request({ kind: 'oxygen', guest: 'linda', note: '' }))).toBe('invalid:Add a note')
    expect(await code(api.plan.assistance.request({ kind: 'cpap', guest: 'gerald', note: '' }))).toBe('invalid:Choose who it is for')
    let after = await api.plan.assistance.request({ kind: 'cpap', guest: 'linda', note: ' Needs a power strip ' })
    expect(after.requests[0]).toMatchObject({ kind: 'cpap', guest: 'linda', note: 'Needs a power strip', status: 'received' })
    expect(after.needs.linda).toEqual(['mobility', 'cpap'])
    expect((await api.account.profile('linda')).profile.needs).toEqual(['mobility', 'cpap'])
    expect(await code(api.plan.assistance.request({ kind: 'cpap', guest: 'linda', note: '' }))).toBe('conflict:duplicate')
    moveClock('2027-03-09')
    expect((await api.plan.assistance.get()).requests[0].status).toBe('confirmed')
    after = await api.plan.assistance.request({ kind: 'wheelchair', guest: 'linda', note: '' })
    expect(after.requests.find((r) => r.kind === 'wheelchair')!.status).toBe('late')
    expect((await api.plan.assistance.cancel(after.requests[0].id)).requests).toHaveLength(1)
    expect(await code(api.plan.assistance.cancel('nope'))).toBe('notFound:notFound')
    expect((await api.plan.checklist.get()).entries.find((e) => e.id === 'assistance')!.state).toBe('done')
  })

  it('keeps requests and plans read-only for a supervised child', async () => {
    const { api, as } = setup('daniel')
    as('ethan')
    expect((await api.plan.assistance.get()).canRequest).toBe(false)
    expect(await code(api.plan.assistance.request({ kind: 'cpap', guest: 'ethan', note: '' }))).toBe('forbidden:This account is supervised')
    expect((await api.plan.travel.get()).canEdit).toBe(false)
    expect(await code(api.plan.travel.save({ window: '11:00', mode: null, hotel: null }))).toBe('forbidden:This account is supervised')
  })
})

describe('the plan overview', () => {
  it('puts what has been booked on the right day', async () => {
    const { api } = setup('alexander')
    await api.plan.excursions.addToCart('coz-glass', ['alexander'])
    await api.plan.excursions.checkout([])
    await api.plan.dining.reserve({ venueId: 'crown', day: 2, time: (await api.plan.dining.slots('crown', 2)).find((s) => s.tables > 0)!.time, guests: ['alexander'], note: '' })
    const o = await api.plan.overview()
    expect(o.days).toHaveLength(8)
    expect(o.days[2].entries.some((e) => e.kind === 'tour' && e.name === 'Glass-bottom boat and town')).toBe(true)
    expect(o.days[1].entries.map((e) => e.kind)).toEqual(['dinner'])
    expect(o.days[3].gaps).toContain('tour')
    expect(personaById('alexander')!.package).toBe('premier')
  })
})
