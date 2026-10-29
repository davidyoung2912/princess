import { describe, expect, it } from 'vitest'
import { clockAt, clockNow, CLOCK_SPEEDS, normalizeClock, setClockSpeed, stepClock } from './clock'
import { clockView } from './clockView'
import { balances, computeEntitlements, sourceOf } from './entitlements'
import { PERSONAS, partyOf, personaById, visibleTo } from './personas'
import { allAboardEpoch, itinerary, portAt, REFERENCE_SAILING, SAILINGS, shipClockChanges, shipZoneAt, STAGE_IDS, stageAt, stageStarts, timeForStage } from './sailings'
import { activeFaults, appliesTo, SCENARIOS, targetMatches } from './scenarios'
import { addDays, dateIn, offsetMinutes, zonedToEpoch } from './timezones'

const march = REFERENCE_SAILING
const sailing = (departure: string) => SAILINGS.find((s) => s.departure === departure)!

describe('time zones', () => {
  it('knows the March 2027 daylight-saving difference between Florida and Cozumel', () => {
    const at = zonedToEpoch('2027-03-23', '12:00', 'America/Cancun')
    expect(offsetMinutes(at, 'America/New_York')).toBe(-240) // Eastern daylight time from 14 March
    expect(offsetMinutes(at, 'America/Cancun')).toBe(-300) // Cozumel stays on standard time
    expect(offsetMinutes(at, 'America/Belize')).toBe(-360)
    expect(offsetMinutes(at, 'America/Tegucigalpa')).toBe(-360)
  })
  it('converts wall-clock time to a moment and back', () => {
    const at = zonedToEpoch('2027-03-21', '15:00', 'America/New_York')
    expect(new Date(at).toISOString()).toBe('2027-03-21T19:00:00.000Z')
    expect(dateIn(at, 'America/New_York')).toBe('2027-03-21')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })
})

describe('sailings', () => {
  it('has 6 to 8 Sunday departures between Nov 2026 and Mar 2027 including the reference sailing', () => {
    expect(SAILINGS.length).toBeGreaterThanOrEqual(6)
    expect(SAILINGS.length).toBeLessThanOrEqual(8)
    for (const s of SAILINGS) {
      expect(new Date(`${s.departure}T12:00:00Z`).getUTCDay(), s.id).toBe(0)
      expect(s.departure >= '2026-11-01' && s.departure <= '2027-03-31').toBe(true)
    }
    expect(march.departure).toBe('2027-03-21')
    expect(new Set(SAILINGS.map((s) => s.id)).size).toBe(SAILINGS.length)
  })
  it('follows the reference itinerary', () => {
    const days = itinerary(march)
    expect(days.map((d) => d.port)).toEqual(['fll', 'sea', 'cozumel', 'belize', 'roatan', 'sea', 'sea', 'fll'])
    expect(days[7].date).toBe('2027-03-28')
  })
  it('moves the ship clock two hours on the reference sailing but one hour earlier in the winter', () => {
    const [out, back] = shipClockChanges(march)
    expect(out.hours).toBe(-2)
    expect(back.hours).toBe(2)
    expect(shipClockChanges(sailing('2027-02-28'))[0].hours).toBe(-1)
    expect(shipZoneAt(march, out.at - 1)).toBe('America/New_York')
    expect(shipZoneAt(march, out.at)).toBe('America/Belize')
    expect(shipZoneAt(march, back.at)).toBe('America/New_York')
  })
  it('knows where the ship is', () => {
    const at = (date: string, time: string, zone: string) => zonedToEpoch(date, time, zone)
    expect(portAt(march, at('2027-03-22', '12:00', 'America/New_York')).port).toBe('sea')
    expect(portAt(march, at('2027-03-23', '09:00', 'America/Cancun')).port).toBe('cozumel')
    expect(portAt(march, at('2027-03-23', '18:00', 'America/Cancun')).port).toBe('sea')
    expect(portAt(march, at('2027-03-24', '10:00', 'America/Belize')).port).toBe('belize')
    expect(portAt(march, at('2027-03-25', '08:30', 'America/Tegucigalpa')).port).toBe('roatan')
  })
  it('states all-aboard in the port zone', () => {
    expect(new Date(allAboardEpoch(march, 3)!).toISOString()).toBe('2027-03-23T21:30:00.000Z')
    expect(allAboardEpoch(march, 2)).toBeNull()
  })
  it('has stages in order, each landing in itself', () => {
    expect(STAGE_IDS).toEqual(stageStarts(march).map((s) => s.id))
    for (const s of SAILINGS) {
      const starts = stageStarts(s)
      for (let i = 1; i < starts.length; i++) expect(starts[i].at, `${s.id} ${starts[i].id}`).toBeGreaterThan(starts[i - 1].at)
      for (const id of STAGE_IDS) expect(stageAt(s, timeForStage(s, id)), `${s.id} ${id}`).toBe(id)
    }
    expect(stageAt(march, 0)).toBe('booked')
  })
})

describe('three clocks', () => {
  it('shows ship, port and phone time that differ on a port day', () => {
    const at = zonedToEpoch('2027-03-23', '10:00', 'America/Cancun')
    const view = clockView(march, at, 'America/Chicago')
    expect(view.readings.map((r) => r.kind)).toEqual(['ship', 'port', 'phone'])
    expect(view.readings[0].time).toBe('11:00 am')
    expect(view.readings[1].time).toBe('10:00 am')
    expect(view.readings[2].time).toBe('10:00 am')
    expect(view.portVsShip).toBe(-1)
    expect(view.phoneVsShip).toBe(-1)
  })
  it('leaves port time out at sea', () => {
    const view = clockView(march, zonedToEpoch('2027-03-22', '10:00', 'America/New_York'), 'America/New_York')
    expect(view.readings.map((r) => r.kind)).toEqual(['ship', 'phone'])
    expect(view.portVsShip).toBeNull()
  })
})

