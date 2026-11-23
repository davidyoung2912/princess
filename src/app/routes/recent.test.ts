import { describe, expect, it } from 'vitest'
import { EMPTY_RECENT, isSafePath, mergeRecent, normalizeRecent, recentPathFor, relativeTime, visibleRecent, withVisit } from './recent'

describe('recent screens', () => {
  it('counts named screens only, not Home, search, settings or unknown addresses', () => {
    expect(recentPathFor('/book/resume/abc?x=1')).toBe('/book/resume/abc')
    expect(recentPathFor('/')).toBeNull()
    expect(recentPathFor('/ship/search')).toBeNull()
    expect(recentPathFor('/me/settings')).toBeNull()
    expect(recentPathFor('/nowhere/at/all')).toBeNull()
  })

  it('moves a repeat to the front, ignores a second in a row and keeps three', () => {
    let s = withVisit(EMPTY_RECENT, '/home/ship', 1)
    s = withVisit(s, '/home/saved', 2)
    expect(withVisit(s, '/home/saved', 3)).toBe(s)
    s = withVisit(s, '/home/ship', 4)
    expect(s.items.map((i) => i.path)).toEqual(['/home/ship', '/home/saved'])
    s = withVisit(withVisit(s, '/home/offers', 5), '/home/cabins', 6)
    expect(s.items.map((i) => i.path)).toEqual(['/home/cabins', '/home/offers', '/home/ship'])
  })

  it('refuses anything that is not an app path', () => {
    for (const bad of ['https://x.com', '//x.com', '/a//b', '/a\\b', '/a:b', '/a\nb', 'home', '/' + 'x'.repeat(200)]) expect(isSafePath(bad)).toBe(false)
    expect(isSafePath('/home/x?next=http://y')).toBe(false)
    expect(isSafePath('/home/sailings/abc')).toBe(true)
  })

  it('reads a document safely', () => {
    expect(normalizeRecent(null)).toEqual(EMPTY_RECENT)
    const s = normalizeRecent({ items: [{ path: '/a', at: 1 }, { path: 'bad', at: 2 }, { path: '/a', at: 5 }, { path: '/b', at: 'x' }, 7] })
    expect(s.items).toEqual([{ path: '/a', at: 5 }])
  })

  it('merges two devices to the newest three', () => {
    const m = mergeRecent({ items: [{ path: '/a', at: 1 }, { path: '/b', at: 4 }] }, { items: [{ path: '/a', at: 3 }, { path: '/c', at: 2 }, { path: '/d', at: 0 }] })
    expect(m.items.map((i) => i.path)).toEqual(['/b', '/a', '/c'])
  })

  it('leaves out rows the stage does not use', () => {
    const rows = visibleRecent({ items: [{ path: '/home/ship', at: 1 }, { path: '/gone', at: 0 }] }, 'dream')
    expect(rows.every((r) => r.screen.path.length > 0)).toBe(true)
    expect(rows.find((r) => r.path === '/gone')).toBeUndefined()
  })

  it('says how long ago in days', () => {
    const now = new Date(2026, 10, 3, 12).getTime()
    expect(relativeTime(now - 1000, now)).toEqual({ kind: 'now' })
    expect(relativeTime(new Date(2026, 10, 3, 8).getTime(), now)).toEqual({ kind: 'today' })
    expect(relativeTime(new Date(2026, 10, 2, 23).getTime(), now)).toEqual({ kind: 'yesterday' })
    expect(relativeTime(new Date(2026, 10, 0, 12).getTime(), now)).toEqual({ kind: 'days', n: 3 })
    expect(relativeTime(new Date(2026, 8, 1).getTime(), now)).toEqual({ kind: 'older' })
  })
})
