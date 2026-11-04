import { afterEach, describe, expect, it } from 'vitest'
import {
  applyCataloguePorts, applyPatterns, applyShips, catalogueShips, cruiseOf, loadItinerary, normalizeCataloguePorts, normalizeEntries, normalizeItinerary,
  normalizePatterns, normalizeShips, setItineraryLoader, setSailingEntries, shipOf,
} from './shipCatalogue'
import { CATALOGUE_PORTS, itinerary, portAt, portById, setSailingDays, shipClockChanges, shipHomeZone, shipZoneAt, shipZoneOnDate, type Sailing } from './sailings'
import { zonedToEpoch } from './timezones'

const ship = (over: object = {}) => ({ id: 'sky-princess', name: 'Sky Princess', class: 'Royal class', depth: 'browse', decks: 19, tonnage: 145281, capacity: 3660, lengthFt: 1080, crew: 1346, staterooms: 1830, entered: 2019, homeZone: 'America/New_York', intro: 'A Royal-class ship.', profile: { highlights: [{ title: 'SeaWalk', body: 'A glass-bottomed walkway.' }] }, ...over })
const entry = (over: object = {}) => ({ id: 'sky-2027-03-01-10', ship: 'sky-princess', departure: '2027-03-01', nights: 10, title: 'Sky Princess: Western Mediterranean', region: 'mediterranean', startPort: 'barcelona', endPort: 'rome', legs: [{ leg: 1, pattern: 'med-west', startDay: 1 }], holiday: false, bookingOpen: false, dataStatus: 'sample', fromCents: 99_000, ...over })
const day = (n: number, port: string, extra: object = {}) => ({ day: n, date: `2027-03-${String(n).padStart(2, '0')}`, port, arrive: null, allAboard: null, depart: null, clockChangeHours: null, clockChangeAt: null, dress: null, shipZone: 'Europe/Madrid', ...extra })
const itineraryWire = (sailing = 'sky-2027-03-01-10') => ({
  version: 'v1', sailing, ship: 'sky-princess', nights: 4,
  days: [day(1, 'barcelona', { depart: '17:00' }), day(2, 'sea'), day(3, 'athens', { arrive: '08:00', allAboard: '17:00', depart: '18:00', shipZone: 'Europe/Athens' }), day(4, 'sea', { shipZone: 'Europe/Athens' }), day(5, 'athens', { arrive: '06:00', shipZone: 'Europe/Athens' })],
})

describe('normalizeShips', () => {
  it('reads facts and the highlights in the profile', () => {
    const got = normalizeShips({ version: 'a', items: [ship()] })!
    expect(got.items[0]).toMatchObject({ id: 'sky-princess', className: 'Royal class', guests: 3660, lengthFt: 1080, depth: 'browse' })
    expect(got.items[0].highlights).toEqual([{ title: 'SeaWalk', body: 'A glass-bottomed walkway.' }])
  })
  it.each([
    ['an unknown depth', { depth: 'full' }],
    ['no name', { name: '' }],
    ['a negative crew', { crew: -1 }],
  ])('rejects %s', (_n, over) => expect(normalizeShips({ version: 'a', items: [ship(over)] })).toBeNull())
  it('rejects a repeated id', () => expect(normalizeShips({ version: 'a', items: [ship(), ship()] })).toBeNull())
  it('rejects a list with no version', () => expect(normalizeShips({ items: [ship()] })).toBeNull())
})

