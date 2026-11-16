import { describe, expect, it } from 'vitest'
import type { ExplorerDay, ExplorerEvent, VenueDay } from '../../api/explorerTypes'
import { eveningBundles } from './evening'
import type { PlanItem } from './planTimeline'
import { EMPTY_TASTE } from './recommend'

const H = 3_600_000
const ev = (id: string, interest: string, hour: number, over: Partial<ExplorerEvent> = {}): ExplorerEvent => ({
  id, venueId: 'v', day: 2, date: '', start: `${String(hour).padStart(2, '0')}:00`, minutes: 60, startAt: hour * H, endAt: (hour + 1) * H,
  title: id, detail: '', age: 'all', interest, extra: 0, status: 'on', ...over,
})
const venue = (id: string, events: ExplorerEvent[]): VenueDay => ({
  venue: { id, kind: 'main', title: id, order: 0, cover: 0, placeId: 'nowhere' } as unknown as VenueDay['venue'],
  hours: { windows: [['08:00', '23:59']], staffed: [], closedBecause: null }, events, menus: [],
})
const day = (venues: VenueDay[], over: Partial<ExplorerDay> = {}): ExplorerDay => ({ explorer: 'entertainment', shipId: 's', day: 2, currentDay: 2, date: '', port: '', shipZone: '', venues, mine: [], ...over })
const item = (id: string, kind: PlanItem['kind'], startH: number, endH: number): PlanItem => ({ id, kind, explorer: 'entertainment', venueId: 'v', title: id, venueTitle: 'v', placeId: 'nowhere', start: `${startH}:00`, startAt: startH * H, endAt: endH * H, status: 'on' })
const ctx = { now: 0, pinnedVenueIds: [] }

describe('eveningBundles', () => {
  it('suggests only evening events that fit round the plan, never overlapping each other', () => {
    const d = day([venue('v', [ev('lunch', 'food', 12), ev('a', 'music', 17), ev('b', 'music', 17), ev('c', 'shows', 21), ev('late', 'shows', 23, { start: '23:30' }), ev('clash', 'games', 19), ev('tight', 'games', 20)])])
    const [b] = eveningBundles([d], [item('dinner', 'dining', 19, 20)], EMPTY_TASTE, ctx)
    const ids = b.steps.map((s) => s.event.id)
    expect(b.kind).toBe('evening')
    expect(ids).not.toContain('lunch')
    expect(ids).not.toContain('late')
    expect(ids).not.toContain('tight')  // a 20:00 start right after a 19:00 to 20:00 dinner leaves no time to walk
    expect(ids).not.toContain('clash')
    expect(ids).toContain('c')
    expect(ids.filter((i) => i === 'a' || i === 'b')).toHaveLength(1)   // the two at 17:00 overlap, so one is chosen
  })
  it('prefers a chosen theme and names it, and varies themes', () => {
    const d = day([venue('v', [ev('m1', 'music', 18), ev('m2', 'music', 20), ev('s1', 'shows', 22)])])
    const [b] = eveningBundles([d], [], { likes: ['music'], hidden: [] }, ctx)
    expect(b.steps.find((s) => s.event.id === 'm1')?.why).toBe('liked')
    expect(b.steps.find((s) => s.event.id === 's1')?.why).toBeUndefined()
    expect(b.steps.map((s) => s.event.startAt)).toEqual([...b.steps.map((s) => s.event.startAt)].sort((x, y) => x - y))
  })
  it('leaves out cancelled, full, planned, hidden and past events', () => {
    const d = day([venue('v', [ev('x', 'a', 18, { status: 'cancelled' }), ev('y', 'a', 19, { left: 0 }), ev('p', 'a', 20), ev('h', 'a', 21), ev('past', 'a', 17)])], { mine: ['p'] })
    expect(eveningBundles([d], [], { likes: [], hidden: ['h'] }, { now: 17.5 * H, pinnedVenueIds: [] })).toEqual([])
  })
  it('offers a return bundle an hour after the last tour on a port day', () => {
    const d = day([venue('v', [ev('early', 'a', 14), ev('ok', 'a', 16), ev('night', 'a', 21)])], { port: 'cozumel' })
    const out = eveningBundles([d], [item('tour', 'tour', 9, 15)], EMPTY_TASTE, ctx)
    const back = out.find((b) => b.kind === 'return')
    expect(back?.tourEndsAt).toBe(15 * H)
    expect(back?.steps.map((s) => s.event.id)).toEqual(['ok'])   // 'early' starts before the hour's buffer ends
    expect(out.find((b) => b.kind === 'evening')?.steps.map((s) => s.event.id)).toEqual(['night'])
  })
  it('has no return bundle at sea or without a tour, and nothing for a past day', () => {
    const d = day([venue('v', [ev('ok', 'a', 18)])], { port: '' })
    expect(eveningBundles([d], [item('tour', 'tour', 9, 12)], EMPTY_TASTE, ctx).map((b) => b.kind)).toEqual(['evening'])
    expect(eveningBundles([day([venue('v', [ev('ok', 'a', 18)])], { port: 'x' })], [], EMPTY_TASTE, ctx).map((b) => b.kind)).toEqual(['evening'])
    expect(eveningBundles([day([venue('v', [ev('ok', 'a', 18)])], { currentDay: 5 })], [], EMPTY_TASTE, ctx)).toEqual([])
  })
})