describe('demo clock', () => {
  it('runs from its anchor at its speed and can be stopped', () => {
    const c = clockAt(1000, 5000, 60)
    expect(clockNow(c, 7000)).toBe(1000 + 2000 * 60)
    expect(clockNow(setClockSpeed(c, 0, 7000), 99_000)).toBe(121_000)
    expect(clockNow(stepClock(clockAt(0, 0), 3_600_000, 10), 10)).toBe(3_600_010)
  })
  it('replaces damaged stored clocks', () => {
    const fallback = clockAt(5, 5)
    expect(normalizeClock({ anchorDemo: 'x', anchorReal: 1, speed: 1 }, fallback)).toEqual(fallback)
    expect(normalizeClock({ anchorDemo: 1, anchorReal: 2, speed: 7 }, fallback)).toEqual(fallback)
    expect(normalizeClock({ anchorDemo: 1, anchorReal: 2, speed: CLOCK_SPEEDS[2] }, fallback)).toEqual({ anchorDemo: 1, anchorReal: 2, speed: 60 })
  })
})

describe('personas', () => {
  it('has the twelve people: four on their own and two families of four', () => {
    expect(PERSONAS).toHaveLength(12)
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(12)
    expect(PERSONAS.filter((p) => p.group === 'solo')).toHaveLength(4)
    expect(PERSONAS.filter((p) => p.group === 'harper')).toHaveLength(4)
    expect(PERSONAS.filter((p) => p.group === 'brennan')).toHaveLength(4)
  })
  it('starts Gerald on Large text and everyone else on standard', () => {
    expect(personaById('gerald')!.defaultTextSize).toBe('large')
    expect(PERSONAS.filter((p) => p.id !== 'gerald').every((p) => p.defaultTextSize === 'standard')).toBe(true)
  })
  it('marks children as supervised and families as parties under one booker', () => {
    expect(PERSONAS.filter((p) => p.child).map((p) => p.id).sort()).toEqual(['ethan', 'lucas', 'maya', 'sofia'])
    expect(partyOf('maya').map((p) => p.id).sort()).toEqual(['daniel', 'ethan', 'maya', 'priya'])
    expect(partyOf('gerald')).toHaveLength(1)
  })
  it('keeps solo personas isolated and families visible only to each other', () => {
    for (const id of ['gerald', 'maria', 'linda', 'alexander'] as const) expect(visibleTo(id)).toEqual([])
    expect(visibleTo('daniel').some((p) => p.group === 'solo')).toBe(false)
    expect(visibleTo('daniel').map((p) => p.id)).toContain('marcus')
    expect(visibleTo('daniel').map((p) => p.id)).not.toContain('daniel')
  })
})

describe('entitlements', () => {
  const of = (id: Parameters<typeof personaById>[0]) => computeEntitlements(sourceOf(personaById(id)!))
  it('gives nothing extra to a first-timer with no package', () => {
    expect(of('maria')).toMatchObject({ drinkCapUsd: 0, wifiDevices: 0, specialtyMeals: 0, gratuitiesIncluded: false, diningWindow: 'afterFullPayment' })
  })
  it('opens dining at booking for Platinum and Elite only', () => {
    expect(of('gerald').diningWindow).toBe('atBooking')
    expect(of('alexander').diningWindow).toBe('atBooking')
    expect(of('linda').diningWindow).toBe('afterFullPayment')
  })
  it('adds package, tier and suite entitlements together', () => {
    const a = of('alexander')
    expect(a.drinkCapUsd).toBe(20)
    expect(a.wifiDevices).toBe(6)
    expect(a.specialtyMeals).toBe(4)
    expect(a.perks).toContain('suiteLounge')
    expect(of('daniel')).toMatchObject({ drinkCapUsd: 15, wifiDevices: 1, gratuitiesIncluded: true })
  })
  it('keeps used and remaining sensible', () => {
    const b = balances(of('daniel'), { specialtyMeals: 1, wifiDevices: 5 })
    expect(b.specialtyMeals).toEqual({ total: 2, used: 1, remaining: 1 })
    expect(b.wifiDevices).toEqual({ total: 1, used: 1, remaining: 0 })
  })
})

describe('scenarios', () => {
  it('covers the fifteen scenarios and steers every persona into at least two', () => {
    expect(SCENARIOS).toHaveLength(16)
    for (const p of PERSONAS) expect(SCENARIOS.filter((s) => appliesTo(s, p.id)).length, p.id).toBeGreaterThanOrEqual(2)
  })
  it('has unique ids, valid stages and unique fault rule ids', () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length)
    const rules = SCENARIOS.flatMap((s) => s.faults.map((f) => f.id))
    expect(new Set(rules).size).toBe(rules.length)
    for (const s of SCENARIOS) expect(STAGE_IDS).toContain(s.stage)
  })
  it('matches fault targets', () => {
    expect(targetMatches('*', 'orders.place')).toBe(true)
    expect(targetMatches('orders.*', 'orders.place')).toBe(true)
    expect(targetMatches('orders.*', 'ordersx.place')).toBe(false)
    expect(targetMatches('orders.place', 'orders.list')).toBe(false)
    expect(activeFaults(['bookingLag']).map((r) => r.target)).toEqual(['bookings.get'])
    expect(activeFaults([])).toEqual([])
  })
})