describe('normalizeCataloguePorts and normalizePatterns', () => {
  const port = (over: object = {}) => ({ id: 'santorini', name: 'Santorini, Greece', country: 'Greece', countryCode: 'GR', region: 'eastern-med', zone: 'Europe/Athens', tender: true, lat: 36.4, lon: 25.4, currency: 'EUR', languages: ['el', 'en'], tier: 'A', guideStatus: 'full', artId: null, ...over })
  it('reads any port, keeping the catalogue facts', () => {
    const p = normalizeCataloguePorts({ version: 'a', items: [port()] })!.items[0]
    expect(p).toMatchObject({ id: 'santorini', tender: true, countryCode: 'GR', tier: 'A', languages: ['el', 'en'], lat: 36.4 })
  })
  it('rejects coordinates out of range', () => expect(normalizeCataloguePorts({ version: 'a', items: [port({ lat: 91 })] })).toBeNull())
  const pat = (nights: number, over: object = {}) => ({ id: 'p', name: 'P', region: 'r', nights, startPort: 'a', endPort: 'b', description: '', days: Array.from({ length: nights + 1 }, (_, i) => ({ day: i + 1, port: i === 0 ? 'a' : 'sea', arrive: null, allAboard: null, depart: null })), ...over })
  it('reads patterns of any length', () => {
    expect(normalizePatterns({ version: 'a', items: [pat(3), { ...pat(31), id: 'q' }] })!.items.map((p) => p.days.length)).toEqual([4, 32])
  })
  it('rejects a pattern whose days are not nights + 1', () => expect(normalizePatterns({ version: 'a', items: [pat(5, { nights: 6 })] })).toBeNull())
})

describe('normalizeEntries', () => {
  it('reads sailings of any ship and length', () => {
    const list = normalizeEntries([entry(), entry({ id: 'sap-2027-04-01-31', ship: 'sapphire-princess', nights: 31, fromCents: null })])
    expect(list.map((e) => [e.id, e.nights, e.fromCents])).toEqual([['sky-2027-03-01-10', 10, 99_000], ['sap-2027-04-01-31', 31, undefined]])
  })
  it('drops a bad entry and a repeat, and reads no list as empty', () => {
    expect(normalizeEntries([entry(), entry({ departure: 'soon' }), entry()]).length).toBe(1)
    expect(normalizeEntries(undefined)).toEqual([])
  })
})

describe('normalizeItinerary', () => {
  it('reads the days with the ship zone of each', () => {
    const got = normalizeItinerary(itineraryWire(), 'sky-2027-03-01-10')!
    expect(got.days).toHaveLength(5)
    expect(got.days[2]).toEqual({ day: 3, date: '2027-03-03', port: 'athens', arrive: '08:00', allAboard: '17:00', depart: '18:00', zone: 'Europe/Athens' })
  })
  it('refuses an answer for another sailing, days out of order or a bad time', () => {
    expect(normalizeItinerary(itineraryWire('other'), 'sky-2027-03-01-10')).toBeNull()
    const w = itineraryWire(); w.days[1].day = 4
    expect(normalizeItinerary(w, 'sky-2027-03-01-10')).toBeNull()
    const t = itineraryWire() as { days: { arrive: string | null }[] }; t.days[2].arrive = '8am'
    expect(normalizeItinerary(t, 'sky-2027-03-01-10')).toBeNull()
  })
})

describe('shipOf and cruiseOf', () => {
  afterEach(() => {
    setSailingEntries([])
    applyShips({ version: 'x', items: [] })
    applyPatterns({ version: 'x', items: [] })
    applyCataloguePorts({ version: 'x', items: [] })
  })

  it('answer with an empty summary before the catalogue arrives', () => {
    expect(shipOf('anything').name).toBe('')
    expect(cruiseOf('anything')).toEqual({ id: 'anything', name: '', nights: 0, homePort: '', intro: '' })
  })

  it('answer for the ship and legs of any sailing', () => {
    applyShips(normalizeShips({ version: 'a', items: [ship(), ship({ id: 'sun-princess', name: 'Sun Princess', depth: 'aboard' })] })!)
    applyPatterns(normalizePatterns({ version: 'a', items: [{ id: 'med-west', name: 'Western Med', region: 'mediterranean', nights: 1, startPort: 'barcelona', endPort: 'rome', description: 'Barcelona to Rome.', days: [{ day: 1, port: 'barcelona', arrive: null, allAboard: null, depart: '17:00' }, { day: 2, port: 'rome', arrive: '07:00', allAboard: null, depart: null }] }] })!)
    applyCataloguePorts(normalizeCataloguePorts({ version: 'a', items: [{ id: 'barcelona', name: 'Barcelona, Spain', zone: 'Europe/Madrid', tender: false }] })!)
    setSailingEntries(normalizeEntries([entry(), entry({ id: 'sun-2027-03-21', ship: 'sun-princess', nights: 7, legs: [{ leg: 1, pattern: 'carib-west-a', startDay: 1 }] })]))
    expect(catalogueShips().map((s) => s.id)).toEqual(['sky-princess', 'sun-princess'])
    expect(shipOf('sky-2027-03-01-10').name).toBe('Sky Princess')
    expect(cruiseOf('sky-2027-03-01-10')).toMatchObject({ name: 'Sky Princess: Western Mediterranean', nights: 10, homePort: 'Barcelona, Spain', intro: 'Barcelona to Rome.', region: 'mediterranean' })
    expect(cruiseOf('sun-2027-03-21')).toMatchObject({ nights: 7, id: 'sun-2027-03-21' })
    expect(portById('barcelona')?.zone).toBe('Europe/Madrid')
  })
})

