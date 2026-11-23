import { describe, expect, it } from 'vitest'
import type { HoursDay } from '../../../shared/api/explorerTypes'
import { cancelledListed, clashesWith, fillingUp, filterVenues, kindsOf, mealOver, openState } from './presentation'

const hours = (windows: [string, string][], closedBecause: HoursDay['closedBecause'] = null): HoursDay => ({ windows, staffed: [], closedBecause })

describe('openState', () => {
  const dinner = hours([['17:30', '21:30']])
  it('is open now inside a window, and says until when', () => {
    expect(openState(dinner, 3, 3, '17:30')).toEqual({ kind: 'openNow', until: '21:30' })
    expect(openState(dinner, 3, 3, '21:29')).toEqual({ kind: 'openNow', until: '21:30' })
  })
  it('opens later before the window and is closed after it', () => {
    expect(openState(dinner, 3, 3, '12:00')).toEqual({ kind: 'opensAt', at: '17:30' })
    expect(openState(dinner, 3, 3, '21:30')).toEqual({ kind: 'closedNow' })
  })
  it('lists the first opening on a future day and says a past day has finished', () => {
    expect(openState(dinner, 5, 3, '23:00')).toEqual({ kind: 'opensAt', at: '17:30' })
    expect(openState(dinner, 2, 3, '12:00')).toEqual({ kind: 'finished' })
  })
  it('says why a venue with no hours is shut', () => {
    expect(openState(hours([], 'alongside'), 3, 3, '12:00')).toEqual({ kind: 'alongside' })
    expect(openState(hours([], 'none'), 3, 3, '12:00')).toEqual({ kind: 'closedDay' })
  })
  it('knows a venue open all day', () => {
    expect(openState(hours([['00:00', '24:00']]), 3, 3, '03:00')).toEqual({ kind: 'openAllDay' })
  })
  it('picks the next of several windows', () => {
    const two = hours([['07:00', '09:30'], ['12:00', '13:30']])
    expect(openState(two, 2, 2, '10:00')).toEqual({ kind: 'opensAt', at: '12:00' })
  })
})

describe('clashesWith', () => {
  const e = { id: 'a', startAt: 100, endAt: 200 }
  it('finds overlaps but not touching ends or itself', () => {
    const others = [{ id: 'b', title: 'b', startAt: 150, endAt: 250 }, { id: 'c', title: 'c', startAt: 200, endAt: 300 }, { id: 'a', title: 'a', startAt: 100, endAt: 200 }]
    expect(clashesWith(e, others).map((o) => o.id)).toEqual(['b'])
  })
})

describe('filterVenues', () => {
  const vs = [{ kind: 'main', title: 'Soleil', short: 'Traditional', long: 'Fixed seating' }, { kind: 'bar', title: 'Vines', short: 'Wine', long: 'Tapas' }]
  it('filters by kind and by every word', () => {
    expect(filterVenues(vs, { kind: 'bar', query: '' }).map((v) => v.title)).toEqual(['Vines'])
    expect(filterVenues(vs, { kind: null, query: 'fixed soleil' }).map((v) => v.title)).toEqual(['Soleil'])
    expect(filterVenues(vs, { kind: null, query: 'zzz' })).toEqual([])
  })
  it('lists kinds in first-seen order', () => { expect(kindsOf([...vs, ...vs])).toEqual(['main', 'bar']) })
})

describe('cancelledListed and fillingUp', () => {
  const MIN = 60_000
  const e = (id: string, startAt: number, endAt: number, status: 'on' | 'cancelled') => ({ id, startAt, endAt, status })
  it('lists cancelled events that would still show, not the finished ones or any on a past day', () => {
    const now = 1_000 * MIN
    const list = [e('later', now + 10 * MIN, now + 60 * MIN, 'cancelled'), e('old', now - 90 * MIN, now - 60 * MIN, 'cancelled'), e('on', now, now + MIN, 'on')]
    expect(cancelledListed(list, { chosenDay: 3, currentDay: 3, now }).map((x) => x.id)).toEqual(['later'])
    expect(cancelledListed(list, { chosenDay: 4, currentDay: 3, now }).map((x) => x.id)).toEqual(['old', 'later'])
    expect(cancelledListed(list, { chosenDay: 2, currentDay: 3, now })).toEqual([])
  })
  it('says nearly full from a quarter or three places left, but not when full or unlimited', () => {
    expect(fillingUp({ capacity: 12, left: 3 })).toBe(true)
    expect(fillingUp({ capacity: 40, left: 10 })).toBe(true)
    expect(fillingUp({ capacity: 40, left: 11 })).toBe(false)
    expect(fillingUp({ capacity: 12, left: 0 })).toBe(false)
    expect(fillingUp({})).toBe(false)
  })
})

describe('mealOver', () => {
  const lunch = { from: '12:00', to: '14:00' }
  it('is over on past days, never on future days', () => {
    expect(mealOver(lunch, 1, 2, '09:00')).toBe(true)
    expect(mealOver(lunch, 3, 2, '23:00')).toBe(false)
  })
  it('on the current day is over once the end time has come', () => {
    expect(mealOver(lunch, 2, 2, '13:59')).toBe(false)
    expect(mealOver(lunch, 2, 2, '14:00')).toBe(true)
  })
  it('keeps a meal that runs past midnight open', () => {
    expect(mealOver({ from: '22:00', to: '01:00' }, 2, 2, '23:30')).toBe(false)
  })
})
