import { describe, expect, it } from 'vitest'
import {
  addBag, buildJourney, EMPTY_JOURNEY, EMPTY_JOURNEY_STATE, flightStatus, flyEarlyAdvice, hotelHandoff, latestComfortableLanding, markBagPhotographed, minutesToWindow, normalizeJourney, removeBag,
  routeConditions, statusFor, toggleIn, validFlightNumber, watchDelay, MAX_BAGS, type JourneyPlan,
} from './journey'

const DEP = '2027-03-21'
const fly = (over: Partial<JourneyPlan> = {}): JourneyPlan => ({ ...EMPTY_JOURNEY, mode: 'fly', landing: '08:00', windowStart: '11:00', ...over })

describe('buildJourney', () => {
  it('works from landing to the terminal and reports the spare time', () => {
    const j = buildJourney(fly(), DEP)
    // 08:00 + 50 + 35 = 09:25 at the terminal; the gangway closes at 13:30.
    expect(j.slack).toBe(245)
    expect(j.status).toBe('onTrack')
    expect(j.legs.map((l) => l.id)).toEqual(['flight', 'airport', 'transfer', 'terminal'])
  })
  it('a delay moves every leg and can put the guest at risk', () => {
    const j = buildJourney(fly({ landing: '11:00' }), DEP, 60)
    expect(j.slack).toBe(5)
    expect(j.status).toBe('atRisk')
  })
  it('a carry-on is quicker out of the airport', () => {
    expect(buildJourney(fly({ carryOnOnly: true }), DEP).slack).toBe(245 + 25)
  })
  it('a cancelled flight is a severe delay', () => {
    expect(buildJourney(fly(), DEP, watchDelay({ source: 'sim', state: 'cancelled', delayMinutes: 0 })).status).toBe('atRisk')
  })
  it('staying the night before takes the flight out of the day', () => {
    const j = buildJourney(fly({ hotelNight: true, landing: '23:00' }), DEP)
    expect(j.status).toBe('onTrack')
    expect(j.legs[0].id).toBe('hotel')
    expect(j.leaveBy).not.toBeNull()
  })
  it('driving sets the leave time from the road minutes', () => {
    const j = buildJourney({ ...EMPTY_JOURNEY, mode: 'drive', roadMinutes: 120, windowStart: '11:00' }, DEP)
    expect(j.leaveBy).toBe(buildJourney({ ...EMPTY_JOURNEY, mode: 'drive', roadMinutes: 120, windowStart: '11:00' }, DEP).atTerminal - 120 * 60_000)
    expect(j.status).toBe('onTrack')
  })
  it('flags a guest who arrives after their window ends', () => {
    expect(buildJourney({ ...EMPTY_JOURNEY, mode: 'drive', windowStart: '11:00' }, DEP, 45).pastWindow).toBe(true)
    expect(buildJourney({ ...EMPTY_JOURNEY, mode: 'drive', windowStart: '11:00' }, DEP, 10).pastWindow).toBe(false)
  })
  it('statusFor uses the stated thresholds', () => {
    expect([statusFor(120), statusFor(119), statusFor(60), statusFor(59), statusFor(-5)]).toEqual(['onTrack', 'tight', 'tight', 'atRisk', 'atRisk'])
  })
})

describe('flyEarlyAdvice', () => {
  it('recommends the night before when the margin is thin and not otherwise', () => {
    expect(flyEarlyAdvice(fly({ landing: '10:10' }), DEP).reason).toBe('tight')
    expect(flyEarlyAdvice(fly({ landing: '11:10' }), DEP).reason).toBe('late')
    expect(flyEarlyAdvice(fly({ landing: '08:00' }), DEP).recommend).toBe(false)
    expect(flyEarlyAdvice(fly({ landing: '11:00', hotelNight: true }), DEP).reason).toBe('staying')
    expect(flyEarlyAdvice({ ...EMPTY_JOURNEY, mode: 'drive' }, DEP).recommend).toBe(false)
  })
  it('a flight delay changes the advice', () => {
    expect(flyEarlyAdvice(fly({ landing: '09:00' }), DEP).recommend).toBe(false)
    expect(flyEarlyAdvice(fly({ landing: '09:00' }), DEP, 120).recommend).toBe(true)
  })
  it('names a landing time that would be comfortable', () => {
    const latest = latestComfortableLanding({ carryOnOnly: false })
    expect(buildJourney(fly({ landing: latest }), DEP).slack).toBeGreaterThanOrEqual(120)
  })
  it('puts both costs side by side', () => {
    const a = flyEarlyAdvice(fly(), DEP)
    expect(a.hotelCostCents).toBeLessThan(a.missedCostCents)
  })
})

