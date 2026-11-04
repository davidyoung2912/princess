import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { activateProgram, activeProgramShip, applyProgram, clearPrograms, keepProgram, loadShipProgram, normalizeProgram, programOf, setProgramLoader } from './programServed'
import { isTicketed } from './tickets'
import { shipProgrammes, shipProgrammesFileText } from '../../scripts/ship-programme-data'
import { EVENTS, PLAN_CHANGES } from './program'

const wire = (): Record<string, any> => ({
  version: 'p1',
  events: [
    { id: 'a', when: ['seaMid'], start: '10:00', minutes: 45, title: 'A', placeId: 'piazza', age: 'all', interest: 'music', extra: 0, afterAllAboard: false },
    { id: 'b', when: ['port'], start: '19:00', minutes: 40, title: 'B', placeId: 'piazza', age: 'kids', interest: 'family', extra: 2500, afterAllAboard: true },
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
    ['an unknown kind of day', () => { const w = wire(); w.events[0].when = ['tuesday']; return w }],
    ['no kind of day', () => { const w = wire(); w.events[0].when = []; return w }],
    ['a bad time', () => { const w = wire(); w.events[0].start = '25:00'; return w }],
    ['an unknown age group', () => { const w = wire(); w.events[0].age = 'pets'; return w }],
    ['a negative price', () => { const w = wire(); w.events[0].extra = -1; return w }],
    ['a move with no time', () => { const w = wire(); w.planChanges[0].start = null; return w }],
    ['a change to an event that is not there', () => { const w = wire(); w.planChanges[0].eventId = 'zzz'; return w }],
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

describe('a ship\'s programme in use', () => {
  const saved = { events: [...EVENTS], changes: [...PLAN_CHANGES] }
  afterEach(() => { clearPrograms(); setProgramLoader(null); applyProgram({ version: 'back', events: saved.events, changes: saved.changes }); clearPrograms() })

  const sky = () => normalizeProgram({ ...wire(), version: 'sky' })!

  it('puts the chosen ship\'s events where the screens read them', () => {
    keepProgram('sky-princess', sky())
    expect(activateProgram('sky-princess')).toBe(true)
    expect(EVENTS.map((e) => e.id)).toEqual(['a', 'b'])
    expect(activeProgramShip()).toBe('sky-princess')
  })

  it('does not let the Sun programme arriving later replace the ship in use', () => {
    keepProgram('sky-princess', sky())
    activateProgram('sky-princess')
    applyProgram({ version: 'sun', events: saved.events, changes: saved.changes })
    expect(EVENTS.map((e) => e.id)).toEqual(['a', 'b'])
    expect(programOf('sun-princess')?.version).toBe('sun')
    expect(activateProgram('sun-princess')).toBe(true)
    expect(EVENTS.length).toBe(saved.events.length)
  })

  it('refuses a ship that is not loaded and loads it once', async () => {
    expect(activateProgram('sky-princess')).toBe(false)
    let calls = 0
    setProgramLoader(async () => { calls++; return wire() })
    const both = await Promise.all([loadShipProgram('sky-princess'), loadShipProgram('sky-princess')])
    expect(both).toEqual([true, true])
    expect(calls).toBe(1)
    expect(await loadShipProgram('sky-princess')).toBe(true)
    expect(calls).toBe(1)
  })

  it('keeps nothing from a malformed answer', async () => {
    setProgramLoader(async () => ({ version: 'x', events: [], planChanges: [] }))
    expect(await loadShipProgram('sky-princess')).toBe(false)
    expect(programOf('sky-princess')).toBeUndefined()
  })
})

describe('the programme of the other ships', () => {
  it('matches the file the server embeds (run npm run shipprogrammes:gen when this fails)', () => {
    expect(readFileSync(new URL('../../server/Princess.Api/Content/ship-programmes.json', import.meta.url), 'utf8')).toBe(shipProgrammesFileText())
  })

  it('has no event in a room Sun Princess alone has', () => {
    for (const p of shipProgrammes()) {
      expect(p.events.some((e) => ['arena', 'dome', 'live', 'eclipse', 'crooners'].includes(e.placeId))).toBe(false)
      expect(new Set(p.events.map((e) => e.id)).size).toBe(p.events.length)
      expect(p.events.every((e) => isTicketed(e.id) || !['late-show'].includes(e.id))).toBe(true)
    }
  })
})
