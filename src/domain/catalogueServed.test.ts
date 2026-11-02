import { afterEach, describe, expect, it } from 'vitest'
import { applyCatalogue, catalogueVersion, normalizeCatalogue, subscribeCatalogue } from './catalogueServed'
import { VENUES } from './dining'
import { EXCURSIONS } from './excursions'

const ex = (over: Record<string, unknown> = {}) => ({ id: 'coz-snorkel', port: 'cozumel', name: 'Reef snorkel', summary: 's', hours: 3.5, price: 8100, activity: 'moderate', wheelchair: false, family: true, interests: ['water'], rating: 4.7, reviews: 10, meeting: 'pier', start: '08:30', capacity: 36, ...over })
const ve = (over: Record<string, unknown> = {}) => ({ id: 'crown', name: 'Crown Grill 2', kind: 'specialty', cover: 5000, walkIn: false, ...over })

describe('the server catalogue', () => {
  afterEach(() => applyCatalogue(null))

  it('replaces the excursions and the dining terms in place, and keeps the rest of a room', () => {
    const before = EXCURSIONS
    const c = normalizeCatalogue({ excursions: [ex()], venues: [ve()] })!
    applyCatalogue(c)
    expect(EXCURSIONS).toBe(before)
    expect(EXCURSIONS).toHaveLength(1)
    expect(EXCURSIONS[0].price).toBe(8100)
    const crown = VENUES.find((v) => v.id === 'crown')!
    expect([crown.name, crown.cover]).toEqual(['Crown Grill 2', 5000])
    expect(crown.cuisine).toBe('Steakhouse')
    expect(VENUES.find((v) => v.id === 'eclipse')).toBeDefined()
  })

  it('goes back to the authored copy', () => {
    applyCatalogue(normalizeCatalogue({ excursions: [ex()], venues: [ve()] }))
    applyCatalogue(null)
    expect(EXCURSIONS).toHaveLength(12)
    expect(VENUES.find((v) => v.id === 'crown')!.cover).toBe(4500)
  })

  it('drops bad entries and ignores an answer with nothing usable', () => {
    expect(normalizeCatalogue({ excursions: [ex({ price: -1 }), ex({ port: 'mars' }), ex({ start: '8:30' }), ex({ id: 'ok' })], venues: [ve({ kind: 'x' })] })!.excursions.map((x) => x.id)).toEqual(['ok'])
    expect(normalizeCatalogue({ excursions: [ex({ port: 'mars' })], venues: [] })).toBeNull()
    expect(normalizeCatalogue('nope')).toBeNull()
    expect(normalizeCatalogue({ excursions: [ex()] })).toBeNull()
  })

  it('tells listeners when it changes', () => {
    let n = 0
    const off = subscribeCatalogue(() => n++)
    const v = catalogueVersion()
    applyCatalogue(normalizeCatalogue({ excursions: [ex()], venues: [] }))
    off()
    applyCatalogue(null)
    expect([n, catalogueVersion() - v]).toEqual([1, 2])
  })
})
