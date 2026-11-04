import { describe, expect, it } from 'vitest'
import {
  clockChangeNudges, dayNumbers, elegantCount, elegantDays, isDisembarkDay, isEmbarkDay, isMidVoyageDay, medicationSupplyDays, midVoyageNudges,
  MAX_PLAN_DAY, packCounts, planDays, planNights,
} from './nightsRules'
import { buildPackingList } from './packing'
import { dressNights } from './prepMore'
import { dressTonight } from './seaDelights'

const LENGTHS = [6, 7, 8, 10, 14, 21, 31]

describe('nightsRules: length', () => {
  it('plans 3 to 40 nights and one more day', () => {
    expect(planNights(1)).toBe(3)
    expect(planNights(99)).toBe(40)
    expect(planNights(Number.NaN)).toBe(7)
    expect(planDays(40)).toBe(MAX_PLAN_DAY)
    expect(dayNumbers(31)).toHaveLength(32)
  })
  it('knows the first and last day', () => {
    for (const n of LENGTHS) {
      expect(isEmbarkDay(1)).toBe(true)
      expect(isDisembarkDay(n + 1, n)).toBe(true)
      expect(isDisembarkDay(n, n)).toBe(false)
      expect(isMidVoyageDay(1, n)).toBe(false)
      expect(isMidVoyageDay(n + 1, n)).toBe(false)
      expect(isMidVoyageDay(2, n)).toBe(true)
    }
  })
})

describe('nightsRules: dress nights', () => {
  it('counts elegant evenings by length', () => {
    expect(LENGTHS.map(elegantCount)).toEqual([1, 2, 2, 2, 4, 6, 8])
    expect(elegantCount(3)).toBe(0)
  })
  it('keeps the seven-night evenings and puts the last on the final night', () => {
    expect(elegantDays(7)).toEqual([2, 7])
    for (const n of LENGTHS) {
      const d = elegantDays(n)
      expect(d).toHaveLength(elegantCount(n))
      expect(d.every((x) => x >= 2 && x <= n)).toBe(true)
      expect(new Set(d).size).toBe(d.length)
      expect([...d].sort((a, b) => a - b)).toEqual(d)
      if (d.length > 1) expect(d[d.length - 1]).toBe(n)
    }
  })
  it('feeds the screens and tonight\'s dress', () => {
    expect(dressNights(14)).toEqual(elegantDays(14))
    expect(dressTonight(elegantDays(14)[2], 14)).toBe('elegant')
    expect(dressTonight(15, 14)).toBe('casual')
  })
})

describe('nightsRules: packing and medicines', () => {
  it('scales outfits and swimsuits and suggests laundry past a week', () => {
    expect(packCounts(6)).toMatchObject({ daywear: 6, swimsuits: 2, laundry: false })
    expect(packCounts(8)).toMatchObject({ daywear: 8, laundry: false })
    expect(packCounts(14)).toMatchObject({ daywear: 8, swimsuits: 3, laundry: true })
    expect(packCounts(31).elegant).toBe(3)
  })
  it('packs every day aboard and a spare', () => {
    expect(LENGTHS.map(medicationSupplyDays)).toEqual([10, 11, 12, 14, 18, 29, 39])
  })
  it('puts these on the packing list', () => {
    const base = { departure: '2027-03-21', tours: [], ages: [40], needs: [], tender: false }
    const seven = buildPackingList({ ...base, nights: 7, elegantNights: elegantCount(7) })
    const thirty = buildPackingList({ ...base, nights: 31, elegantNights: elegantCount(31) })
    expect(seven.find((x) => x.id === 'meds')?.why).toContain('11 days')
    expect(thirty.find((x) => x.id === 'meds')?.why).toContain('39 days')
    expect(seven.some((x) => x.id === 'laundry')).toBe(false)
    expect(thirty.some((x) => x.id === 'laundry')).toBe(true)
    expect(thirty.find((x) => x.id === 'elegant')?.label).toContain('8 outfits')
  })
})

describe('nightsRules: mid-voyage nudges', () => {
  it('has none on a short cruise', () => {
    expect(midVoyageNudges(6)).toEqual([])
    expect(midVoyageNudges(7)).toEqual([])
    expect(midVoyageNudges(8)).toEqual([])
  })
  it('places them inside the voyage and grows with length', () => {
    for (const n of [10, 14, 21, 31]) for (const x of midVoyageNudges(n)) { expect(x.day).toBeGreaterThan(1); expect(x.day).toBeLessThan(n + 1) }
    expect(midVoyageNudges(10).map((x) => x.kind)).toEqual(['laundry', 'halfway'])
    expect(midVoyageNudges(14).map((x) => x.kind)).toContain('medicines')
    expect(midVoyageNudges(21).filter((x) => x.kind === 'restock').map((x) => x.day)).toEqual([14])
    expect(midVoyageNudges(31).filter((x) => x.kind === 'restock').map((x) => x.day)).toEqual([14, 21, 28])
  })
})

describe('nightsRules: clock changes', () => {
  const NY = 'America/New_York'
  it('finds the hour back from Fort Lauderdale to Belize', () => {
    const days = [
      { day: 1, date: '2027-03-21', zone: NY }, { day: 2, date: '2027-03-22', zone: NY }, { day: 3, date: '2027-03-23', zone: NY },
      { day: 4, date: '2027-03-24', zone: 'America/Belize' }, { day: 5, date: '2027-03-25', zone: 'America/Belize' },
      { day: 6, date: '2027-03-26', zone: NY }, { day: 7, date: '2027-03-27', zone: NY }, { day: 8, date: '2027-03-28', zone: NY },
    ]
    const n = clockChangeNudges(days, NY)
    expect(n.map((x) => [x.day, x.hours])).toEqual([[4, -2], [6, 2]])
    expect(n[0]).toMatchObject({ fromZone: NY, toZone: 'America/Belize' })
  })
  it('finds one change a night on a transatlantic leg', () => {
    const zones = ['America/New_York', 'America/Halifax', 'Atlantic/Azores', 'Europe/London', 'Europe/Paris']
    const days = zones.map((zone, i) => ({ day: i + 1, date: `2027-10-0${i + 1}`, zone }))
    const n = clockChangeNudges(days, 'America/New_York')
    expect(n).toHaveLength(4)
    expect(n.every((x) => x.hours > 0)).toBe(true)
    expect(n.reduce((a, x) => a + x.hours, 0)).toBe(6)
  })
  it('finds the jump onto Japan time and none when the zone holds', () => {
    const days = [{ day: 1, date: '2027-05-01', zone: 'Asia/Tokyo' }, { day: 2, date: '2027-05-02', zone: 'Asia/Tokyo' }, { day: 3, date: '2027-05-03' }]
    expect(clockChangeNudges(days, 'Asia/Tokyo')).toEqual([])
    const fromHawaii = clockChangeNudges([{ day: 1, date: '2027-05-01', zone: 'Pacific/Honolulu' }, { day: 5, date: '2027-05-05', zone: 'Asia/Tokyo' }], 'Pacific/Honolulu')
    expect(fromHawaii).toEqual([{ day: 5, hours: 19, fromZone: 'Pacific/Honolulu', toZone: 'Asia/Tokyo' }])
  })
})
