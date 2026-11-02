import { afterEach, describe, expect, it } from 'vitest'
import { applyShip, normalizeShip } from './shipServed'
import { CATEGORIES, OTHER_SHIPS, SHIP, SHIP_ACCESSIBILITY, SHIP_HIGHLIGHTS } from './ship'
import { DECKS, ELEVATORS, MUSTER_STATIONS, PLACES } from './deck'

const wire = (): Record<string, any> => ({
  version: 'v1',
  ship: { ...SHIP, name: 'Star Princess' },
  highlights: [{ title: 'The Piazza', body: 'A gathering place.' }],
  categories: [{ id: 'interior', name: 'Interior', code: 'IF', size: '135 sq ft', view: 'No window', summary: 'Value.', ratio: 1 }, { id: 'miniSuite', name: 'Mini-Suite', code: 'MB', size: 'Larger', view: 'Balcony', summary: 'Room.', ratio: 1.9, suite: true }],
  accessibility: ['Six elevator banks.'],
  otherShips: [{ name: 'Sky Princess', note: 'Grand class.', guests: 3660, entered: 2019 }],
  places: [
    { id: 'piazza', name: 'The Piazza', deck: 7, section: 'midship', kind: 'show', stepFree: true, note: 'Three levels' },
    { id: 'bar', name: 'A bar', deck: 12, section: 'aft', kind: 'bar', stepFree: false, note: null },
  ],
  elevators: [{ bank: 'A', section: 'forward', side: 'port' }],
  muster: [{ letter: 'C', name: 'The Piazza, port side', placeId: 'piazza', deck: 7 }],
})

describe('normalizeShip', () => {
  it('reads a good answer', () => {
    const s = normalizeShip(wire())!
    expect(s.places[1]).toEqual({ id: 'bar', name: 'A bar', deck: 12, section: 'aft', kind: 'bar', stepFree: false })
    expect(s.categories[1].suite).toBe(true)
  })

  it.each([
    ['not an object', () => 5],
    ['a bad section', () => { const w = wire(); w.places[0].section = 'top'; return w }],
    ['a bad kind', () => { const w = wire(); w.places[0].kind = 'spa'; return w }],
    ['a repeated place id', () => { const w = wire(); w.places[1].id = 'piazza'; return w }],
    ['a muster station at an unknown place', () => { const w = wire(); w.muster[0].placeId = 'nowhere'; return w }],
    ['a repeated muster letter', () => { const w = wire(); w.muster.push({ ...w.muster[0] }); return w }],
    ['an unknown category', () => { const w = wire(); w.categories[0].id = 'penthouse'; return w }],
    ['no places', () => { const w = wire(); w.places = []; return w }],
    ['a negative guest count', () => { const w = wire(); w.ship.guests = -1; return w }],
    ['a bad elevator bank', () => { const w = wire(); w.elevators[0].bank = 'Z'; return w }],
  ])('rejects %s', (_n, make) => {
    expect(normalizeShip(make())).toBeNull()
  })
})

describe('applyShip', () => {
  const saved = { ship: { ...SHIP }, h: [...SHIP_HIGHLIGHTS], c: [...CATEGORIES], a: [...SHIP_ACCESSIBILITY], o: [...OTHER_SHIPS], p: [...PLACES], e: [...ELEVATORS], m: Object.values(MUSTER_STATIONS) }
  afterEach(() => {
    applyShip({ version: 'back', ship: saved.ship, highlights: saved.h, categories: saved.c, accessibility: saved.a, otherShips: saved.o, places: saved.p, elevators: saved.e, muster: saved.m })
  })

  it('swaps every table in place', () => {
    const places = PLACES
    applyShip(normalizeShip(wire())!)
    expect(PLACES).toBe(places)
    expect(SHIP.name).toBe('Star Princess')
    expect(CATEGORIES.map((c) => c.id)).toEqual(['interior', 'miniSuite'])
    expect(PLACES.map((p) => p.id)).toEqual(['piazza', 'bar'])
    expect([...DECKS]).toEqual([7, 12])
    expect(ELEVATORS).toHaveLength(1)
    expect(Object.keys(MUSTER_STATIONS)).toEqual(['C'])
  })
})
