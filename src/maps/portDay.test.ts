import { describe, expect, it } from 'vitest'
import { BUFFER, clock, GET_ASHORE, planPortDay, toMinutes, walkable, type Candidate } from './portDay'

const at = (lat: number, lng: number) => ({ lat, lng })
const places: Candidate[] = [
  { id: 'a', name: 'Old Town', at: at(42.4251, 18.7712), tier: 'Walk-Off / Independent' },
  { id: 'b', name: 'Fortress', at: at(42.4207, 18.7703), tier: 'Walk-Off / Independent' },
  { id: 'c', name: 'Market', at: at(42.4235, 18.769), tier: 'Walk-Off / Independent' },
  { id: 'd', name: 'Church', at: at(42.4243, 18.7725), tier: 'Local Transit / Independent' },
  { id: 'e', name: 'Far beach', at: at(42.3, 18.9), tier: 'Local Transit / Independent' },
  { id: 'f', name: 'Mainland ruins', at: at(42.1, 19.1), tier: 'Full-Day / Guided Excursion' },
]

describe('port day planner', () => {
  it('reads and writes clock times', () => {
    expect(toMinutes('07:30')).toBe(450)
    expect(clock(450)).toBe('07:30')
    expect(clock(-10)).toBe('23:50')
  })
  it('keeps walk-off places and those within 1.5 km of the first, never far ones', () => {
    expect(walkable(places).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(walkable(places.filter((p) => p.tier.startsWith('Local')))).toEqual([])
  })
  it('plans stops in time order that end before the buffer and the all-aboard time', () => {
    const p = planPortDay({ candidates: places, arrive: '08:00', allAboard: '16:30' })
    expect(p.reason).toBeNull()
    expect(p.stops.length).toBeGreaterThanOrEqual(2)
    const times = p.stops.flatMap((s) => [toMinutes(s.arriveAt), toMinutes(s.leaveAt)])
    expect([...times].sort((x, y) => x - y)).toEqual(times)
    expect(toMinutes(p.headBackBy) + p.returnWalk).toBeLessThanOrEqual(toMinutes('16:30') - BUFFER.dock)
    expect(p.spare).toBeGreaterThanOrEqual(0)
    expect(toMinutes(p.stops[0].arriveAt)).toBe(toMinutes('08:00') + GET_ASHORE.dock)
  })
  it('fits fewer stops into a short call and none into a very short one', () => {
    const long = planPortDay({ candidates: places, arrive: '08:00', allAboard: '16:30' })
    const short = planPortDay({ candidates: places, arrive: '12:00', allAboard: '15:00', visitMinutes: 60 })
    expect(short.stops.length).toBeLessThanOrEqual(long.stops.length)
    const tiny = planPortDay({ candidates: places, arrive: '12:00', allAboard: '13:30' })
    expect(tiny.reason).toBe('noTime')
    expect(tiny.stops).toEqual([])
  })
  it('allows more margin and time ashore for a tender port', () => {
    const dock = planPortDay({ candidates: places, arrive: '08:00', allAboard: '13:00' })
    const tender = planPortDay({ candidates: places, arrive: '08:00', allAboard: '13:00', tender: true })
    expect(tender.usable).toBe(dock.usable - (GET_ASHORE.tender - GET_ASHORE.dock) - (BUFFER.tender - BUFFER.dock))
  })
  it('makes room for a meal and never lets the stops exceed the maximum', () => {
    const noMeal = planPortDay({ candidates: places, arrive: '08:00', allAboard: '16:30' })
    const meal = planPortDay({ candidates: places, arrive: '08:00', allAboard: '16:30', mealMinutes: 60 })
    expect(meal.meal).toBe(60)
    expect(meal.spare).toBeLessThanOrEqual(noMeal.spare)
    expect(planPortDay({ candidates: places, arrive: '08:00', allAboard: '16:30', maxStops: 2 }).stops).toHaveLength(2)
  })
  it('says so when the port has too few walking places', () => {
    expect(planPortDay({ candidates: places.slice(4), arrive: '08:00', allAboard: '16:30' }).reason).toBe('fewPlaces')
    expect(planPortDay({ candidates: [places[0]], arrive: '08:00', allAboard: '16:30' }).reason).toBe('fewPlaces')
  })
  it('walks slower at an easy pace and so fits no more than at a steady one', () => {
    const steady = planPortDay({ candidates: places, arrive: '09:00', allAboard: '14:00' })
    const easy = planPortDay({ candidates: places, arrive: '09:00', allAboard: '14:00', pace: 'easy' })
    expect(easy.walking).toBeGreaterThanOrEqual(steady.walking === 0 ? 0 : 1)
    expect(easy.stops.length).toBeLessThanOrEqual(steady.stops.length)
  })
})
