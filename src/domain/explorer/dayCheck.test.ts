import { describe, expect, it } from 'vitest'
import { dayCheck, hasRest, plannedHours } from './dayCheck'
import type { PlanItem } from './planTimeline'

const H = 3_600_000
const BASE = Date.UTC(2027, 5, 3, 0, 0)
function item(id: string, start: string, hours: number, over: Partial<PlanItem> = {}): PlanItem {
  const [h, m] = start.split(':').map(Number)
  const startAt = BASE + (h * 60 + m) * 60_000
  return { id, kind: 'event', explorer: 'entertainment', venueId: 'v', title: id, venueTitle: 'Venue', placeId: 'p', start, startAt, endAt: startAt + hours * H, status: 'on', ...over }
}
const dinner = (start: string) => item('d' + start, start, 1.5, { kind: 'dining', explorer: 'dining' })

describe('day check', () => {
  it('says nothing about an empty day or one with only cancelled lines', () => {
    expect(dayCheck([])).toEqual([])
    expect(dayCheck([item('a', '10:00', 1, { status: 'cancelled' })])).toEqual([])
  })
  it('names the meals still missing', () => {
    expect(dayCheck([item('show', '20:00', 1)]).filter((n) => n.id === 'meal').map((n) => (n as { meal: string }).meal)).toEqual(['breakfast', 'lunch', 'dinner'])
    expect(dayCheck([dinner('19:00'), dinner('08:30')]).some((n) => n.id === 'meal' && n.meal === 'dinner')).toBe(false)
  })
  it('does not mention a meal that has already passed today', () => {
    const notes = dayCheck([item('quiz', '15:00', 1)], 15 * 60)
    expect(notes.filter((n) => n.id === 'meal').map((n) => (n as { meal: string }).meal)).toEqual(['dinner'])
  })
  it('counts a long shore tour as covering lunch but not dinner', () => {
    const tour = item('tour', '09:00', 7, { kind: 'tour', explorer: 'excursions' as PlanItem['explorer'] })
    const meals = dayCheck([tour]).filter((n) => n.id === 'meal').map((n) => (n as { meal: string }).meal)
    expect(meals).toContain('dinner')
    expect(meals).not.toContain('lunch')
  })
  it('calls six hours with no rest a full day, and a long gap rest', () => {
    const packed = [item('a', '09:00', 3), item('b', '12:00', 3.5)]
    expect(plannedHours(packed)).toBeCloseTo(6.5)
    expect(hasRest(packed)).toBe(false)
    expect(dayCheck(packed).some((n) => n.id === 'fullDay')).toBe(true)
    const rested = [item('a', '09:00', 3), item('b', '14:00', 3.5)]
    expect(hasRest(rested)).toBe(true)
    expect(dayCheck(rested).some((n) => n.id === 'fullDay')).toBe(false)
  })
  it('counts overlapping lines once in the hours', () => {
    expect(plannedHours([item('a', '10:00', 2), item('b', '11:00', 2)])).toBeCloseTo(3)
  })
  it('reports overlaps', () => {
    expect(dayCheck([item('a', '10:00', 2), item('b', '11:00', 1)]).find((n) => n.id === 'clashes')).toEqual({ id: 'clashes', count: 2 })
  })
})
