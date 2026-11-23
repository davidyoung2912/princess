import { describe, expect, it } from 'vitest'
import type { SpaView } from '../../../shared/api/spaTypes'
import type { DiningView, ExcursionsView } from '../../../shared/api/types'
import { groupByDay, reservationScope, tripClashes, tripItems } from './reservationsByDay'

const dates = ['2027-03-20', '2027-03-21', '2027-03-22']
const atMs = (date: string, time: string) => Date.parse(`${date}T${time}:00Z`)
const dining = { reservations: [
  { id: 'r2', venueId: 'crown', day: 2, time: '19:00', guests: [] },
  { id: 'r1', venueId: 'sabatini', day: 1, time: '18:30', guests: [] },
  { id: 'r9', venueId: 'crown', day: 9, time: '19:00', guests: [] },
] } as unknown as DiningView
const spa = { appointments: [{ id: 'a1', venueId: 'lotus', title: 'Massage', day: 2, time: '19:30', minutes: 50, startAt: atMs(dates[1], '19:30') }] } as unknown as SpaView
const tours = {
  offers: [{ item: { id: 'x1', name: 'Reef', start: '09:00' }, date: dates[2], day: 3, backBy: '15:00' }],
  booked: [{ id: 'b1', excursionId: 'x1', status: 'booked' }, { id: 'b2', excursionId: 'x1', status: 'cancelled' }],
} as unknown as ExcursionsView
const items = () => tripItems({ dining, spa, tours, dates, diningTitle: (id) => id.toUpperCase(), atMs })

describe('reservationScope', () => {
  it('defaults to the whole trip before sailing and to the day after, and obeys ?view=', () => {
    expect(reservationScope(null, 'ahead')).toBe('trip')
    expect(reservationScope(null, 'aboard')).toBe('day')
    expect(reservationScope('day', 'ahead')).toBe('day')
    expect(reservationScope('trip', 'aboard')).toBe('trip')
    expect(reservationScope('junk', 'after')).toBe('day')
  })
})

describe('tripItems', () => {
  it('merges dinners, treatments and live tours in time order and leaves out days the sailing does not have', () => {
    expect(items().map((i) => i.id)).toEqual(['r1', 'r2', 'a1', 'b1'])
  })
  it('links each to the Explorer that owns it', () => {
    expect(items().map((i) => i.to)).toEqual(['/dining-today/sabatini?day=1', '/dining-today/crown?day=2', '/spa-explorer/lotus?day=2', '/excursions-explorer/x1?day=3'])
  })
  it('copes with views that have not loaded', () => {
    expect(tripItems({ dining: null, spa: null, tours: null, dates, diningTitle: String, atMs })).toEqual([])
  })
  it('flags a treatment that overlaps a dinner', () => {
    const clashes = tripClashes(items())
    expect(clashes.get('a1')?.map((i) => i.id)).toEqual(['r2'])
    expect(clashes.has('r1')).toBe(false)
  })
})

describe('groupByDay', () => {
  it('groups by day in day order, each day in time order', () => {
    const g = groupByDay(items())
    expect(g.map((d) => [d.day, d.date, d.items.map((i) => i.id)])).toEqual([[1, dates[0], ['r1']], [2, dates[1], ['r2', 'a1']], [3, dates[2], ['b1']]])
  })
})
