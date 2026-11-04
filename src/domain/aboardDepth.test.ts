import { describe, expect, it } from 'vitest'
import { aboardFeatureAt, hasDepthFor } from './aboardDepth'

describe('aboard depth', () => {
  it('knows which screens need a ship’s own details', () => {
    expect(aboardFeatureAt('/ship/map')).toBe('deckPlan')
    expect(aboardFeatureAt('/ship/venues/crown')).toBe('venues')
    expect(aboardFeatureAt('/home/cabins/')).toBe('cabins')
    expect(aboardFeatureAt('/ship/muster')).toBe('muster')
    expect(aboardFeatureAt('/ship/order')).toBe('order')
  })
  it('lets every other screen through, including look-alike paths', () => {
    expect(aboardFeatureAt('/home/ships')).toBeNull()
    expect(aboardFeatureAt('/ship/maps')).toBeNull()
    expect(aboardFeatureAt('/')).toBeNull()
  })
  it('judges only a browse ship', () => {
    expect(hasDepthFor('browse')).toBe(false)
    expect(hasDepthFor('aboard')).toBe(true)
    expect(hasDepthFor(undefined)).toBe(true)
  })
})
