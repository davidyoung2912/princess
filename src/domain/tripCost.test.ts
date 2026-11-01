import { describe, expect, it } from 'vitest'
import { bookingQuote } from './fares'
import { tripCost, type TripCostInput } from './tripCost'

const base: TripCostInput = { sailingId: 'sun-2027-03-21', category: 'balcony', guests: 2, adults: 2, daysToDeparture: 200, drinks: false, wifi: false, dinners: 0, excursionIds: [], flights: 0, hotel: 0, other: 0 }
const totalOf = (c: ReturnType<typeof tripCost>, fare: string) => c!.options.find((o) => o.fare === fare)!.total
const lineOf = (c: ReturnType<typeof tripCost>, fare: string, key: string) => c!.options.find((o) => o.fare === fare)!.lines.find((l) => l.key === key)?.cents

describe('whole-trip cost', () => {
  it('matches the booking quote when nothing is added', () => {
    const c = tripCost(base)!
    for (const fare of ['standard', 'plus', 'premier'] as const) expect(totalOf(c, fare)).toBe(bookingQuote(base.sailingId, 'balcony', 2, fare)!.total)
    expect(c.cheapest).toBe('standard')
    expect(c.savingVsStandard).toBe(0)
  })
  it('adds outside costs equally to every fare', () => {
    const plain = tripCost(base)!
    const more = tripCost({ ...base, flights: 120_000, hotel: 30_000, other: 5_000 })!
    for (const fare of ['standard', 'plus', 'premier']) expect(totalOf(more, fare) - totalOf(plain, fare)).toBe(155_000)
  })
  it('charges for drinks and Wi-Fi only where the fare does not include them', () => {
    const c = tripCost({ ...base, drinks: true, wifi: true })!
    expect(lineOf(c, 'standard', 'drinks')).toBeGreaterThan(0)
    expect(lineOf(c, 'standard', 'wifi')).toBeGreaterThan(0)
    expect(lineOf(c, 'plus', 'drinks')).toBeUndefined()
    expect(lineOf(c, 'premier', 'wifi')).toBeUndefined()
  })
  it('prices drinks for adults only', () => {
    const family = tripCost({ ...base, guests: 4, adults: 2, drinks: true })!
    const adultsOnly = tripCost({ ...base, guests: 4, adults: 4, drinks: true })!
    expect(lineOf(family, 'standard', 'drinks')! * 2).toBe(lineOf(adultsOnly, 'standard', 'drinks')!)
  })
  it('counts only the specialty dinners the fare does not cover', () => {
    const c = tripCost({ ...base, dinners: 3 })!
    const perDinner = lineOf(c, 'standard', 'dining')! / (3 * 2)
    expect(lineOf(c, 'plus', 'dining')).toBe(perDinner * 1 * 2)
    expect(lineOf(c, 'premier', 'dining')).toBeUndefined()
  })
  it('credits excursions on Premier, never below zero', () => {
    const one = tripCost({ ...base, excursionIds: ['bze-walk'] })!
    expect(lineOf(one, 'premier', 'excursionCredit')).toBe(-9000)
    expect(lineOf(one, 'standard', 'excursionCredit')).toBeUndefined()
    const many = tripCost({ ...base, excursionIds: ['bze-cave', 'bze-reef'] })!
    expect(lineOf(many, 'premier', 'excursionCredit')).toBe(-20_000)
  })
  it('names the cheapest fare and the saving when a package pays for itself', () => {
    const c = tripCost({ ...base, drinks: true, wifi: true, dinners: 3, excursionIds: ['bze-cave'] })!
    expect(c.cheapest).not.toBe('standard')
    expect(c.savingVsStandard).toBe(totalOf(c, 'standard') - totalOf(c, c.cheapest))
    expect(c.savingVsStandard).toBeGreaterThan(0)
  })
  it('offers only Premier where the room includes it, and nothing for bad input', () => {
    expect(tripCost({ ...base, category: 'signatureSuite' })!.options.map((o) => o.fare)).toEqual(['premier'])
    expect(tripCost({ ...base, sailingId: 'nope' })).toBeNull()
    expect(tripCost({ ...base, guests: 4, category: 'signatureSuite' })).toBeNull()
  })
  it('keeps odd numbers in range', () => {
    const c = tripCost({ ...base, adults: 9, dinners: 99, flights: -5, hotel: Number.NaN })!
    expect(c.options[0].lines.every((l) => Number.isFinite(l.cents))).toBe(true)
    expect(lineOf(c, 'standard', 'flights')).toBeUndefined()
  })
})
