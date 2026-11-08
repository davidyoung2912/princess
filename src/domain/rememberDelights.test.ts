import { describe, expect, it } from 'vitest'
import { SAILINGS } from './sailings'
import {
  addPostcard, addWant, callPlaces, EMPTY_REMEMBER, lifetime, MAP_MIN_SPAN, mapView, markPostcardRead, noteSavedPrice, normalizeRemember, priceChange, setSavedNote, POSTCARD_MAX, POSTCARDS_MAX, postcardsDue, rankedFavourites, removeWant, sailedSummary, sailedTrips, wantMatches, WANTS_MAX,
} from './rememberDelights'

const sailing = SAILINGS[0]
const card = (id: string, sailingId = 'a') => ({ id, text: 'Remember the sunsets', at: 1, sailingId, read: false })

describe('postcards', () => {
  it('trims, caps the length and refuses an empty one', () => {
    expect(addPostcard([], { ...card('1'), text: '   ' })).toEqual([])
    expect(addPostcard([], { ...card('1'), text: 'x'.repeat(POSTCARD_MAX + 50) })[0].text).toHaveLength(POSTCARD_MAX)
  })
  it('keeps at most five and no repeat id', () => {
    let l = [] as ReturnType<typeof addPostcard>
    for (let i = 0; i < POSTCARDS_MAX + 2; i++) l = addPostcard(l, card(`p${i}`))
    expect(l).toHaveLength(POSTCARDS_MAX)
    expect(addPostcard(l, card('p0'))).toHaveLength(POSTCARDS_MAX)
  })
  it('arrives on a later trip within sixty days, once', () => {
    const l = [card('1', 'a')]
    expect(postcardsDue(l, 'b', 60)).toHaveLength(1)
    expect(postcardsDue(l, 'b', 61)).toEqual([])
    expect(postcardsDue(l, 'b', -1)).toEqual([])
    expect(postcardsDue(l, 'a', 10)).toEqual([])
    expect(postcardsDue(markPostcardRead(l, '1'), 'b', 10)).toEqual([])
  })
})

const place = (code: string, lat: number, lon: number) => ({ code, name: code, lat, lon })
const trip = (id: string, departure: string, nights: number, ports: ReturnType<typeof place>[], cancelled = false) => ({ id, departure, nights, cancelled, ports })

describe('where I have sailed', () => {
  const trips = sailedTrips([
    trip('b', '2024-06-09', 7, [place('juneau', 58.3, -134.4), place('skagway', 59.5, -135.3)]),
    trip('a', '2023-01-14', 10, [place('colon', 9.35, -79.9), place('juneau', 58.3, -134.4)]),
    trip('c', '2022-01-01', 5, [place('x', 1, 1)], true),
  ])
  it('drops cancelled trips and sorts oldest first', () => expect(trips.map((t) => t.id)).toEqual(['a', 'b']))
  it('ignores a port with no usable place', () => {
    const t = sailedTrips([{ id: 'q', departure: '2020-01-01', nights: 3, cancelled: false, ports: [{ code: 'a', name: 'A', lat: 120, lon: 0 }, place('ok', 1, 1), 'junk'] }])
    expect(t[0].ports).toHaveLength(1)
    expect(sailedTrips([{ id: 'z', departure: '2020-01-01', nights: 1, cancelled: false }])[0].ports).toEqual([])
  })
  it('counts trips, nights and visits, most visited first', () => {
    const s = sailedSummary(trips)
    expect(s).toMatchObject({ trips: 2, nights: 17 })
    expect(s.ports[0]).toMatchObject({ visits: 2, place: { code: 'juneau' } })
    expect(s.ports).toHaveLength(3)
  })
  it('counts a port once for a trip that calls twice', () => {
    expect(sailedSummary(sailedTrips([trip('a', '2020-01-01', 7, [place('p', 1, 1), place('p', 1, 1)])])).ports[0].visits).toBe(1)
  })
})

describe('mapView', () => {
  it('shows the world with no ports', () => expect(mapView([]).viewBox).toBe('0 0 360 180'))
  it('puts east at the right and north at the top', () => {
    const v = mapView([{ place: place('a', 20, -87), visits: 1 }])
    expect(v.pins[0]).toMatchObject({ x: 93, y: 70 })
  })
  it('never frames tighter than the minimum or beyond the world', () => {
    const near = mapView([{ place: place('a', 20, -87), visits: 1 }, { place: place('b', 20.1, -87.1), visits: 1 }])
    expect(near.span).toBe(MAP_MIN_SPAN)
    const far = mapView([{ place: place('a', 58, -134), visits: 1 }, { place: place('b', -30, 150), visits: 1 }])
    const [x, y, w, h] = far.viewBox.split(' ').map(Number)
    expect(w).toBe(360)
    expect([x, y, h]).toEqual([0, 0, 180])
  })
  it('keeps the frame inside the world at the edges', () => {
    const [x, y, w, h] = mapView([{ place: place('a', 85, 179), visits: 1 }]).viewBox.split(' ').map(Number)
    expect(x + w).toBeLessThanOrEqual(360)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y + h).toBeLessThanOrEqual(180)
  })
})

