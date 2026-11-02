import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PREFS } from '../domain/autopilot'
import { normalizeWeek, weekFeed, weekKey } from './week'

afterEach(() => { weekFeed.setFetcher(null); weekFeed.forget() })

const dinner = { id: 'eclipse', title: 'Dinner', start: '18:30', minutes: 90, kind: 'dinner', placeId: null, outdoor: false, path: '/plan/dining', why: 'included' }
const day = (n: number) => ({ day: n, port: n === 1 || n === 8 ? 'fll' : 'sea', items: [{ kind: 'dinner', id: 'eclipse', title: 'Dinner', start: '18:30', why: 'included' }], restDay: false, alternative: null, tourCost: 0, base: [dinner], target: [dinner] })
const answer = () => ({ days: [1, 2, 3, 4, 5, 6, 7, 8].map(day), totalTours: 0, prefs: DEFAULT_PREFS })

describe('week feed', () => {
  it('reads a whole week and nothing else', () => {
    const w = normalizeWeek(answer())
    expect(w?.days).toHaveLength(8)
    expect(w?.prefs.pace).toBe('balanced')
    expect(normalizeWeek({ ...answer(), days: answer().days.slice(1) })).toBeNull()
    expect(normalizeWeek({ ...answer(), prefs: { ...DEFAULT_PREFS, pace: 'frantic' } })).toBeNull()
    const bad = answer(); bad.days[2].items[0].start = 'late'
    expect(normalizeWeek(bad)).toBeNull()
    expect(normalizeWeek(null)).toBeNull()
    const noPlan = answer(); delete (noPlan.days[0] as Partial<ReturnType<typeof day>>).base
    expect(normalizeWeek(noPlan)).toBeNull()
    expect(w?.days[0].target[0].id).toBe('eclipse')
  })

  it('keys the same wishes the same way, whatever order they were picked in', () => {
    expect(weekKey({ ...DEFAULT_PREFS, tours: ['water', 'culture'] })).toBe(weekKey({ ...DEFAULT_PREFS, tours: ['culture', 'water'] }))
    expect(weekKey({ ...DEFAULT_PREFS, noEarly: true })).not.toBe(weekKey(DEFAULT_PREFS))
    expect(weekKey(DEFAULT_PREFS, [])).toBe(weekKey(DEFAULT_PREFS))
    expect(weekKey(DEFAULT_PREFS, [{ day: 3, part: 'evening' }])).not.toBe(weekKey(DEFAULT_PREFS))
    expect(JSON.parse(weekKey(DEFAULT_PREFS, [{ day: 5, part: 'all' }, { day: 3, part: 'evening' }])).rest).toEqual([{ day: 3, part: 'evening' }, { day: 5, part: 'all' }])
  })

  it('asks the server once per sailing and wishes', async () => {
    let calls = 0
    weekFeed.setFetcher(async () => { calls++; return answer() })
    const k = weekKey(DEFAULT_PREFS)
    expect(weekFeed.now('S1', k)).toBeNull()
    expect(await weekFeed.load('S1', k)).toBe(true)
    expect(await weekFeed.load('S1', k)).toBe(false)
    expect(calls).toBe(1)
    expect(weekFeed.now('S1', k)?.days).toHaveLength(8)
  })
})
