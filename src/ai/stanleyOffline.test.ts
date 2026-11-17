import { describe, expect, it } from 'vitest'
import { buildCache, catchUpCard, enqueue, offlineFirings, outcomeOf, readCache, readQueue, splitQueue, upcomingFromCache, QUEUE_HOLD_MS } from './stanleyOffline'
import type { StanleyReminder } from './stanleyReminders'

const NOW = Date.UTC(2027, 0, 10, 12)
const rem = (id: string, dueAt: number, over: Partial<StanleyReminder> = {}): StanleyReminder => ({ id, text: id, dueAt, when: '', kind: 'clock', anchor: null, lead: null, state: 'scheduled', note: null, private: false, past: false, ...over })

describe('reminder copy', () => {
  it('keeps a day ahead and a few hours back, scheduled only', () => {
    const c = buildCache([rem('a', NOW + 1000), rem('far', NOW + 30 * 3600_000), rem('old', NOW - 10 * 3600_000), rem('x', NOW + 1000, { state: 'cancelled' })], NOW)
    expect(c.items.map((i) => i.id)).toEqual(['a'])
    expect(c.cachedAt).toBe(NOW)
  })
  it('drops what is not the agreed shape', () => {
    expect(readCache('x')).toBeNull()
    expect(readCache({ cachedAt: NOW, items: [{ id: 'a', dueAt: NOW, text: 't' }, { nope: 1 }] })?.items).toHaveLength(1)
  })
})

describe('offline firings', () => {
  const cache = buildCache([rem('a', NOW - 25 * 60_000), rem('b', NOW - 30_000, { kind: 'anchored' }), rem('c', NOW + 60_000)], NOW - 3600_000)
  it('shows what came due with its real time, late or not, and not twice', () => {
    const f = offlineFirings(cache, NOW, [])
    expect(f.map((x) => [x.id, x.late, x.mayHaveMoved, x.shownAt])).toEqual([['a', true, false, NOW], ['b', false, true, NOW]])
    expect(f[0].checkedAt).toBe(NOW - 3600_000)
    expect(offlineFirings(cache, NOW, ['a']).map((x) => x.id)).toEqual(['b'])
  })
  it('lists what is still to come', () => expect(upcomingFromCache(cache, NOW).map((x) => x.id)).toEqual(['c']))
  it('shows nothing with no copy', () => expect(offlineFirings(null, NOW, [])).toEqual([]))
})

describe('waiting to send', () => {
  it('holds a confirm for the shorter of the hold and the preview expiry, one per preview', () => {
    let q = enqueue([], { actionId: 'p1', key: 'k1', title: 'Dinner' }, NOW + 5 * 60_000, NOW)
    expect(q[0].expiresAt).toBe(NOW + 5 * 60_000)
    q = enqueue(q, { actionId: 'p1', key: 'k1', title: 'Dinner' }, NOW + 99 * 3600_000, NOW)
    expect(q).toHaveLength(1)
    expect(q[0].expiresAt).toBe(NOW + QUEUE_HOLD_MS)
  })
  it('separates what ran out of time', () => {
    const q = enqueue(enqueue([], { actionId: 'a', key: 'k', title: 'A' }, NOW + 60_000, NOW), { actionId: 'b', key: 'k2', title: 'B' }, NOW + 3600_000, NOW)
    const s = splitQueue(q, NOW + 120_000)
    expect(s.waiting.map((x) => x.actionId)).toEqual(['b'])
    expect(s.expired.map((x) => x.actionId)).toEqual(['a'])
  })
  it('reads only well-formed entries', () => expect(readQueue([{ actionId: 'a', key: 'k', expiresAt: 1, title: '', queuedAt: 0 }, 5, {}])).toHaveLength(1))
})

describe('catch-up card', () => {
  it('puts what changed first and maps refusals', () => {
    const l = catchUpCard([{ actionId: '1', title: 'a', outcome: 'done' }, { actionId: '2', title: 'b', outcome: 'changed' }, { actionId: '3', title: 'c', outcome: 'expired' }])
    expect(l.map((x) => x.outcome)).toEqual(['changed', 'expired', 'done'])
    expect(outcomeOf('tooLate')).toBe('expired')
    expect(outcomeOf('changed')).toBe('changed')
    expect(outcomeOf('off')).toBe('refused')
  })
})
