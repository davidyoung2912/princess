import { describe, expect, it } from 'vitest'
import type { ExplorerDay, ExplorerEvent, VenueDay } from '../../api/explorerTypes'
import { alternativesFor, diningAlternatives, eventAlternatives, needsAlternatives } from './alternatives'
import type { PlanItem } from './planTimeline'
import { whatChanged } from './whatChanged'

const H = 3_600_000
const ev = (id: string, hour: number, extra: Partial<ExplorerEvent> = {}): ExplorerEvent => ({
  id, venueId: 'v1', day: 2, date: '2027-01-02', start: `${String(hour).padStart(2, '0')}:00`, minutes: 60, startAt: hour * H, endAt: (hour + 1) * H, title: id, detail: '', age: 'all', interest: 'music', extra: 0, status: 'on', ...extra,
})
const venue = (id: string, events: ExplorerEvent[], extra: Partial<VenueDay['venue']> = {}, windows: [string, string][] = [['00:00', '24:00']]): VenueDay => ({
  venue: { id, shipId: 's', explorer: 'entertainment', kind: 'x', title: id, short: '', long: '', placeId: 'p', deckLabel: '', bookable: 'none', order: 0, features: [], accessibility: [], ...extra },
  hours: { windows, staffed: [], closedBecause: null }, events, menus: [],
})
const day = (venues: VenueDay[], mine: string[] = [], explorer: ExplorerDay['explorer'] = 'entertainment'): ExplorerDay => ({ explorer, shipId: 's', day: 2, currentDay: 2, date: '2027-01-02', port: 'sea', shipZone: 'UTC', venues, mine })
const item = (id: string, hour: number, extra: Partial<PlanItem> = {}): PlanItem => ({ id, kind: 'event', explorer: 'entertainment', venueId: 'v1', title: id, venueTitle: 'v1', placeId: 'p', start: `${hour}:00`, startAt: hour * H, endAt: (hour + 1) * H, status: 'on', ...extra })

describe('eventAlternatives', () => {
  const a = ev('Trivia', 10, { status: 'cancelled' })
  const again = ev('Trivia ', 14, { title: 'Trivia' })
  const same = ev('Piano', 15, { interest: 'music' })
  const other = ev('Bingo', 11, { interest: 'games' })
  const full = ev('Quartet', 12, { left: 0 })
  const d = day([venue('v1', [a, again, same, other, full])], ['Trivia'])
  const target = item('Trivia', 10, { status: 'cancelled', title: 'Trivia' })

  it('offers another showing first, then the same interest, never full, cancelled or other interests', () => {
    const got = eventAlternatives(target, [d], [target], 0)
    expect(got.map((g) => g.id)).toEqual(['Trivia ', 'Piano'])
    expect(got[0].why).toBe('sameTitle')
    expect(got[1].why).toBe('sameInterest')
  })
  it('skips what overlaps the rest of the plan, is planned, or has started', () => {
    expect(eventAlternatives(target, [d], [target, item('Lunch', 14)], 0).map((g) => g.id)).toEqual(['Piano'])
    expect(eventAlternatives(target, [d], [target, item('Piano', 15)], 0).map((g) => g.id)).toEqual(['Trivia '])
    expect(eventAlternatives(target, [d], [target], 14.5 * H).map((g) => g.id)).toEqual(['Piano'])
  })
  it('puts a series first and caps the list', () => {
    const s = [ev('S1', 9, { series: 'Cup' }), ev('S2', 16, { series: 'Cup' }), ev('S3', 17), ev('S4', 18), ev('S5', 19)]
    const t = item('S1', 9)
    expect(eventAlternatives(t, [day([venue('v1', s)])], [t], 0)[0]).toMatchObject({ id: 'S2', why: 'series' })
    expect(eventAlternatives(t, [day([venue('v1', s)])], [t], 0)).toHaveLength(3)
  })
  it('returns nothing when the Explorer is not loaded', () => {
    expect(eventAlternatives(target, [], [target], 0)).toEqual([])
  })
})

describe('diningAlternatives', () => {
  const dine = (id: string, windows: [string, string][], extra = {}) => venue(id, [], { explorer: 'dining', bookable: 'dining', ...extra }, windows)
  const d = day([dine('mdr', [['17:30', '21:30']], { order: 1 }), dine('steak', [['17:30', '21:30']], { order: 2 }), dine('late', [['20:00', '22:00']], { order: 3 }), dine('buffet', [['17:30', '21:30']], { bookable: 'none', order: 4 })], [], 'dining')
  const res = item('r1', 18, { kind: 'dining', explorer: 'dining', venueId: 'mdr', start: '18:00', endAt: 18 * H + 90 * 60_000 })
  it('lists other bookable places open for the whole meal', () => {
    expect(diningAlternatives(res, d).map((a) => a.id)).toEqual(['steak'])
  })
  it('goes through alternativesFor, and spa gets none', () => {
    expect(alternativesFor(res, [d], [res], 0).map((a) => a.id)).toEqual(['steak'])
    expect(alternativesFor({ ...res, kind: 'spa' }, [d], [res], 0)).toEqual([])
  })
})

describe('needsAlternatives', () => {
  it('is true for changed or clashing items only', () => {
    const a = item('a', 10)
    expect(needsAlternatives(a, new Map())).toBe(false)
    expect(needsAlternatives({ ...a, status: 'moved' }, new Map())).toBe(true)
    expect(needsAlternatives(a, new Map([['a', [item('b', 10)]]]))).toBe(true)
  })
})

describe('whatChanged', () => {
  const d = day([venue('v1', [ev('A', 9, { status: 'cancelled', reason: 'weather' }), ev('B', 12, { status: 'moved', was: '11:00' }), ev('C', 13), ev('D', 16, { status: 'moved', was: '15:00' })])], ['D'])
  it('lists moved and cancelled events still to come, earliest first, flagging the guest\'s own', () => {
    expect(whatChanged(d, 10 * H).map((c) => [c.id, c.mine])).toEqual([['B', false], ['D', true]])
    expect(whatChanged(d, 0).map((c) => c.id)).toEqual(['A', 'B', 'D'])
  })
  it('lists nothing for a day that is over', () => {
    expect(whatChanged({ ...d, day: 1 }, 0)).toEqual([])
  })
})
