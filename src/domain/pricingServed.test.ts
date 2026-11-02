import { afterEach, describe, expect, it } from 'vitest'
import { applyPricing, normalizePricing } from './pricingServed'
import { FUTURE_DEPARTURES, GRATUITY_PER_NIGHT, INTERIOR_FARE, TAXES_AND_FEES, fareFor, quote } from './pricing'
import { FARES } from './fares'
import { seedReference } from '../testing/setup'
import fixture from '../testing/reference-fixture.json'

const wire = (): Record<string, any> => structuredClone(fixture.pricing)

describe('normalizePricing', () => {
  it('reads the fixture as a good answer', () => {
    const p = normalizePricing(wire())!
    expect(Object.keys(p.interior)).toHaveLength(8)
    expect(p.nextSeason).toHaveLength(4)
    expect(p.fares.map((f) => f.id)).toEqual(['standard', 'plus', 'premier'])
  })

  it.each([
    ['not an object', () => []],
    ['no interior fares', () => { const w = wire(); w.interior = {}; return w }],
    ['a fractional fare', () => { const w = wire(); w.interior['sun-2026-11-08'] = 1539.5; return w }],
    ['a next-season sailing that is also open', () => { const w = wire(); w.nextSeason[0].id = 'sun-2026-11-08'; return w }],
    ['a bad departure date', () => { const w = wire(); w.nextSeason[0].departure = '7 Nov'; return w }],
    ['a missing fare', () => { const w = wire(); w.fares.pop(); return w }],
    ['a negative tax', () => { const w = wire(); w.taxesAndFees = -1; return w }],
  ])('rejects %s', (_n, make) => {
    expect(normalizePricing(make())).toBeNull()
  })
})

describe('applyPricing', () => {
  afterEach(() => seedReference())

  it('replaces the fares, the taxes and the fare names in place', () => {
    const before = INTERIOR_FARE
    const w = wire()
    w.interior['sun-2026-11-08'] = 100_000
    w.taxesAndFees = 30_000
    w.fares[1].name = 'Plus 2'
    applyPricing(normalizePricing(w)!)
    expect(INTERIOR_FARE).toBe(before)
    expect([fareFor('sun-2026-11-08', 'interior'), TAXES_AND_FEES, GRATUITY_PER_NIGHT, FARES.plus.name]).toEqual([100_000, 30_000, 1650, 'Plus 2'])
    expect(quote('sun-2026-11-08', 'interior', 2)!.lines.find((l) => l.key === 'taxes')!.cents).toBe(60_000)
  })

  it('prices and lists next season from the served departures', () => {
    expect(FUTURE_DEPARTURES.map((f) => f.departure)).toEqual(['2027-11-07', '2027-11-21', '2027-12-05', '2028-01-09'])
    expect(fareFor('sun-2027-11-07', 'interior')).toBe(164_900)
  })
})
