import { afterEach, describe, expect, it } from 'vitest'
import { bookingQuote, capacityIn } from './fares'
import { budgetSearch, inviteText } from './dream'
import { nightsOf, quote } from './pricing'
import { clearRooms, loadSailingRooms, setRoomLoaders } from './shipRooms'
import { normalizeEntries, pricedSailings, sailingFor, setSailingEntries } from './shipCatalogue'
import { tripCost } from './tripCost'

const SKY = 'sky-2027-05-01'
const entry = (over: Record<string, unknown>) => ({ id: SKY, ship: 'sky-princess', departure: '2027-05-01', nights: 10, title: 'Ten nights', legs: [{ leg: 1, pattern: 'p', startDay: 1 }], holiday: false, bookingOpen: false, dataStatus: 'sample', fromCents: 120_000, ...over })
const rooms = [
  { id: 'sky-interior', name: 'Interior', suite: false, capacity: 4, sizeSqFt: 160, description: '', perNight: 12_000, fare: 120_000 },
  { id: 'sky-suite', name: 'Sky Suite', suite: true, capacity: 3, sizeSqFt: 400, description: '', perNight: 30_000, fare: 300_000 },
]

async function serve(): Promise<void> {
  setSailingEntries(normalizeEntries([entry({}), entry({ id: 'sky-2027-04-01', departure: '2027-04-01', fromCents: undefined })]))
  setRoomLoaders({ sailing: async () => rooms, ship: null })
  await loadSailingRooms(SKY)
}

afterEach(() => { clearRooms(); setSailingEntries([]); setRoomLoaders({ sailing: null, ship: null }) })

describe('prices for a sailing of any ship', () => {
  it('lists only the sailings with fares, soonest first, and finds them by id', async () => {
    await serve()
    expect(pricedSailings().map((e) => e.id)).toEqual([SKY])
    expect(sailingFor(SKY)).toEqual({ id: SKY, departure: '2027-05-01' })
    expect(sailingFor('nope')).toBeUndefined()
  })

  it('takes the length from the catalogue, a week otherwise', async () => {
    await serve()
    expect(nightsOf(SKY)).toBe(10)
    expect(nightsOf('unknown')).toBe(7)
  })

  it('quotes in the ship\'s own room types and nights', async () => {
    await serve()
    const q = quote(SKY, 'sky-interior', 2)!
    expect(q.lines.find((l) => l.key === 'fare')!.cents).toBe(240_000)
    expect(quote(SKY, 'interior', 2)).toBeNull()
    expect(quote(SKY, 'sky-suite', 2)).not.toBeNull()
  })

  it('refuses more guests than the served room sleeps', async () => {
    await serve()
    expect(capacityIn(SKY, 'sky-suite')).toBe(3)
    expect(bookingQuote(SKY, 'sky-suite', 4, 'standard')).toBeNull()
    expect(bookingQuote(SKY, 'sky-suite', 3, 'standard')).not.toBeNull()
  })

  it('works out the whole-trip cost on the sailing\'s own nights', async () => {
    await serve()
    const base = { sailingId: SKY, category: 'sky-interior', guests: 2, adults: 2, daysToDeparture: 200, drinks: true, wifi: false, dinners: 0, excursionIds: [], flights: 0, hotel: 0, other: 0 }
    const ten = tripCost(base)!
    expect(ten.options.length).toBe(3)
    const drinks = ten.options.find((o) => o.fare === 'standard')!.lines.find((l) => l.key === 'drinks')!.cents
    setSailingEntries(normalizeEntries([entry({ nights: 5 })]))
    const five = tripCost(base)!.options.find((o) => o.fare === 'standard')!.lines.find((l) => l.key === 'drinks')!.cents
    expect(drinks).toBe(five * 2)
  })

  it('searches the budget over the rooms it is given', async () => {
    await serve()
    const r = budgetSearch({ id: SKY, departure: '2027-05-01' }, 10_000_000, 2, [{ id: 'sky-interior' }, { id: 'sky-suite' }])
    expect(new Set([...r.fitting, ...r.nearMiss].map((o) => o.category))).toEqual(new Set(['sky-interior', 'sky-suite']))
  })
})

describe('the invitation', () => {
  it('names the ship and route it is given, and no other', () => {
    const text = inviteText({ id: SKY, departure: '2027-05-01' }, 'Sam', '', { ship: 'Sky Princess', nights: 10, from: 'Southampton', title: 'Norwegian fjords' })
    expect(text).toMatch(/Sky Princess, 10 nights, from Southampton, leaving/)
    expect(text).not.toMatch(/Sun Princess|Cozumel/)
    expect(inviteText({ id: SKY, departure: '2027-05-01' }, '', '')).toMatch(/^A friend would like you to come cruising, leaving/)
  })
})
