import { describe, expect, it } from 'vitest'
import { SAILINGS, itinerary } from './sailings'
import {
  addPostcard, addWant, EMPTY_REMEMBER, keepVoyage, lifetime, markPostcardRead, normalizeRemember, POSTCARD_MAX, POSTCARDS_MAX, postcardsDue, rankedFavourites, removeWant, sailedSummary, voyageDone, voyageOf, WANTS_MAX,
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

describe('where I have sailed', () => {
  it('lists each port once for a trip', () => {
    const v = voyageOf(sailing)
    expect(v.ports).toEqual(['cozumel', 'belize', 'roatan'])
    expect(v.nights).toBe(itinerary(sailing).length - 1)
  })
  it('is done on the last day, not before', () => {
    const days = itinerary(sailing)
    expect(voyageDone(sailing, days[days.length - 2].date)).toBe(false)
    expect(voyageDone(sailing, days[days.length - 1].date)).toBe(true)
  })
  it('keeps a trip once and counts visits', () => {
    const v = voyageOf(sailing)
    const l = keepVoyage(keepVoyage([], v), v)
    expect(l).toHaveLength(1)
    const two = keepVoyage(l, { ...v, sailingId: 'z', departure: '2030-01-01', ports: ['cozumel'] })
    const s = sailedSummary(two)
    expect(s.trips).toBe(2)
    expect(s.ports[0]).toEqual({ port: 'cozumel', visits: 2 })
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
  it('counts different ports across kept trips', () => expect(lifetime(14.4, [voyageOf(sailing)])).toEqual({ days: 14, ports: 3 }))
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
  it('keeps good values and drops bad ports', () => {
    const n = normalizeRemember({ postcards: [{ ...card('1'), read: true }], voyages: [{ sailingId: 's', departure: '2027-03-21', nights: 7, ports: ['cozumel', 'mars', 'cozumel'] }], wants: ['Lisbon'] })
    expect(n.postcards[0].read).toBe(true)
    expect(n.voyages[0].ports).toEqual(['cozumel'])
    expect(n.wants).toEqual(['Lisbon'])
  })
})
