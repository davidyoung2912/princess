import { describe, expect, it } from 'vitest'
import type { ExplorerDay, ExplorerEvent, VenueDay } from '../../api/explorerTypes'
import { EMPTY_TASTE, forYouFirst, hide, normalizeTaste, recommendEvents, recommendVenues, restoreHidden, toggleLike } from './recommend'

const ev = (id: string, interest: string, start: string, over: Partial<ExplorerEvent> = {}): ExplorerEvent => ({
  id, venueId: 'v', day: 1, date: '', start, minutes: 60, startAt: Number(start.slice(0, 2)) * 3_600_000, endAt: Number(start.slice(0, 2)) * 3_600_000 + 3_600_000,
  title: id, detail: '', age: 'all', interest, extra: 0, status: 'on', ...over,
})
const venue = (id: string, events: ExplorerEvent[], over: Record<string, unknown> = {}, closed = false): VenueDay => ({
  venue: { id, kind: 'main', title: id, order: 0, cover: 0, ...over } as VenueDay['venue'],
  hours: { windows: closed ? [] : [['08:00', '22:00']], staffed: [], closedBecause: closed ? 'none' : null },
  events, menus: [],
})
const day = (venues: VenueDay[], mine: string[] = [], over: Partial<ExplorerDay> = {}): ExplorerDay => ({ explorer: 'entertainment', shipId: 's', day: 2, currentDay: 2, date: '', port: '', shipZone: '', venues, mine, ...over })
const likes = (...l: string[]) => ({ ...EMPTY_TASTE, likes: l })

describe('taste profile', () => {
  it('toggles, hides and restores', () => {
    expect(toggleLike(toggleLike(EMPTY_TASTE, 'music'), 'music').likes).toEqual([])
    expect(hide(hide(EMPTY_TASTE, 'a'), 'a').hidden).toEqual(['a'])
    expect(restoreHidden(hide(EMPTY_TASTE, 'a')).hidden).toEqual([])
  })
  it('normalises junk', () => {
    expect(normalizeTaste({ likes: ['x', 3, 'x'], hidden: 'no' })).toEqual({ likes: ['x'], hidden: [] })
    expect(normalizeTaste(null)).toEqual(EMPTY_TASTE)
  })
})

describe('recommendEvents', () => {
  const ctx = { now: 0, pinnedVenueIds: [] }
  it('suggests nothing without a signal', () => {
    expect(recommendEvents(day([venue('v', [ev('a', 'music', '10:00')])]), EMPTY_TASTE, ctx)).toEqual([])
  })
  it('skips cancelled, full, over, planned and dismissed events', () => {
    const d = day([venue('v', [ev('c', 'music', '10:00', { status: 'cancelled' }), ev('f', 'music', '11:00', { left: 0 }), ev('o', 'music', '11:30', { endAt: 12 * 3_600_000 }), ev('p', 'music', '13:00'), ev('h', 'music', '14:00'), ev('ok', 'music', '15:00')])], ['p'])
    const picks = recommendEvents(d, hide(likes('music'), 'h'), { now: 13 * 3_600_000 - 1, pinnedVenueIds: [] })
    expect(picks.map((p) => p.event.id)).toEqual(['ok'])
    expect(picks[0].why).toBe('liked')
  })
  it('spreads across interests and times rather than one theme', () => {
    const d = day([venue('v', [ev('m1', 'music', '09:00'), ev('m2', 'music', '09:30'), ev('m3', 'music', '10:00'), ev('g1', 'games', '14:00'), ev('s1', 'shows', '20:00')])])
    const ids = recommendEvents(d, likes('music', 'games', 'shows'), ctx, 3).map((p) => p.event.id)
    expect(ids).toEqual(['m1', 'g1', 's1'])
  })
  it('explains a match with something on the plan and a pinned venue', () => {
    const d = day([venue('v', [ev('mine', 'wellness', '08:00'), ev('w2', 'wellness', '16:00')]), venue('p', [ev('x', 'games', '18:00')])], ['mine'])
    const picks = recommendEvents(d, EMPTY_TASTE, { now: 0, pinnedVenueIds: ['p'] })
    expect(picks.find((p) => p.event.id === 'w2')?.why).toBe('similarSaved')
    expect(picks.find((p) => p.event.id === 'x')?.why).toBe('pinnedVenue')
  })
  it('suggests nothing on a past day', () => {
    expect(recommendEvents(day([venue('v', [ev('a', 'music', '10:00')])], [], { day: 1 }), likes('music'), ctx)).toEqual([])
  })
})

describe('recommendVenues', () => {
  it('keeps pins out, skips closed and dismissed, and spreads kinds and price', () => {
    const d = day([
      venue('pin', [], { kind: 'specialty', cover: 3000 }),
      venue('s1', [], { kind: 'specialty', cover: 3000, order: 1 }),
      venue('s2', [], { kind: 'specialty', cover: 3500, order: 2 }),
      venue('free', [], { kind: 'main', cover: 0, order: 3 }),
      venue('shut', [], { kind: 'specialty', cover: 3000, order: 4 }, true),
    ], [], { explorer: 'dining' })
    const picks = recommendVenues(d, EMPTY_TASTE, { pinnedVenueIds: ['pin'] }).map((p) => p.venueId)
    expect(picks).toEqual(['s1', 's2'])
    const liked = recommendVenues(day([venue('b', [ev('x', 'music', '20:00')], { kind: 'bar' }), venue('c', [], { kind: 'bar', order: 1 })], [], { explorer: 'dining' }), likes('music'), { pinnedVenueIds: [] })
    expect(liked.map((p) => p.venueId)).toEqual(['b'])
    expect(recommendVenues(d, hide(EMPTY_TASTE, 'venue:s1'), { pinnedVenueIds: ['pin'] }).map((p) => p.venueId)).toEqual(['s2'])
  })
})

describe('forYouFirst', () => {
  it('leaves pins first, then the suggested, then the rest', () => {
    const vs = ['a', 'b', 'c', 'd'].map((id) => ({ venue: { id } }))
    expect(forYouFirst(vs, ['d', 'c'], (v) => v.venue.id === 'b').map((v) => v.venue.id)).toEqual(['b', 'c', 'd', 'a'])
  })
})