describe('wantMatches', () => {
  const places = ['Cozumel, Mexico', 'Belize City, Belize', 'Roatán, Honduras']
  it('matches by place or country, ignoring case and accents', () => {
    expect(wantMatches(['roatan', 'MEXICO', 'a week in Honduras'], places).map((m) => m.place)).toEqual(['Roatán, Honduras', 'Cozumel, Mexico', 'Roatán, Honduras'])
  })
  it('does not match on small or common words, or on a different place', () => {
    expect(wantMatches(['New York City', 'Santorini', 'be', ''], places)).toEqual([])
  })
})

describe('ranked favourites', () => {
  it('puts the venue with most hearts first, then liked drinks, then ports', () => {
    const r = rankedFavourites({
      favourites: [{ venueId: 'a', dish: '1' }, { venueId: 'b', dish: '2' }, { venueId: 'b', dish: '3' }],
      diary: [{ id: '1', name: 'Mojito', verdict: 'liked', note: '', day: 1 }, { id: '2', name: 'Beer', verdict: 'notAgain', note: '', day: 1 }],
      pins: [{ id: 'x', port: 'belize', note: 'n', at: 0 }],
      venueName: (id) => id.toUpperCase(), portName: (p) => p,
    })
    expect(r.map((x) => x.label)).toEqual(['B', 'A', 'Mojito', 'belize'])
  })
  it('is empty with nothing recorded', () => expect(rankedFavourites({ favourites: [], diary: [], pins: [], venueName: String, portName: String })).toEqual([]))
})

describe('lifetime and wants', () => {
  it('counts nights and different ports across the record', () => expect(lifetime(sailedTrips([trip('a', '2020-01-01', 7, [place('p', 1, 1)]), trip('b', '2021-01-01', 4, [place('p', 1, 1), place('q', 2, 2)])]))).toEqual({ nights: 11, ports: 2 }))
  it('reads the places a sailing calls at, once each', () => expect(callPlaces(sailing)).toHaveLength(3))
  it('keeps a short list without repeats', () => {
    let l = addWant([], '  Santorini ')
    expect(addWant(l, 'santorini')).toEqual(['Santorini'])
    expect(addWant(l, '   ')).toEqual(['Santorini'])
    for (let i = 0; i < 12; i++) l = addWant(l, `Place ${i}`)
    expect(l).toHaveLength(WANTS_MAX)
    expect(removeWant(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('normalizeRemember', () => {
  it('gives an empty state for junk', () => {
    expect(normalizeRemember(null)).toEqual(EMPTY_REMEMBER)
    expect(normalizeRemember({ postcards: 3, voyages: 'x', wants: [1, {}] })).toEqual(EMPTY_REMEMBER)
  })
  it('keeps good values and drops the old kept-trips list', () => {
    const n = normalizeRemember({ postcards: [{ ...card('1'), read: true }], voyages: [{ sailingId: 's' }], wants: ['Lisbon'] })
    expect(n.postcards[0].read).toBe(true)
    expect(n).not.toHaveProperty('voyages')
    expect(n.wants).toEqual(['Lisbon'])
  })
})

describe('saved sailing notes', () => {
  it('keeps the first price seen and a trimmed note', () => {
    let s = noteSavedPrice({}, 'a', 100000)
    s = noteSavedPrice(s, 'a', 90000)
    s = setSavedNote(s, 'a', '  Mum’s   birthday week ')
    expect(s).toEqual({ a: { note: 'Mum’s birthday week', cents: 100000 } })
  })
  it('removes an entry with no note and no price, and ignores a missing price', () => {
    expect(setSavedNote({}, 'a', '  ')).toEqual({})
    expect(noteSavedPrice({}, 'a', null)).toEqual({})
    expect(setSavedNote({ a: { note: 'x', cents: null } }, 'a', '')).toEqual({})
  })
  it('reports the price change', () => {
    expect(priceChange(100000, 90000)).toBe(-10000)
    expect(priceChange(null, 90000)).toBeNull()
    expect(priceChange(100000, 100000)).toBe(0)
  })
  it('normalizes junk', () => {
    expect(normalizeRemember({ saved: { a: { note: 5, cents: -1 }, b: { note: 'hi', cents: 5000.4 } } }).saved).toEqual({ b: { note: 'hi', cents: 5000 } })
  })
})