describe('flight watch (simulated)', () => {
  it('accepts airline code and number only', () => {
    expect(validFlightNumber('aa 1234')).toBe(true)
    expect(validFlightNumber('A1234')).toBe(false)
    expect(validFlightNumber('AA12345')).toBe(false)
    expect(flightStatus('nope', DEP)).toBeNull()
  })
  it('is stable for a flight and date, and labelled as a simulation', () => {
    const a = flightStatus('AA1234', DEP)!
    expect(flightStatus('aa 1234', DEP)).toEqual(a)
    expect(a.source).toBe('sim')
  })
  it('mostly on time, with some delays and rare cancellations', () => {
    const states = Array.from({ length: 400 }, (_, i) => flightStatus(`UA${i + 1}`, DEP)!.state)
    const share = (s: string) => states.filter((x) => x === s).length / 400
    expect(share('onTime')).toBeGreaterThan(0.5)
    expect(share('delayed')).toBeGreaterThan(0.1)
    expect(share('cancelled')).toBeGreaterThan(0)
    expect(share('cancelled')).toBeLessThan(0.1)
  })
})

describe('conditions and hotel', () => {
  it('heavy traffic and storms add time', () => {
    const c = routeConditions(DEP, '12:00')
    expect(c.traffic).toBe('heavy')
    expect(c.leaveEarlierMinutes).toBeGreaterThanOrEqual(20)
    expect(routeConditions(DEP, '11:00').traffic).toBe('light')
    expect(routeConditions(DEP, '11:00').source).toBe('sim')
  })
  it('the hotel leave time counts the road and checkout', () => {
    const h = hotelHandoff(fly({ hotelNight: true }), DEP, 10)
    expect(h.checkoutBy).toBe(h.leaveHotel - 30 * 60_000)
    expect(buildJourney(fly({ hotelNight: true }), DEP).legs[0].start).toBe(hotelHandoff(fly({ hotelNight: true }), DEP).checkoutBy)
  })
  it('counts the minutes to the window', () => {
    const open = buildJourney({ ...EMPTY_JOURNEY, mode: 'drive', windowStart: '11:00', roadMinutes: 60 }, DEP).atTerminal
    expect(minutesToWindow(open - 90 * 60_000, DEP, '11:00')).toBe(90)
    expect(minutesToWindow(open + 5 * 60_000, DEP, '11:00')).toBe(-5)
  })
})

describe('packing and the bag log', () => {
  it('toggles items', () => {
    expect(toggleIn(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleIn(['a', 'b'], 'a')).toEqual(['b'])
  })
  it('adds, marks and removes bags, limited and trimmed', () => {
    let s = addBag(EMPTY_JOURNEY_STATE, '  Blue suitcase ', 'b1')
    expect(s.bags).toEqual([{ id: 'b1', label: 'Blue suitcase', photographedAt: null }])
    expect(addBag(s, '   ', 'x')).toBe(s)
    s = markBagPhotographed(s, 'b1', 123)
    expect(s.bags[0].photographedAt).toBe(123)
    expect(removeBag(s, 'b1').bags).toEqual([])
    for (let i = 0; i < 20; i++) s = addBag(s, `bag ${i}`, `i${i}`)
    expect(s.bags).toHaveLength(MAX_BAGS)
  })
  it('repairs bad stored data', () => {
    expect(normalizeJourney(null)).toEqual(EMPTY_JOURNEY_STATE)
    const n = normalizeJourney({ plan: { mode: 'boat', roadMinutes: 5, landing: 'x', flightNumber: 'aa 12345678' }, carryOn: ['documents', 'nope'], bags: [{ id: 1 }, { id: 'a', label: 'ok', photographedAt: 'x' }] })
    expect(n.plan.mode).toBe('fly')
    expect(n.plan.roadMinutes).toBe(EMPTY_JOURNEY.roadMinutes)
    expect(n.plan.landing).toBe(EMPTY_JOURNEY.landing)
    expect(n.plan.flightNumber.length).toBeLessThanOrEqual(6)
    expect(n.carryOn).toEqual(['documents'])
    expect(n.bags).toEqual([{ id: 'a', label: 'ok', photographedAt: null }])
  })
})