describe('loadItinerary', () => {
  const s: Sailing = { id: 'sky-2027-03-01-10', departure: '2027-03-01' }
  afterEach(() => setItineraryLoader(null))

  it('loads once, shares a second ask, and puts the days in use', async () => {
    let calls = 0
    setItineraryLoader(async () => { calls++; return itineraryWire() })
    const [a, b] = await Promise.all([loadItinerary(s.id), loadItinerary(s.id)])
    expect([a, b, calls]).toEqual([true, true, 1])
    expect(itinerary(s)).toHaveLength(5)
    expect(await loadItinerary(s.id)).toBe(true)
    expect(calls).toBe(1)
  })

  it('is false when there is no loader, the fetch fails or the answer is not usable', async () => {
    expect(await loadItinerary('nobody')).toBe(false)
    setItineraryLoader(async () => { throw new Error('offline') })
    expect(await loadItinerary('nobody')).toBe(false)
    setItineraryLoader(async () => ({ nonsense: true }))
    expect(await loadItinerary('nobody')).toBe(false)
  })
})

describe('the ship clock from the days', () => {
  // A 31-night sailing with two clock changes at 02:00 ship time: home zone New York, Atlantic crossing east, then back to Lisbon time.
  const s: Sailing = { id: 'long-2027-03-01', departure: '2027-03-01' }
  const days = Array.from({ length: 32 }, (_, i) => {
    const d = new Date(Date.UTC(2027, 2, 1 + i))
    const zone = i < 5 ? 'America/New_York' : i < 20 ? 'Europe/London' : 'Europe/Lisbon'
    return { day: i + 1, date: d.toISOString().slice(0, 10), port: i === 0 ? 'new-york' : i === 31 ? 'lisbon' : 'sea', zone }
  })
  it('takes the home zone from the first day and the changes from the days', () => {
    expect(setSailingDays(s.id, days)).toBe(true)
    expect(shipHomeZone(s)).toBe('America/New_York')
    const changes = shipClockChanges(s)
    expect(changes.map((c) => [c.fromZone, c.toZone])).toEqual([['America/New_York', 'Europe/London'], ['Europe/London', 'Europe/Lisbon']])
    expect(changes[0].hours).toBe(5)
    expect(changes[1].hours).toBe(0)
  })
  it('follows the zone at a moment and on a date', () => {
    expect(shipZoneOnDate(s, '2027-03-05')).toBe('America/New_York')
    expect(shipZoneOnDate(s, '2027-03-06')).toBe('Europe/London')
    expect(shipZoneOnDate(s, '2027-03-31')).toBe('Europe/Lisbon')
    expect(shipZoneAt(s, zonedToEpoch('2027-03-06', '01:00', 'America/New_York'))).toBe('America/New_York')
    expect(shipZoneAt(s, zonedToEpoch('2027-03-06', '03:00', 'America/New_York'))).toBe('Europe/London')
  })
  it('is at sea on a sea day and not before the first day', () => {
    expect(portAt(s, zonedToEpoch('2027-03-10', '12:00', 'Europe/London'))).toEqual({ port: 'sea', day: 10 })
    expect(portAt(s, zonedToEpoch('2027-02-20', '12:00', 'America/New_York')).day).toBeNull()
  })
  it('refuses days that are too few or out of order', () => {
    expect(setSailingDays('x', days.slice(0, 1))).toBe(false)
    expect(setSailingDays('x', [days[1], days[0]])).toBe(false)
  })
  afterEach(() => { for (const id of Object.keys(CATALOGUE_PORTS)) delete CATALOGUE_PORTS[id] })
})
