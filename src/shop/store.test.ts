import { describe, expect, it } from 'vitest'
import { loadRates, saveRates } from '../rates/store'
import { SAMPLE_TABLE, stubRates } from '../domain/rates'
import { EMPTY_EXTRAS, setDelivery } from '../domain/shopExtras'
import { loadExtras, saveExtras, shopKeyFor } from './store'

const fake = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

describe('shop choices storage', () => {
  it('keeps each person’s choices apart', () => {
    const s = fake()
    saveExtras('gerald', setDelivery(EMPTY_EXTRAS, 'a', 'cabin'), s)
    expect(loadExtras('gerald', s).delivery).toEqual({ a: 'cabin' })
    expect(loadExtras('maria', s)).toEqual(EMPTY_EXTRAS)
    expect(shopKeyFor('gerald').startsWith('princess:')).toBe(true)
  })
  it('survives broken or missing storage', () => {
    expect(loadExtras('g', { getItem: () => '{oops' })).toEqual(EMPTY_EXTRAS)
    expect(loadExtras('g', null)).toEqual(EMPTY_EXTRAS)
    expect(saveExtras('g', EMPTY_EXTRAS, { setItem: () => { throw new Error('full') } })).toBe(false)
  })
})

describe('rates storage', () => {
  it('round-trips a table and falls back to the sample', () => {
    const s = fake()
    const t = stubRates(Date.UTC(2026, 10, 1))
    saveRates(t, s)
    expect(loadRates(s)).toEqual(t)
    expect(loadRates(fake())).toBe(SAMPLE_TABLE)
    expect(loadRates({ getItem: () => '{oops' })).toBe(SAMPLE_TABLE)
  })
})
