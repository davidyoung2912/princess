import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../api/chatTypes'
import { galleryOf, touchCache, trimCache, gridColumns, MAX_PHOTOS_PER_MESSAGE, photoCountOf, planPicks, stepIndex, swipeDelta } from './chatPhotos'

const msg = (o: Partial<ChatMessage>): ChatMessage => ({ id: 'm', from: 'a', text: '', at: 1, ...o })

describe('photoCountOf', () => {
  it('is 0 without a photo and for a deleted message', () => {
    expect(photoCountOf(msg({}))).toBe(0)
    expect(photoCountOf(msg({ hasPhoto: true, deleted: true }))).toBe(0)
  })
  it('is 1 for a single photo and the server count for several, never above ten', () => {
    expect(photoCountOf(msg({ hasPhoto: true }))).toBe(1)
    expect(photoCountOf(msg({ hasPhoto: true, photoCount: 4 }))).toBe(4)
    expect(photoCountOf(msg({ hasPhoto: true, photoCount: 40 }))).toBe(MAX_PHOTOS_PER_MESSAGE)
  })
})

describe('planPicks', () => {
  const ok = ['image/jpeg', 'image/png']
  it('keeps the first ten allowed files and counts the rest', () => {
    const picks = Array.from({ length: 12 }, () => ({ type: 'image/jpeg', size: 1 }))
    picks.splice(2, 0, { type: 'image/gif', size: 1 })
    const plan = planPicks(picks, ok)
    expect(plan.keep).toHaveLength(10)
    expect(plan.keep).not.toContain(2)
    expect(plan.badType).toBe(1)
    expect(plan.over).toBe(2)
  })
})

describe('the grid and the viewer', () => {
  it('picks columns', () => { expect([1, 2, 3, 4, 5, 10].map(gridColumns)).toEqual([1, 2, 3, 2, 3, 3]) })
  it('stops at the ends', () => {
    expect(stepIndex(0, 3, -1)).toBe(0)
    expect(stepIndex(2, 3, 1)).toBe(2)
    expect(stepIndex(1, 3, 1)).toBe(2)
    expect(stepIndex(0, 0, 1)).toBe(0)
  })
  it('reads a swipe', () => {
    expect(swipeDelta(-80, 5)).toBe(1)
    expect(swipeDelta(80, 5)).toBe(-1)
    expect(swipeDelta(20, 0)).toBe(0)
    expect(swipeDelta(60, 120)).toBe(0)
  })
})

describe('galleryOf', () => {
  it('lists newest message first and each message in order, skipping deleted and photo-less messages', () => {
    const list = galleryOf([
      msg({ id: 'a', at: 1, hasPhoto: true, photoCount: 2, fromName: 'Sam R.' }),
      msg({ id: 'b', at: 2, text: 'hi' }),
      msg({ id: 'c', at: 3, hasPhoto: true }),
      msg({ id: 'd', at: 4, hasPhoto: true, deleted: true }),
    ], 'You')
    expect(list.map((g) => `${g.messageId}${g.index}`)).toEqual(['c0', 'a0', 'a1'])
    expect(list[0].fromName).toBe('You')
    expect(list[1]).toMatchObject({ fromName: 'Sam R.', count: 2 })
  })
})

describe('the photo cache', () => {
  it('drops the oldest beyond its limit and keeps what was just used', () => {
    const c = new Map<string, number>([['a', 1], ['b', 2], ['c', 3]])
    expect(touchCache(c, 'a')).toBe(1)
    trimCache(c, 2)
    expect([...c.keys()]).toEqual(['c', 'a'])
    expect(touchCache(c, 'zzz')).toBeUndefined()
  })
})
