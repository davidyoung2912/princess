import { afterEach, describe, expect, it } from 'vitest'
import { NO_WISH } from '../domain/day'
import { dayPlanFeed, entriesOf, normalizeDay, wishKey } from './dayPlan'

afterEach(() => { dayPlanFeed.setFetcher(null); dayPlanFeed.forget() })

const entry = (id: string, kind: string, start: string, extra: object = {}) => ({ id, title: id, start, minutes: 60, kind, placeId: null, outdoor: false, path: '/plan', why: 'included in your fare', ...extra })
const answer = () => ({
  day: 2, items: [entry('jazz', 'event', '15:00', { placeId: 'live' }), entry('eclipse', 'dinner', '18:30')], empty: false, backBy: null,
  alternatives: [entry('trivia', 'event', '10:30')], shipChanges: [{ id: 'stage-show', kind: 'moved', start: '21:15', reason: 'Weather' }, { id: 'bingo', kind: 'cancelled', start: null, reason: null }],
})

describe('day plan feed', () => {
  it('reads a whole day and nothing else', () => {
    const d = normalizeDay(answer())
    expect(d?.items.map((i) => i.id)).toEqual(['jazz', 'eclipse'])
    expect(d?.items[0].placeId).toBe('live')
    expect(d?.shipChanges).toHaveLength(2)
    expect(normalizeDay({ ...answer(), day: 9 })).toBeNull()
    expect(normalizeDay({ ...answer(), backBy: '25:00' })).toBeNull()
    expect(normalizeDay({ ...answer(), items: [entry('x', 'party', '10:00')] })).toBeNull()
    expect(normalizeDay({ ...answer(), shipChanges: [{ id: 'a', kind: 'vanished', start: null, reason: null }] })).toBeNull()
    expect(normalizeDay(null)).toBeNull()
  })

  it('gives plain plan entries without the reason', () => {
    expect(entriesOf(normalizeDay(answer())!.items)[0]).not.toHaveProperty('why')
  })

  it('keys the same wishes the same way, with a tour limit in cents on the wire', () => {
    expect(wishKey({ ...NO_WISH, tours: ['water', 'culture'] })).toBe(wishKey({ ...NO_WISH, tours: ['culture', 'water'] }))
    expect(JSON.parse(wishKey({ ...NO_WISH, maxTour: 100 })).maxTour).toBe(10_000)
    expect(JSON.parse(wishKey(NO_WISH)).maxTour).toBeNull()
  })

  it('asks the server once per sailing, day and wishes', async () => {
    let calls = 0
    dayPlanFeed.setFetcher(async () => { calls++; return answer() })
    expect(dayPlanFeed.now('S1', 2, wishKey(NO_WISH))).toBeNull()
    expect(await dayPlanFeed.load('S1', 2, wishKey(NO_WISH))).toBe(true)
    expect(await dayPlanFeed.load('S1', 2, wishKey(NO_WISH))).toBe(false)
    expect(calls).toBe(1)
  })
})
