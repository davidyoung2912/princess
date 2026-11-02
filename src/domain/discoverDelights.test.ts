import { describe, expect, it } from 'vitest'
import type { Place } from './deck'
import {
  bearing, cabinNeighbours, cabinWalks, canFlip, costPerDay, dayOn, dayStrip, flipHint, flipPick, LAND_HOLIDAY_PER_DAY, leftOff, stripSummary, sunByDay, walkMinutes,
} from './discoverDelights'

const days = [
  { day: 1, port: 'fll', depart: '16:00' },
  { day: 2, port: 'sea' },
  { day: 3, port: 'cozumel', arrive: '08:00', depart: '17:00' },
  { day: 4, port: 'belize', arrive: '07:00', depart: '16:00' },
  { day: 5, port: 'sea' },
  { day: 6, port: 'fll', arrive: '07:00' },
] as const

describe('dayStrip (D1-2)', () => {
  const strip = dayStrip(days, new Set(['belize']))
  it('marks sea, home, dock and tender days with hours in port', () => {
    expect(strip.map((s) => s.kind)).toEqual(['home', 'sea', 'dock', 'tender', 'sea', 'home'])
    expect(strip[2].hours).toBe(9)
    expect(strip[1].hours).toBeNull()
    expect(strip[0].hours).toBeNull()
  })
  it('counts days by kind', () => { expect(stripSummary(strip)).toEqual({ sea: 2, ports: 2, tender: 1 }) })
  it('wraps a departure after midnight', () => { expect(dayStrip([{ day: 1, port: 'cozumel', arrive: '20:00', depart: '01:00' }], new Set())[0].hours).toBe(5) })
  it('is empty for no days', () => { expect(dayStrip([], new Set())).toEqual([]) })
})

describe('sunByDay (D1-4)', () => {
  const coords = { fll: [-80, 26] as const, cozumel: [-87, 20] as const, belize: [-88, 17] as const }
  it('gives bearings in compass degrees', () => {
    expect(Math.round(bearing([0, 0], [0, 10]))).toBe(0)
    expect(Math.round(bearing([0, 0], [10, 0]))).toBe(90)
    expect(Math.round(bearing([0, 0], [0, -10]))).toBe(180)
  })
  it('puts the morning sun on one side and the afternoon sun on the other when sailing south-west', () => {
    const port = sunByDay(days.slice(0, 3), coords, 'port')[1]
    const star = sunByDay(days.slice(0, 3), coords, 'starboard')[1]
    expect(port.heading).toBeGreaterThan(180)
    expect(port.heading).toBeLessThan(270)
    expect([port.morning, star.morning].sort()).toEqual([false, true])
    expect(port.morning).not.toBe(port.afternoon)
    expect(star.morning).not.toBe(star.afternoon)
  })
  it('claims nothing on a port day or when a port has no position', () => {
    expect(sunByDay(days, coords, 'port')[2]).toEqual({ day: 3, heading: null, morning: false, afternoon: false })
    expect(sunByDay(days, {}, 'port')[1].heading).toBeNull()
  })
})

describe('cabinWalks (D1-5)', () => {
  it('gives each target a whole number of minutes of at least one', () => {
    const w = cabinWalks({ deck: 12, position: 'aft' })
    expect(w.lift).toEqual({ bank: 'E', minutes: 1 })
    for (const x of w.walks) { expect(Number.isInteger(x.minutes)).toBe(true); expect(x.minutes).toBeGreaterThanOrEqual(1) }
  })
  it('takes longer to go further, and is a minute on the same deck and section', () => {
    const here: Place = { id: 'a', name: 'A', deck: 9, section: 'midship', kind: 'dining', stepFree: true }
    const aft: Place = { ...here, id: 'b', section: 'aft' }
    const up: Place = { ...here, id: 'c', deck: 17 }
    expect(walkMinutes(here, here)).toBe(1)
    expect(walkMinutes(here, up)!).toBeGreaterThan(walkMinutes(here, aft)!)
  })
})

describe('cabinNeighbours (D1-6)', () => {
  const p = (id: string, deck: number, kind: Place['kind']): Place => ({ id, name: id, deck, section: 'aft', kind, stepFree: true })
  it('warns of a pool above and a bar below', () => {
    expect(cabinNeighbours({ deck: 16, position: 'aft' }, [p('pool', 17, 'pool')]).noise).toBe('noisy')
    expect(cabinNeighbours({ deck: 8, position: 'aft' }, [p('bar', 7, 'bar')]).noise).toBe('noisy')
  })
  it('is only "maybe" for a shop, and quiet when nothing is listed', () => {
    expect(cabinNeighbours({ deck: 7, position: 'aft' }, [p('shop', 8, 'shop')]).noise).toBe('maybe')
    expect(cabinNeighbours({ deck: 11, position: 'aft' }, [p('shop', 8, 'shop')]).noise).toBe('quiet')
  })
  it('ignores other sections', () => {
    expect(cabinNeighbours({ deck: 16, position: 'forward' }, [p('pool', 17, 'pool')]).above).toEqual([])
  })
})

describe('leftOff (D1-7)', () => {
  it('counts cabins and distinct decks', () => {
    expect(leftOff([{ number: '9123' }, { number: '9210' }])).toEqual({ count: 2, decks: [9] })
    expect(leftOff([{ number: '12045' }, { number: '9123' }])).toEqual({ count: 2, decks: [9, 12] })
  })
  it('is null when nothing was compared and tolerates odd numbers', () => {
    expect(leftOff([])).toBeNull()
    expect(leftOff([{ number: 'x' }])).toEqual({ count: 1, decks: [] })
  })
})

describe('dayOn (D0-3)', () => {
  it('finds the day on a date and nothing outside the sailing', () => {
    const list = [{ date: '2027-03-21', n: 1 }, { date: '2027-03-22', n: 2 }]
    expect(dayOn(list, '2027-03-22')?.n).toBe(2)
    expect(dayOn(list, '2027-04-01')).toBeUndefined()
  })
})

describe('costPerDay (D0-6)', () => {
  it('divides by guests and by the days aboard (nights plus one)', () => {
    expect(costPerDay(280_000, 2, 7)?.perDay).toBe(17_500)
  })
  it('places the figure against the land range', () => {
    expect(costPerDay(280_000, 2, 7)?.position).toBe('below')
    expect(costPerDay(LAND_HOLIDAY_PER_DAY.low * 8, 1, 7)?.position).toBe('within')
    expect(costPerDay(LAND_HOLIDAY_PER_DAY.high * 8 + 800, 1, 7)?.position).toBe('above')
  })
  it('is null for no usable total and copes with zero guests and nights', () => {
    expect(costPerDay(0, 2, 7)).toBeNull()
    expect(costPerDay(NaN, 2, 7)).toBeNull()
    expect(costPerDay(1000, 0, 0)?.perDay).toBe(500)
  })
})

describe('gut-check flip (D0-1)', () => {
  it('picks by the random number and reads the reaction', () => {
    expect(flipPick(0.1)).toBe(0)
    expect(flipPick(0.5)).toBe(1)
    expect(flipHint(0, true)).toBe(0)
    expect(flipHint(0, false)).toBe(1)
    expect(flipHint(1, false)).toBe(0)
  })
  it('needs two different sailings', () => {
    expect(canFlip('a', 'b')).toBe(true)
    expect(canFlip('a', 'a')).toBe(false)
    expect(canFlip('', 'a')).toBe(false)
  })
})
