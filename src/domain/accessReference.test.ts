import { afterEach, describe, expect, it } from 'vitest'
import { normalizeAccessReference, setServedAccess } from './accessReference'
import { hasAccessibleCabins } from './cabins'
import { DIFFICULTY, difficultyOf } from './planning'

afterEach(() => setServedAccess(null))

describe('served access reference', () => {
  it('uses the authored copies until the server answers', () => {
    expect(difficultyOf('coz-ruins')).toEqual(DIFFICULTY['coz-ruins'])
    expect(hasAccessibleCabins('balcony')).toBe(true)
    expect(hasAccessibleCabins('signatureSuite')).toBe(false)
  })
  it('prefers the server figures, and falls back for an id it does not list', () => {
    setServedAccess(normalizeAccessReference({ version: 'v1', difficulty: { 'coz-ruins': { km: 9, steps: false, heat: 'low', shade: 'high', seats: true, restrooms: true, wet: false } }, accessibleCategories: ['interior'] }))
    expect(difficultyOf('coz-ruins')?.km).toBe(9)
    expect(difficultyOf('coz-snorkel')).toEqual(DIFFICULTY['coz-snorkel'])
    expect(hasAccessibleCabins('interior')).toBe(true)
    expect(hasAccessibleCabins('balcony')).toBe(false)
  })
  it('drops bad entries and ignores an answer with nothing usable', () => {
    expect(normalizeAccessReference(null)).toBeNull()
    expect(normalizeAccessReference({ version: 'v1', difficulty: { x: { km: 'far', heat: 'low', shade: 'low' } }, accessibleCategories: [] })).toBeNull()
    expect(normalizeAccessReference({ version: 'v1', difficulty: { x: { km: 1, heat: 'hot', shade: 'low' }, y: { km: 2, heat: 'low', shade: 'low' } }, accessibleCategories: ['a', 3] })?.difficulty).toEqual({ y: { km: 2, steps: false, heat: 'low', shade: 'low', seats: false, restrooms: false, wet: false } })
  })
})
