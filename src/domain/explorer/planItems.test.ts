import { describe, expect, it } from 'vitest'
import type { ExplorerDay, ExplorerEvent } from '../../api/explorerTypes'
import type { SpaView } from '../../api/spaTypes'
import type { DiningView } from '../../api/types'
import { buildPlanItems, planCalendar } from './planItems'

const MIN = 60_000
const ev = (id: string, startAt: number, o: Partial<ExplorerEvent> = {}): ExplorerEvent => ({ id, venueId: 'v1', day: 2, date: '2027-01-02', start: '10:00', minutes: 30, startAt, endAt: startAt + 30 * MIN, title: id, detail: '', age: 'all', interest: '', extra: 0, status: 'on', ...o })
const day = (explorer: ExplorerDay['explorer'], events: ExplorerEvent[], mine: string[]): ExplorerDay => ({
  explorer, shipId: 's', day: 2, date: '2027-01-02', port: 'sea', shipZone: 'UTC', mine,
  venues: [{ venue: { id: explorer === 'dining' ? 'main' : explorer === 'spa' ? 'spa' : 'v1', shipId: 's', explorer, kind: 'k', title: `${explorer} venue`, short: '', long: '', placeId: 'piazza', deckLabel: '', bookable: 'none', order: 0, features: [], accessibility: [] }, hours: { windows: [], staffed: [], closedBecause: null }, events, menus: [] }],
})
const atMs = (_d: string, time: string) => 1_000_000 * MIN + (Number(time.slice(0, 2)) * 60 + Number(time.slice(3))) * MIN

describe('buildPlanItems', () => {
  it('merges planned events, dinners and spa appointments in time order', () => {
    const dining = { reservations: [{ id: 'r1', venueId: 'main', day: 2, time: '19:00' }, { id: 'r2', venueId: 'main', day: 3, time: '19:00' }] } as unknown as DiningView
    const spa = { appointments: [{ id: 'a1', venueId: 'spa', title: 'Massage', day: 2, time: '14:00', minutes: 50, startAt: atMs('', '14:00') }] } as unknown as SpaView
    const items = buildPlanItems({
      day: 2, dining, spa, atMs,
      explorers: [day('dining', [], []), day('spa', [], []), day('entertainment', [ev('e1', atMs('', '20:30')), ev('e2', atMs('', '09:00'))], ['e1'])],
    })
    expect(items.map((i) => [i.id, i.kind])).toEqual([['a1', 'spa'], ['r1', 'dining'], ['e1', 'event']])
    expect(items[1].endAt - items[1].startAt).toBe(90 * MIN)
    expect(items[1].title).toBe('dining venue')
  })
  it('keeps moved and cancelled planned events with their reason', () => {
    const items = buildPlanItems({ day: 2, dining: null, spa: null, atMs, explorers: [day('entertainment', [ev('e1', 5 * MIN, { status: 'cancelled', reason: 'weather' })], ['e1'])] })
    expect(items[0]).toMatchObject({ status: 'cancelled', reason: 'weather' })
  })
  it('is empty with nothing planned', () => {
    expect(buildPlanItems({ day: 2, dining: null, spa: null, atMs, explorers: [day('entertainment', [ev('e1', 0)], [])] })).toEqual([])
  })
})

describe('planCalendar', () => {
  it('writes one timed entry per running item at its ship time', () => {
    const items = buildPlanItems({ day: 2, dining: null, spa: null, atMs, explorers: [day('entertainment', [ev('e1', 5 * MIN), ev('e2', 9 * MIN, { status: 'cancelled' })], ['e1', 'e2'])] })
    const ics = planCalendar(items, { date: '2027-01-02', zone: 'UTC', stamp: 0, product: 'p', where: 'Ship' })
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain('UID:plan-e1@p')
  })
})
