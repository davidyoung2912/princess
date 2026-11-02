import { describe, expect, it } from 'vitest'
import { TAG_GROUPS } from './disembark'
import { allergyChain, askShip, bagNight, easyLeaveBy, EMPTY_FINISH, fareIndicator, fareSeries, flightAdvice, followState, giftsFor, normalizeFinish, notesFor, poolRide, sweepAllDone, SWEEP_ITEMS, tierForHabits } from './finishMore'
import { REFERENCE_SAILING } from './sailings'

const MIN = 60_000
const DAY = 24 * 60 * MIN

describe('cabin sweep and bag night', () => {
  it('is done only when every place is ticked', () => {
    expect(sweepAllDone(SWEEP_ITEMS.slice(1))).toBe(false)
    expect(sweepAllDone([...SWEEP_ITEMS])).toBe(true)
  })
  it('counts down, then says late in plain words', () => {
    expect(bagNight(10 * MIN, 0, 'none')).toEqual({ state: 'open', minutesLeft: 10 })
    expect(bagNight(10 * MIN, 11 * MIN, 'none')).toEqual({ state: 'late' })
    expect(bagNight(10 * MIN, 11 * MIN, 'out')).toEqual({ state: 'out' })
  })
})

describe('flight-aware choice', () => {
  const plan = (flightAt: string) => ({ mode: 'rideshare' as const, flightAt, flight: '', note: '' })
  it('prefers the latest way off that leaves time, and flags an impossible flight', () => {
    expect(flightAdvice(REFERENCE_SAILING, plan('20:00'), TAG_GROUPS[1], false).best).toBe('tagged')
    const early = flightAdvice(REFERENCE_SAILING, plan('07:00'), TAG_GROUPS[1], false)
    expect(early.risky).toBe(true)
    expect(early.earlyFlight).toBe(true)
  })
  it('needs more spare time in low-stress mode and leaves an hour earlier', () => {
    const rank = (o: ReturnType<typeof flightAdvice>) => o.options.filter((x) => x.fit === 'ok').length
    expect(rank(flightAdvice(REFERENCE_SAILING, plan('13:00'), TAG_GROUPS[1], true))).toBeLessThanOrEqual(rank(flightAdvice(REFERENCE_SAILING, plan('13:00'), TAG_GROUPS[1], false)))
    expect(easyLeaveBy(100 * MIN, true)).toBe(40 * MIN)
    expect(easyLeaveBy(100 * MIN, false)).toBe(100 * MIN)
  })
})

describe('ride pool', () => {
  it('splits a ride between at least two people and sums to the total', () => {
    const p = poolRide('Taxi rank', 5000, ['Ann', 'Bo', 'Cy'], (i) => `s${i}`)!
    expect(p.shares.reduce((n, s) => n + s.amount, 0)).toBe(5000)
    expect(poolRide('Taxi rank', 5000, ['Ann'], (i) => `s${i}`)).toBeNull()
    expect(poolRide('', 5000, ['A', 'B'], (i) => `s${i}`)).toBeNull()
    expect(poolRide('x', 0, ['A', 'B'], (i) => `s${i}`)).toBeNull()
  })
})

describe('after-cruise note', () => {
  const f = { consent: true, answers: {} }
  it('opens on day 3 and 7 only for a guest who agreed', () => {
    expect(followState(3, 0, 2 * DAY, f)).toBe('later')
    expect(followState(3, 0, 3 * DAY, f)).toBe('due')
    expect(followState(3, 0, 9 * DAY, { consent: false, answers: {} })).toBe('later')
    expect(followState(3, 0, 9 * DAY, { consent: true, answers: { '3': 'well' } })).toBe('answered')
  })
})

describe('ask the ship', () => {
  it('answers a known fact and never guesses', () => {
    expect(askShip('Is there an engine room tour?')?.id).toBe('engine')
    expect(askShip('What is the meaning of life')).toBeNull()
  })
})

describe('notes, chain, fare and gifts', () => {
  it('gives notes only for the chosen travellers', () => {
    expect(notesFor([])).toEqual([])
    expect(notesFor(['older'])).toHaveLength(1)
  })
  it('walks the allergy chain from flag to venues', () => {
    const c = allergyChain({ items: [], at: null }, 0)
    expect(c.steps.every((s) => !s.done)).toBe(true)
    const done = allergyChain({ items: ['nuts'], at: 0 }, 13 * 60 * MIN)
    expect(done.steps.every((s) => s.done)).toBe(true)
    expect(done.venues.length).toBeGreaterThan(0)
  })
  it('keeps the fare series steady and ranks the fare', () => {
    expect(fareSeries(REFERENCE_SAILING.id, 'balcony')).toEqual(fareSeries(REFERENCE_SAILING.id, 'balcony'))
    const i = fareIndicator(REFERENCE_SAILING.id, 'balcony')!
    expect(['low', 'typical', 'high']).toContain(i.band)
    expect(i.lowest).toBeLessThanOrEqual(i.now)
    expect(tierForHabits([])).toBe('standard')
    expect(tierForHabits(['a'])).toBe('plus')
    expect(tierForHabits(['a', 'b'])).toBe('premier')
  })
  it('respects budget, allergy and alcohol in gift ideas', () => {
    expect(giftsFor(3000, 'none', [], false).every((g) => g.cents <= 3000)).toBe(true)
    expect(giftsFor(null, 'anniversary', [], true).some((g) => g.alcohol)).toBe(false)
    expect(giftsFor(null, 'none', ['nuts'], false).some((g) => g.id === 'chocolate')).toBe(false)
  })
})

describe('normalizeFinish', () => {
  it('falls back to empty and drops bad data', () => {
    expect(normalizeFinish(undefined)).toEqual(EMPTY_FINISH)
    const n = normalizeFinish({ sweep: ['safe', 'x'], bags: 'lost', farewell: { rating: 9, moment: 'bad' }, follow: { consent: true, answers: { '3': 'well', '5': 'well', '7': 'meh' } }, travellers: ['older', 'x'] })
    expect(n.sweep).toEqual(['safe'])
    expect(n.bags).toBe('none')
    expect(n.farewell.rating).toBeNull()
    expect(n.farewell.moment).toBe('')
    expect(n.follow.answers).toEqual({ '3': 'well' })
    expect(n.travellers).toEqual(['older'])
  })
})
