import { describe, expect, it } from 'vitest'
import { arrangeDay, interestsOf, NO_ENTERTAINMENT_FILTER, standings } from './entertainment'
import { EVENT_INTERESTS, type DatedEvent } from './program'

const MIN = 60_000
const ev = (id: string, startMin: number, interest: DatedEvent['interest'], placeId: string, status: DatedEvent['status'] = 'on'): DatedEvent => ({
  id, when: ['sea'], start: '00:00', minutes: 30, title: id, placeId, age: 'all', interest, extra: 0, day: 2, date: '2027-01-01', startAt: startMin * MIN, endAt: (startMin + 30) * MIN, status,
})
const list = [ev('a', 60, 'shows', 'arena'), ev('b', 120, 'music', 'piazza'), ev('c', 120, 'games', 'live'), ev('d', 300, 'shows', 'arena', 'cancelled')]

describe('entertainment page', () => {
  it('lists latest first or earliest first', () => {
    expect(arrangeDay(list, NO_ENTERTAINMENT_FILTER, 'latest').map((e) => e.id)).toEqual(['d', 'b', 'c', 'a'])
    expect(arrangeDay(list, NO_ENTERTAINMENT_FILTER, 'earliest').map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('narrows by kind and venue', () => {
    expect(arrangeDay(list, { interests: ['shows'], placeId: null }, 'earliest').map((e) => e.id)).toEqual(['a', 'd'])
    expect(arrangeDay(list, { interests: [], placeId: 'piazza' }, 'earliest').map((e) => e.id)).toEqual(['b'])
  })
  it('names only the kinds present', () => {
    expect(interestsOf(list, EVENT_INTERESTS)).toEqual(['shows', 'music', 'games'])
  })
  it('marks what is over, on now, next (all that start together) and later; cancelled is over', () => {
    const s = standings(list, 70 * MIN)
    expect([...s]).toEqual([['a', 'now'], ['b', 'next'], ['c', 'next'], ['d', 'over']])
    expect(standings(list, 400 * MIN).get('a')).toBe('over')
  })
})
