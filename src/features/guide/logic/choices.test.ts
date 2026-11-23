import { describe, expect, it } from 'vitest'
import { applyChoices, EMPTY_CHOICES, mergeChoices, normalizeChoices, putOff, restoreTask, skipTask } from './choices'
import { guide, task } from './fixture'

const NOW = 1_700_000_000_000

describe('guide choices', () => {
  it('reads a document safely', () => {
    expect(normalizeChoices(null)).toBe(EMPTY_CHOICES)
    expect(normalizeChoices({ skipped: { 'a.b': 1, 'bad id': 2, 'c.d': 'x' }, later: { 'e.f': '2026-12-01', 'g.h': 'soon' } })).toEqual({ skipped: { 'a.b': 1 }, later: { 'e.f': '2026-12-01' } })
  })

  it('never hides a task with a real deadline', () => {
    expect(skipTask(EMPTY_CHOICES, { id: 'manage.pay', hard: true }, NOW)).toBe(EMPTY_CHOICES)
    expect(skipTask(EMPTY_CHOICES, { id: 'prebook.tours', hard: false }, NOW).skipped).toEqual({ 'prebook.tours': NOW })
  })

  it('a skip replaces a later, and bringing a task back forgets both', () => {
    const later = putOff(EMPTY_CHOICES, { id: 'prebook.tours' }, '2026-12-01')
    const skipped = skipTask(later, { id: 'prebook.tours', hard: false }, NOW)
    expect(skipped.later).toEqual({})
    expect(restoreTask(skipped, 'prebook.tours')).toBe(EMPTY_CHOICES)
  })

  it('keeps every skip when two devices merge, and the later day for a task put off on both', () => {
    const a = { skipped: { 'a.x': 1 }, later: { 'b.y': '2026-12-01', 'c.z': '2026-12-05' } }
    const b = { skipped: { 'c.z': 2 }, later: { 'b.y': '2026-12-03' } }
    expect(mergeChoices(a, b)).toEqual({ skipped: { 'a.x': 1, 'c.z': 2 }, later: { 'b.y': '2026-12-03' } })
  })

  it('lays choices over the guide: hides, defers, keeps deadlines and done, and moves the primary', () => {
    const view = guide('prebook', [task('manage.pay', { hard: true }), task('prebook.tours'), task('prebook.dining'), task('prebook.packing', { state: 'done' })])
    const choices = { skipped: { 'manage.pay': 1, 'prebook.tours': 2, 'prebook.packing': 3 }, later: { 'prebook.dining': '2026-12-02' } }
    const out = applyChoices(view, choices, '2026-12-01')
    expect(out.tasks.map((x) => x.id)).toEqual(['manage.pay', 'prebook.packing'])
    expect(out.primaryId).toBe('manage.pay')
    expect(out.hidden).toEqual(['prebook.tours'])
    expect(out.deferred).toEqual([{ id: 'prebook.dining', until: '2026-12-02' }])
    expect(out.counts).toEqual({ done: 1, total: 2, open: 1 })
  })

  it('brings a put-off task back on its day', () => {
    const view = guide('prebook', [task('prebook.tours')])
    expect(applyChoices(view, { skipped: {}, later: { 'prebook.tours': '2026-12-02' } }, '2026-12-02').tasks).toHaveLength(1)
  })

  it('keeps what the server hid until the local document is known', () => {
    const view = { ...guide('prebook', [task('prebook.dining')]), hidden: ['prebook.tours'] }
    expect(applyChoices(view, EMPTY_CHOICES, '2026-12-01').hidden).toEqual(['prebook.tours'])
    expect(applyChoices(view, { skipped: {}, later: { 'x.y': '2026-12-09' } }, '2026-12-01').hidden).toEqual([])
  })
})
