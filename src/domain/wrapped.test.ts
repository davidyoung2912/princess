import { describe, expect, it } from 'vitest'
import { buildRecap } from './recap'
import { REFERENCE_SAILING as S } from './sailings'
import { anniversaryOn, buildWrapped, cardText, csvCell, expenseCsv, packageHindsight } from './wrapped'

const recap = buildRecap({ sailing: S, party: ['Ann'], tours: [], dinners: ['sabatini', 'sabatini'], photos: 3 })

describe('wrapped', () => {
  it('leaves drinks out unless the guest opted in', () => {
    expect(buildWrapped(recap).some((c) => c.id === 'drinks')).toBe(false)
    expect(buildWrapped(recap, { drinks: 0 }).some((c) => c.id === 'drinks')).toBe(false)
    expect(buildWrapped(recap, { drinks: 12 }).some((c) => c.id === 'drinks')).toBe(true)
  })
  it('skips cards with nothing to say and shares no names', () => {
    const cards = buildWrapped({ ...recap, photos: 0, tourNames: [], favouriteMeal: null })
    expect(cards.map((c) => c.id)).toEqual(['miles', 'ports'])
    expect(cards.map(cardText).join(' ')).not.toMatch(/Ann/)
  })
})

describe('package hindsight', () => {
  const base = { paid: 100_000, drinks: 0, specialtyDinners: 0, wifiNights: 0, wifiNight: 2000, otherFarePaid: null }
  it('says worth, close or not worth', () => {
    expect(packageHindsight({ ...base, drinks: 100 }).verdict).toBe('worth')
    expect(packageHindsight({ ...base, drinks: 5 }).verdict).toBe('notWorth')
    expect(packageHindsight({ ...base, drinks: 80 }).verdict).toBe('close')
    expect(packageHindsight({ ...base, drinks: 5 }).line).toMatch(/Paying as you go would have saved/)
  })
  it('copes with nonsense', () => {
    const h = packageHindsight({ ...base, drinks: NaN, specialtyDinners: -3 })
    expect(h.payAsYouGo).toBe(0)
  })
})

describe('anniversaries', () => {
  it('fires a year on, only when switched on', () => {
    const d = `${Number(S.departure.slice(0, 4)) + 1}${S.departure.slice(4)}`
    expect(anniversaryOn(S, d, true)).toMatchObject({ day: 1 })
    expect(anniversaryOn(S, d, false)).toBeNull()
    expect(anniversaryOn(S, '2030-01-01', true)).toBeNull()
  })
})

describe('expense export', () => {
  it('makes formulas into plain text, quotes commas and keeps credits negative', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    const csv = expenseCsv([{ date: '2027-03-22', description: '@cmd, drink', category: 'drinks', cents: 1250 }, { date: '2027-03-23', description: 'Credit', category: 'credit', cents: -500 }])
    expect(csv).toContain("'@cmd")
    expect(csv).toContain(',-5.00\r\n')
    expect(csv.trimEnd().split('\r\n').pop()).toBe(',Total,,7.50')
  })
})
