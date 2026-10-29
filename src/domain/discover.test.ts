import { describe, expect, it } from 'vitest'
import { createMockApi } from '../api/mock'
import { isApiError } from '../api/errors'
import { createMemoryStore } from '../data/store'
import { clockAt } from './clock'
import { defaultDemoState } from '../demo/state'
import { formatDate, formatTime, routePoints, ROUTE, sailingRange, stops } from './cruise'
import { favouriteKey, favouritePath, isSavable, parseFavouriteKey, shareUrl, toggleKey } from './favourites'
import { PORT_GUIDES, portGuideById } from './ports'
import { ALL_CATEGORY_IDS, formatMoney, fromPrice, lowestFromPrice, MAX_GUESTS, quote, TAXES_AND_FEES } from './pricing'
import { itinerary, PORTS, REFERENCE_SAILING, SAILINGS } from './sailings'
import { CATEGORIES, categoryById, OTHER_SHIPS, SHIP } from './ship'

describe('pricing', () => {
  it('has a price for every sailing and room type', () => {
    for (const s of SAILINGS) for (const c of ALL_CATEGORY_IDS) expect(quote(s.id, c, 2), `${s.id} ${c}`).not.toBeNull()
  })

  it('advertises the lowest interior fare as the "from" price', () => {
    const low = lowestFromPrice()
    expect(low.fare).toBe(153_900)
    for (const s of SAILINGS) expect(fromPrice(s.id)!.fare).toBeGreaterThanOrEqual(low.fare)
  })

  it('prices a higher room type above a lower one on the same sailing', () => {
    const totals = CATEGORIES.map((c) => quote(REFERENCE_SAILING.id, c.id, 2)!.total)
    expect([...totals].sort((a, b) => a - b)).toEqual(totals)
  })

  it('costs the holiday sailing more than a plain November one', () => {
    expect(fromPrice('sun-2026-12-27')!.fare).toBeGreaterThan(fromPrice('sun-2026-11-08')!.fare)
  })

  it('shows every charge as a line that adds up to the total, with taxes and gratuities visible', () => {
    for (const guests of [1, 2, 3, 4]) {
      const q = quote(REFERENCE_SAILING.id, 'balcony', guests)!
      expect(q.lines.reduce((sum, l) => sum + l.cents, 0)).toBe(q.total)
      expect(q.lines.find((l) => l.key === 'taxes')!.cents).toBe(TAXES_AND_FEES * guests)
      expect(q.lines.find((l) => l.key === 'gratuities')!.cents).toBe(q.gratuities)
      expect(q.perPerson).toBe(Math.round(q.total / guests))
    }
  })

  it('charges a solo supplement for one guest and a reduced fare for the third and fourth', () => {
    const solo = quote(REFERENCE_SAILING.id, 'interior', 1)!
    expect(solo.lines.map((l) => l.key)).toEqual(['fare', 'soloSupplement', 'taxes', 'gratuities'])
    const four = quote(REFERENCE_SAILING.id, 'interior', 4)!
    const fare = four.lines.find((l) => l.key === 'fare')!
    const extra = four.lines.find((l) => l.key === 'extraFare')!
    expect(extra.guests).toBe(2)
    expect(extra.cents).toBeLessThan(fare.cents)
    expect(quote(REFERENCE_SAILING.id, 'interior', 2)!.lines.some((l) => l.key === 'extraFare')).toBe(false)
  })

  it('charges the higher gratuity in suites and refuses what it cannot price', () => {
    const perNight = (id: 'balcony' | 'miniSuite') => quote(REFERENCE_SAILING.id, id, 2)!.gratuities
    expect(perNight('miniSuite')).toBeGreaterThan(perNight('balcony'))
    expect(quote('sun-2020-01-01', 'interior', 2)).toBeNull()
    expect(quote(REFERENCE_SAILING.id, 'nope' as never, 2)).toBeNull()
    for (const guests of [0, MAX_GUESTS + 1, 1.5, NaN]) expect(quote(REFERENCE_SAILING.id, 'interior', guests)).toBeNull()
  })

  it('formats whole dollars plainly and part dollars with cents', () => {
    expect(formatMoney(153_900)).toBe('$1,539')
    expect(formatMoney(11_550)).toBe('$115.50')
  })
})

