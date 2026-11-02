import { describe, expect, it } from 'vitest'
import { cabinsFor } from './cabins'
import { chooseCabins, compareMatrix, HEADINGS, MAX_COMPARE, NO_FILTER, notIncluded, scoreCabin, sunSide, sunSummary } from './cabinScore'
import { REFERENCE_SAILING as S } from './sailings'
import { CATEGORIES } from './ship'

describe('cabin scores', () => {
  it('stay between 1 and 5 and always explain themselves', () => {
    for (const c of CATEGORIES) for (const cab of cabinsFor(S.id, c.id)) {
      const s = scoreCabin(S, c.id, cab)
      for (const k of ['sleep', 'motion', 'noise'] as const) {
        expect(s[k]).toBeGreaterThanOrEqual(1)
        expect(s[k]).toBeLessThanOrEqual(5)
        expect(s.reasons[k].length).toBeGreaterThan(0)
      }
    }
  })

  it('rates midship low decks steadiest and forward high decks worst for motion', () => {
    const base = { number: '1', side: 'port' as const, notes: [] as string[], obstructed: false, accessible: false, available: true }
    const steady = scoreCabin(S, 'balcony', { ...base, deck: 8, position: 'midship' })
    const rough = scoreCabin(S, 'balcony', { ...base, deck: 16, position: 'forward' })
    expect(steady.motion).toBe(5)
    expect(rough.motion).toBe(1)
    expect(rough.reasons.motion.join(' ')).toMatch(/front/)
  })

  it('warns about thrusters, engines and the pool deck', () => {
    const base = { number: '1', side: 'port' as const, notes: [] as string[], obstructed: true, accessible: false, available: true }
    expect(scoreCabin(S, 'oceanview', { ...base, deck: 8, position: 'forward' }).reasons.sleep.join(' ')).toMatch(/thrusters/)
    expect(scoreCabin(S, 'oceanview', { ...base, deck: 8, position: 'aft' }).reasons.sleep.join(' ')).toMatch(/engine/)
    expect(scoreCabin(S, 'balcony', { ...base, deck: 14, position: 'aft' }).reasons.noise.join(' ')).toMatch(/pool/)
    expect(scoreCabin(S, 'oceanview', { ...base, deck: 8, position: 'aft' }).warnings.join(' ')).toMatch(/lifeboats/)
  })

  it('filters for quiet and calm seas, and puts the best first', () => {
    const all = chooseCabins(S, 'balcony')
    const quiet = chooseCabins(S, 'balcony', { ...NO_FILTER, quiet: true })
    expect(quiet.every((c) => c.sleep >= 4 && c.noise >= 4)).toBe(true)
    expect(quiet.length).toBeLessThanOrEqual(all.length)
    const calm = chooseCabins(S, 'balcony', { ...NO_FILTER, calmSea: true })
    expect(calm.every((c) => c.motion >= 4)).toBe(true)
    const sums = all.map((c) => c.sleep + c.motion + c.noise)
    expect([...sums].sort((a, b) => b - a)).toEqual(sums)
    expect(chooseCabins(S, 'balcony', { ...NO_FILTER, availableOnly: true }).every((c) => c.cabin.available)).toBe(true)
  })
})

describe('sun side', () => {
  it('puts the morning sun on the port side when heading south and the afternoon sun on starboard', () => {
    expect(sunSide(180, 'morning')).toBe('port')
    expect(sunSide(180, 'afternoon')).toBe('starboard')
  })
  it('flips when heading north', () => {
    expect(sunSide(0, 'morning')).toBe('starboard')
    expect(sunSide(0, 'afternoon')).toBe('port')
  })
  it('has a heading for each of the eight days and shades an interior', () => {
    expect(Object.keys(HEADINGS)).toHaveLength(8)
    const port = sunSummary(S, 'port')
    const star = sunSummary(S, 'starboard')
    expect(port.mornings + star.mornings).toBeLessThanOrEqual(8)
    expect(['morning', 'afternoon', 'both', 'shaded']).toContain(port.label)
    const interior = cabinsFor(S.id, 'interior')[0]
    expect(scoreCabin(S, 'interior', interior).sun).toBeNull()
  })
})

describe('comparison and what is not included', () => {
  it('lists what each fare leaves out, using the entitlement numbers', () => {
    expect(notIncluded('standard').join(' ')).toMatch(/All drinks/)
    expect(notIncluded('plus').join(' ')).toMatch(/\$15/)
    expect(notIncluded('premier').join(' ')).toMatch(/\$100 credit/)
    for (const f of ['standard', 'plus', 'premier'] as const) expect(notIncluded(f).join(' ')).toMatch(/Flights/)
  })

  it('compares up to three choices with prices that include gratuities and taxes', () => {
    const cols = (['interior', 'balcony', 'miniSuite', 'balcony'] as const).map((category, i) => ({ id: String(i), label: category, category, fare: 'standard' as const, cabin: cabinsFor(S.id, category)[0] }))
    const rows = compareMatrix(S, 2, cols)
    expect(rows.find((r) => r.key === 'total')!.values).toHaveLength(MAX_COMPARE)
    expect(rows.find((r) => r.key === 'total')!.values.every((v) => v.startsWith('$'))).toBe(true)
    expect(rows.find((r) => r.key === 'sun')!.values[0]).toBe('—')
  })
})
