import { describe, expect, it } from 'vitest'
import { dayPhase, eventPhase, upcomingEvents } from './upcoming'
import type { TimedEvent } from './types'

const MIN = 60_000
const NOW = 1_000 * MIN
const ev = (id: string, startOffset: number, minutes: number, status: TimedEvent['status'] = 'on'): TimedEvent => ({ id, startAt: NOW + startOffset * MIN, endAt: NOW + (startOffset + minutes) * MIN, status })
const ids = (l: TimedEvent[]) => l.map((e) => e.id)
const today = { chosenDay: 3, currentDay: 3, now: NOW }

describe('eventPhase', () => {
  it('is later before the start and now while it runs', () => {
    expect(eventPhase(ev('a', 1, 30), NOW)).toBe('later')
    expect(eventPhase(ev('a', 0, 30), NOW)).toBe('now')
    expect(eventPhase(ev('a', -29, 30), NOW)).toBe('now')
  })
  it('keeps an event for 15 minutes after it ends, counted from the end', () => {
    expect(eventPhase(ev('a', -45, 30), NOW)).toBe('justEnded')   // ended exactly 15 min ago
    expect(eventPhase(ev('a', -46, 30), NOW)).toBe('over')        // ended 16 min ago
    expect(eventPhase(ev('a', -30, 30), NOW)).toBe('justEnded')   // ended this instant
  })
})

describe('dayPhase', () => {
  it('compares the chosen day with the ship day', () => {
    expect(dayPhase(2, 3)).toBe('past')
    expect(dayPhase(3, 3)).toBe('current')
    expect(dayPhase(4, 3)).toBe('future')
  })
})

describe('upcomingEvents', () => {
  it('on the ship day drops events over for more than 15 minutes and keeps those still running', () => {
    const list = [ev('old', -120, 30), ev('edge', -45, 30), ev('long', -90, 180), ev('soon', 10, 30)]
    expect(ids(upcomingEvents(list, today))).toEqual(['long', 'edge', 'soon'])
  })
  it('lists at most three, earliest first', () => {
    const list = [ev('d', 40, 10), ev('b', 10, 10), ev('a', 5, 10), ev('c', 20, 10)]
    expect(ids(upcomingEvents(list, today))).toEqual(['a', 'b', 'c'])
    expect(ids(upcomingEvents(list, { ...today, max: 2 }))).toEqual(['a', 'b'])
  })
  it('never counts cancelled events, but lists moved ones', () => {
    const list = [ev('x', 5, 10, 'cancelled'), ev('m', 6, 10, 'moved'), ev('y', 7, 10)]
    expect(ids(upcomingEvents(list, today))).toEqual(['m', 'y'])
  })
  it('on a future day keeps the whole day from the start, even events that "would have ended" by now', () => {
    const list = [ev('early', -600, 30), ev('late', 600, 30)]
    expect(ids(upcomingEvents(list, { ...today, chosenDay: 4 }))).toEqual(['early', 'late'])
  })
  it('on a past day lists nothing', () => {
    expect(upcomingEvents([ev('a', 10, 10)], { ...today, chosenDay: 2 })).toEqual([])
  })
  it('breaks ties on the end then the id so the order is stable', () => {
    const list = [ev('b', 5, 10), ev('a', 5, 10), ev('c', 5, 5)]
    expect(ids(upcomingEvents(list, today))).toEqual(['c', 'a', 'b'])
  })
  it('does not change the list it is given', () => {
    const list = [ev('b', 20, 5), ev('a', 10, 5)]
    upcomingEvents(list, today)
    expect(ids(list)).toEqual(['b', 'a'])
  })
  it('honours a different grace', () => {
    const list = [ev('edge', -45, 30)]
    expect(upcomingEvents(list, { ...today, graceMinutes: 5 })).toEqual([])
  })
})
