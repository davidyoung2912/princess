import { describe, expect, it } from 'vitest'
import { applyFilter, describeEvent, detailOf, groupByActivityDay, newestFirst, nextCursor, readablePath, type ActivityEvent } from './activityLog'

const ev = (over: Partial<ActivityEvent>): ActivityEvent => ({
  id: 1, at: 1000, category: 'request', action: 'POST /api/v1/bookings/{number}/cancel', outcome: 'success', target: 'number=ABC12345', status: 204,
  error: null, detail: null, requestId: 'r1', byYou: true, forYou: true, ...over,
})

describe('activity log', () => {
  it('lists newest first and breaks ties by id', () => {
    const list = newestFirst([ev({ id: 1, at: 10 }), ev({ id: 3, at: 30 }), ev({ id: 2, at: 30 })])
    expect(list.map((e) => e.id)).toEqual([3, 2, 1])
  })

  it('groups into days, newest day first', () => {
    const day = (at: number) => (at >= 100 ? 'b' : 'a')
    const days = groupByActivityDay([ev({ id: 1, at: 10 }), ev({ id: 2, at: 120 }), ev({ id: 3, at: 110 }), ev({ id: 4, at: 5 })], day)
    expect(days.map((d) => [d.day, d.events.map((e) => e.id)])).toEqual([['b', [2, 3]], ['a', [1, 4]]])
  })

  it('tidies a request path to words', () => {
    expect(readablePath('POST /api/v1/bookings/{number}/cancel')).toBe('bookings / cancel')
    expect(readablePath('PUT /api/v1/me/helper')).toBe('me / helper')
  })

  it('picks a sentence for sign-ins, changes and plain requests, and says when it failed', () => {
    expect(describeEvent(ev({ category: 'auth', action: 'auth.login' })).key).toBe('auth.login')
    const bad = describeEvent(ev({ category: 'auth', action: 'auth.login', outcome: 'failure', detail: '{"reason":"wrongPassword"}' }))
    expect(bad).toMatchObject({ key: 'auth.login.failed', note: 'wrongPassword' })
    expect(describeEvent(ev({ category: 'auth', action: 'auth.something.new' })).key).toBe('auth.other')
    expect(describeEvent(ev({ category: 'domain', action: 'history.dining', detail: '{"change":"Sabatini, night 3"}' }))).toMatchObject({ key: 'change', values: { what: 'dining', change: 'Sabatini, night 3' } })
    expect(describeEvent(ev({ action: 'DELETE /api/v1/me/helper', outcome: 'denied' })).key).toBe('request.removed.failed')
    expect(describeEvent(ev({ category: 'error', outcome: 'error' })).key).toBe('error')
  })

  it('reads a bad detail as nothing', () => {
    expect(detailOf(ev({ detail: 'not json' }))).toEqual({})
    expect(detailOf(ev({ detail: '[1]' }))).toEqual({})
  })

  it('filters to problems', () => {
    const list = [ev({ id: 1 }), ev({ id: 2, outcome: 'failure' }), ev({ id: 3, outcome: 'error' })]
    expect(applyFilter(list, { outcome: 'problems' }).map((e) => e.id)).toEqual([2, 3])
    expect(applyFilter(list, { outcome: 'all' })).toHaveLength(3)
  })

  it('pages back from the oldest id, and stops on a short page', () => {
    expect(nextCursor([ev({ id: 9 }), ev({ id: 5 })], 2)).toBe(5)
    expect(nextCursor([ev({ id: 9 })], 2)).toBeNull()
  })
})
