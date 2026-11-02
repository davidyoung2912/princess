import { afterEach, describe, expect, it } from 'vitest'
import { applyProgram, normalizeProgram } from './programServed'
import { EVENTS, PLAN_CHANGES } from './program'

const wire = (): Record<string, any> => ({
  version: 'p1',
  events: [
    { id: 'a', days: [2, 6], start: '10:00', minutes: 45, title: 'A', placeId: 'piazza', age: 'all', interest: 'music', extra: 0, afterAllAboard: false },
    { id: 'b', days: [3], start: '19:00', minutes: 40, title: 'B', placeId: 'piazza', age: 'kids', interest: 'family', extra: 2500, afterAllAboard: true },
  ],
  planChanges: [
    { eventId: 'a', day: 2, kind: 'moved', start: '11:00', reason: 'Late.' },
    { eventId: 'b', day: 3, kind: 'cancelled', start: null, reason: 'Unwell.' },
  ],
})

describe('normalizeProgram', () => {
  it('reads a good answer', () => {
    const p = normalizeProgram(wire())!
    expect(p.events[1]).toMatchObject({ id: 'b', afterAllAboard: true, extra: 2500 })
    expect(p.events[0].afterAllAboard).toBeUndefined()
    expect(p.changes[1]).toEqual({ eventId: 'b', day: 3, kind: 'cancelled', reason: 'Unwell.' })
  })

  it.each([
    ['not an object', () => null],
    ['a repeated id', () => { const w = wire(); w.events[1].id = 'a'; return w }],
    ['a day out of range', () => { const w = wire(); w.events[0].days = [9]; return w }],
    ['a bad time', () => { const w = wire(); w.events[0].start = '25:00'; return w }],
    ['an unknown age group', () => { const w = wire(); w.events[0].age = 'pets'; return w }],
    ['a negative price', () => { const w = wire(); w.events[0].extra = -1; return w }],
    ['a move with no time', () => { const w = wire(); w.planChanges[0].start = null; return w }],
    ['a change on a day the event does not run', () => { const w = wire(); w.planChanges[0].day = 3; return w }],
    ['no events', () => { const w = wire(); w.events = []; w.planChanges = []; return w }],
  ])('rejects %s', (_n, make) => {
    expect(normalizeProgram(make())).toBeNull()
  })
})

describe('applyProgram', () => {
  const saved = { events: [...EVENTS], changes: [...PLAN_CHANGES] }
  afterEach(() => applyProgram({ version: 'back', events: saved.events, changes: saved.changes }))

  it('swaps the events and changes in place', () => {
    const events = EVENTS
    applyProgram(normalizeProgram(wire())!)
    expect(EVENTS).toBe(events)
    expect(EVENTS.map((e) => e.id)).toEqual(['a', 'b'])
    expect(PLAN_CHANGES).toHaveLength(2)
  })
})
