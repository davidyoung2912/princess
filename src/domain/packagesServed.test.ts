import { afterEach, describe, expect, it } from 'vitest'
import { applyPackages, normalizePackages } from './packagesServed'
import { ADD_ONS, ADD_ON_IDS, AVG_DRINK, CANCEL_UNTIL_DAYS, DEFAULT_USAGE, addOnPrice, breakEvenDrinks } from './packages'

const wire = (): Record<string, any> => ({
  version: 'k1',
  addOns: ADD_ON_IDS.map((id) => ({ id, name: ADD_ONS[id].name, blurb: ADD_ONS[id].blurb, unit: ADD_ONS[id].unit, base: ADD_ONS[id].base, changeAtDays: ADD_ONS[id].change.atDays, changeShare: ADD_ONS[id].change.share, minAge: ADD_ONS[id].minAge })),
  avgDrink: 1100, serviceCharge: 0.18, avgCover: 4500, cancelUntilDays: 3,
})

describe('normalizePackages', () => {
  it('reads the authored values as a good answer', () => {
    const p = normalizePackages(wire())!
    expect(p.addOns).toHaveLength(ADD_ON_IDS.length)
    expect(p.addOns.find((a) => a.id === 'photo')!.change).toEqual({ atDays: 10, share: -0.2 })
  })

  it.each([
    ['not an object', () => []],
    ['a missing add-on', () => { const w = wire(); w.addOns.pop(); return w }],
    ['a repeated add-on', () => { const w = wire(); w.addOns[1] = { ...w.addOns[0] }; return w }],
    ['an unknown unit', () => { const w = wire(); w.addOns[0].unit = 'week'; return w }],
    ['a fractional price', () => { const w = wire(); w.addOns[0].base = 10.5; return w }],
    ['a service charge over 100%', () => { const w = wire(); w.serviceCharge = 1.5; return w }],
    ['a negative refund window', () => { const w = wire(); w.cancelUntilDays = -1; return w }],
  ])('rejects %s', (_n, make) => {
    expect(normalizePackages(make())).toBeNull()
  })
})

describe('applyPackages', () => {
  const saved = wire()
  afterEach(() => applyPackages(normalizePackages(saved)!))

  it('changes the prices and the worth-it figures that read them', () => {
    const w = wire()
    w.addOns[0].base = 6000
    w.avgDrink = 1300
    w.cancelUntilDays = 7
    applyPackages(normalizePackages(w)!)
    expect(addOnPrice('drinks', 100)).toBe(6000)
    expect(AVG_DRINK).toBe(1300)
    expect(CANCEL_UNTIL_DAYS).toBe(7)
    expect(DEFAULT_USAGE.avgDrink).toBe(1300)
    expect(breakEvenDrinks(6000)).toBeGreaterThan(0)
  })
})