describe('cruise content', () => {
  it('lists the eight days with place names and tender flags', () => {
    const list = stops(REFERENCE_SAILING)
    expect(list).toHaveLength(8)
    expect(list.find((s) => s.port === 'belize')).toMatchObject({ place: PORTS.belize.name, tender: true })
    expect(list.filter((s) => s.port === 'sea').every((s) => s.place === 'At sea')).toBe(true)
    expect(list.filter((s) => s.tender)).toHaveLength(1)
  })

  it('formats dates and times in plain words', () => {
    expect(formatDate('2027-03-21')).toBe('Sun, Mar 21, 2027')
    expect(sailingRange(REFERENCE_SAILING)).toBe('Mar 21 to Mar 28, 2027')
    expect(formatTime('07:00')).toBe('7:00 AM')
    expect(formatTime('16:30')).toBe('4:30 PM')
    expect(formatTime('00:05')).toBe('12:05 AM')
    expect(formatTime('12:00')).toBe('12:00 PM')
  })

  it('has a guide for every port the itinerary visits, matching its landing type', () => {
    for (const day of itinerary(REFERENCE_SAILING)) {
      if (day.port === 'sea') continue
      const guide = portGuideById(day.port)!
      expect(guide, day.port).toBeDefined()
      expect(guide.landing === 'tender').toBe(PORTS[day.port].tender)
      expect(guide.access.length).toBeGreaterThan(20)
    }
    expect(portGuideById('mars')).toBeUndefined()
    expect(portGuideById(undefined)).toBeUndefined()
    for (const g of Object.values(PORT_GUIDES)) for (const e of g.excursions) expect(e.price).toBeGreaterThan(0)
  })

  it('places the route sketch inside its canvas, north above south and west left of east', () => {
    const pts = routePoints(300, 220)
    for (const id of ROUTE) {
      expect(pts[id].x).toBeGreaterThanOrEqual(0)
      expect(pts[id].x).toBeLessThanOrEqual(300)
      expect(pts[id].y).toBeGreaterThanOrEqual(0)
      expect(pts[id].y).toBeLessThanOrEqual(220)
    }
    expect(pts.fll.y).toBeLessThan(pts.roatan.y)
    expect(pts.fll.x).toBeGreaterThan(pts.cozumel.x)
  })

  it('describes the ship from the profile, with a teaser of other ships that are not bookable', () => {
    expect(SHIP.guests).toBe(4300)
    expect(SHIP.accessibleStaterooms).toBe(51)
    expect(OTHER_SHIPS.length).toBeGreaterThan(0)
    expect(categoryById('balcony')!.code).toBe('BF')
    expect(categoryById('x')).toBeUndefined()
    expect(new Set(CATEGORIES.map((c) => c.code)).size).toBe(CATEGORIES.length)
  })
})

describe('favourites', () => {
  it('builds and reads keys', () => {
    expect(favouriteKey('port', 'cozumel')).toBe('port:cozumel')
    expect(parseFavouriteKey('port:cozumel')).toEqual({ kind: 'port', id: 'cozumel' })
    for (const bad of ['', 'port', 'port:', ':x', 'boat:x', 7, null]) expect(parseFavouriteKey(bad)).toBeNull()
  })

  it('accepts only things that exist', () => {
    expect(isSavable('sailing:sun-2027-03-21')).toBe(true)
    expect(isSavable('port:roatan')).toBe(true)
    expect(isSavable('ship:sun-princess')).toBe(true)
    for (const bad of ['sailing:sun-2020-01-01', 'port:mars', 'ship:titanic', 'junk']) expect(isSavable(bad)).toBe(false)
  })

  it('toggles in saved order without changing the input', () => {
    const start = ['a']
    expect(toggleKey(start, 'b')).toEqual(['a', 'b'])
    expect(toggleKey(['a', 'b'], 'a')).toEqual(['b'])
    expect(start).toEqual(['a'])
  })

  it('makes a share link that points at the same screen', () => {
    expect(shareUrl('https://x.test', 'sailing', 'sun-2027-03-21')).toBe('https://x.test/home/sailings/sun-2027-03-21')
    expect(favouritePath('port', 'belize')).toBe('/home/ports/belize')
    expect(favouritePath('ship', 'sun-princess')).toBe('/home/ship')
  })
})

describe('discover API', () => {
  const NOW = Date.UTC(2027, 2, 1)
  function setup(who: 'gerald' | 'maria' | null = 'gerald') {
    const demo = { ...defaultDemoState(NOW), clock: clockAt(NOW, NOW, 0) }
    let persona = who
    const api = createMockApi({ store: createMemoryStore(), demo: () => demo, persona: () => persona, realNow: () => NOW, sleep: async () => {} })
    return { api, as: (p: typeof who) => { persona = p } }
  }
  const failure = async (p: Promise<unknown>) => { try { await p } catch (e) { return e } return null }

  it('lists every sailing with its from price, with no sign-in', async () => {
    const { api } = setup(null)
    const offers = await api.discover.offers()
    expect(offers).toHaveLength(SAILINGS.length)
    expect(offers.find((o) => o.holiday)!.id).toBe('sun-2026-12-27')
  })

  it('quotes, and rejects what it cannot price as invalid', async () => {
    const { api } = setup(null)
    expect((await api.discover.quote(REFERENCE_SAILING.id, 'interior', 2)).guests).toBe(2)
    const err = await failure(api.discover.quote('nope', 'interior', 2))
    expect(isApiError(err) && err.code).toBe('invalid')
  })

  it('saves, removes and keeps each person’s list apart', async () => {
    const { api, as } = setup()
    expect(await api.discover.favourites()).toEqual([])
    expect(await api.discover.toggleFavourite('port:cozumel')).toEqual(['port:cozumel'])
    expect(await api.discover.toggleFavourite('ship:sun-princess')).toEqual(['port:cozumel', 'ship:sun-princess'])
    expect(await api.discover.toggleFavourite('port:cozumel')).toEqual(['ship:sun-princess'])
    as('maria')
    expect(await api.discover.favourites()).toEqual([])
    as('gerald')
    expect(await api.discover.favourites()).toEqual(['ship:sun-princess'])
  })

  it('refuses to save something that does not exist, and needs sign-in to save', async () => {
    const { api, as } = setup()
    const err = await failure(api.discover.toggleFavourite('port:mars'))
    expect(isApiError(err) && err.code).toBe('invalid')
    as(null)
    const out = await failure(api.discover.toggleFavourite('port:cozumel'))
    expect(isApiError(out) && out.code).toBe('forbidden')
  })
})
