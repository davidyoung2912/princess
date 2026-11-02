import { afterEach, describe, expect, it } from 'vitest'
import { applyCatalogue, catalogueVersion, normalizeCatalogue, subscribeCatalogue } from './catalogueServed'
import { VENUES } from './dining'
import { EXCURSIONS } from './excursions'

const ex = (over: Record<string, unknown> = {}) => ({ id: 'coz-snorkel', port: 'cozumel', name: 'Reef snorkel', summary: 's', hours: 3.5, price: 8100, activity: 'moderate', wheelchair: false, family: true, interests: ['water'], rating: 4.7, reviews: 10, meeting: 'pier', start: '08:30', capacity: 36, ...over })
const ve = (over: Record<string, unknown> = {}) => ({ id: 'crown', name: 'Crown Grill 2', kind: 'specialty', cover: 5000, walkIn: false, deck: 'Deck 8 aft', cuisine: 'Steak and more', dress: 'elegant', menu: 'A new menu.', ...over })
const wire = (excursions: unknown[], venues: unknown[]) => ({ version: 'c1', excursions, venues })

describe('the server catalogue', () => {
  afterEach(() => applyCatalogue(null))

  it('replaces the excursions and the dining terms in place, and keeps the rest of a room', () => {
    const before = EXCURSIONS
    const c = normalizeCatalogue(wire([ex()], [ve()]))!
    applyCatalogue(c)
    expect(EXCURSIONS).toBe(before)
    expect(EXCURSIONS).toHaveLength(1)
    expect(EXCURSIONS[0].price).toBe(8100)
    const crown = VENUES.find((v) => v.id === 'crown')!
    expect([crown.name, crown.cover]).toEqual(['Crown Grill 2', 5000])
    expect([crown.deck, crown.cuisine, crown.dress, crown.menu]).toEqual(['Deck 8 aft', 'Steak and more', 'elegant', 'A new menu.'])
  })

  it('goes back to the authored copy', () => {
    applyCatalogue(normalizeCatalogue(wire([ex()], [ve()])))
    applyCatalogue(null)
    expect(EXCURSIONS).toHaveLength(12)
    expect(VENUES.find((v) => v.id === 'crown')!.cover).toBe(4500)
  })

  it('drops bad entries and ignores an answer with nothing usable', () => {
    expect(normalizeCatalogue(wire([ex({ price: -1 }), ex({ port: 'mars' }), ex({ start: '8:30' }), ex({ id: 'ok' })], [ve({ kind: 'x' }), ve({ dress: 'tuxedo' }), ve({ menu: '' })]))!.excursions.map((x) => x.id)).toEqual(['ok'])
    expect(normalizeCatalogue(wire([ex({ port: 'mars' })], []))).toBeNull()
    expect(normalizeCatalogue('nope')).toBeNull()
    expect(normalizeCatalogue({ excursions: [ex()] })).toBeNull()
    expect(normalizeCatalogue({ excursions: [ex()], venues: [] })).toBeNull()
  })

  it('tells listeners when it changes', () => {
    let n = 0
    const off = subscribeCatalogue(() => n++)
    const v = catalogueVersion()
    applyCatalogue(normalizeCatalogue(wire([ex()], [])))
    off()
    applyCatalogue(null)
    expect([n, catalogueVersion() - v]).toEqual([1, 2])
  })
})
