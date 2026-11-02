import { describe, expect, it } from 'vitest'
import { cabinsFor } from './cabins'
import { compareMatrix, MAX_COMPARE, notIncluded, type CabinScore } from './cabinScore'
import { REFERENCE_SAILING as S } from './sailings'

/** A served score for the first sample cabin of a room type (the numbers are the server's to decide; the comparison only lays them out). */
const score = (category: CabinScore['category']): CabinScore => ({
  cabin: cabinsFor(S.id, category)[0], category, sleep: 4, motion: 3, noise: 5, reasons: { sleep: ['a'], motion: ['b'], noise: ['c'] },
  sun: category === 'interior' ? null : { mornings: 3, afternoons: 1, portAfternoons: 0, label: 'morning', text: 'x' }, warnings: [],
})

describe('comparison and what is not included', () => {
  it('lists what each fare leaves out, using the entitlement numbers', () => {
    expect(notIncluded('standard').join(' ')).toMatch(/All drinks/)
    expect(notIncluded('plus').join(' ')).toMatch(/\$15/)
    expect(notIncluded('premier').join(' ')).toMatch(/\$100 credit/)
    for (const f of ['standard', 'plus', 'premier'] as const) expect(notIncluded(f).join(' ')).toMatch(/Flights/)
  })

  it('compares up to three choices with prices that include gratuities and taxes', () => {
    const cols = (['interior', 'balcony', 'miniSuite', 'balcony'] as const).map((category, i) => ({ id: String(i), label: category, category, fare: 'standard' as const, score: score(category) }))
    const rows = compareMatrix(S.id, 2, cols)
    expect(rows.find((r) => r.key === 'total')!.values).toHaveLength(MAX_COMPARE)
    expect(rows.find((r) => r.key === 'total')!.values.every((v) => v.startsWith('$'))).toBe(true)
    expect(rows.find((r) => r.key === 'sun')!.values[0]).toBe('—')
    expect(rows.find((r) => r.key === 'sun')!.values[1]).toBe('morning')
    expect(rows.find((r) => r.key === 'sleep')!.values[0]).toBe('4 of 5')
  })
})
