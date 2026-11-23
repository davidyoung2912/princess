import { describe, expect, it } from 'vitest'
import type { ExplorerDay, ExplorerEvent, VenueDay } from '../../../shared/api/explorerTypes'
import { summariseDay, summaryLines } from './daySummary'

const MIN = 60_000
const NOW = Date.UTC(2027, 2, 21, 12, 0)
const at = (m: number): number => NOW + m * MIN

const event = (id: string, startIn: number, o: Partial<ExplorerEvent> = {}): ExplorerEvent => ({
  id, venueId: 'v1', day: 3, date: '2027-03-21', start: '13:00', minutes: 30, startAt: at(startIn), endAt: at(startIn + 30), title: id, detail: '', age: 'all', interest: 'x', extra: 0, status: 'on', ...o,
})

const venue = (id: string, windows: [string, string][], events: ExplorerEvent[] = [], o: Partial<VenueDay['venue']> = {}, closedBecause: 'alongside' | 'none' | null = null): VenueDay => ({
  venue: { id, shipId: 's', explorer: 'exercise', kind: 'gym', title: `Venue ${id}`, short: '', long: '', placeId: '', deckLabel: '', bookable: 'none', order: 1, features: [], accessibility: [], ...o },
  hours: { windows, staffed: [], closedBecause: windows.length === 0 ? closedBecause ?? 'none' : null },
  events, menus: [],
})

const day = (venues: VenueDay[], o: Partial<ExplorerDay> = {}): ExplorerDay => ({ explorer: 'exercise', shipId: 's', day: 3, currentDay: 3, date: '2027-03-21', port: 'sea', shipZone: 'UTC', venues, mine: [], ...o })
const clock = { currentDay: 3, now: '12:00', nowAt: NOW }
const fmt = (hhmm: string): string => hhmm

describe('summariseDay', () => {
  it('counts what is open now and finds the next opening and the next event', () => {
    const s = summariseDay(day([venue('a', [['06:00', '22:00']], [event('past', -60), event('soon', 30), event('later', 120)]), venue('b', [['15:00', '18:00']]), venue('c', [['06:00', '10:00']])]), clock)
    expect(s).toMatchObject({ phase: 'current', total: 3, open: 1, eventsLeft: 2 })
    expect(s.nextOpen).toEqual({ title: 'Venue b', at: '15:00' })
    expect(s.nextEvent?.title).toBe('soon')
  })
  it('leaves cancelled events out and counts the plan, family and included events', () => {
    const s = summariseDay(day([venue('a', [['00:00', '24:00']], [event('e1', 10, { extra: 500 }), event('e2', 20, { age: 'kids' }), event('e3', 30, { status: 'cancelled' })])], { mine: ['e1', 'e3'] }), clock)
    expect(s).toMatchObject({ eventsLeft: 2, onPlan: 1, family: 1, included: 1 })
  })
  it('says what shut only because the ship is alongside', () => {
    const s = summariseDay(day([venue('a', [], [], {}, 'alongside')], { port: 'cozumel', sailawayAt: at(300) }), clock)
    expect(s).toMatchObject({ open: 0, alongside: 1, sailawayAt: at(300) })
  })
  it('lists the whole day of a later day and nothing for a past day', () => {
    const v = venue('a', [['06:00', '22:00']], [event('x', 5), event('y', 10)])
    expect(summariseDay(day([v], { day: 4 }), clock)).toMatchObject({ phase: 'future', open: 1, eventsLeft: 2 })
    expect(summariseDay(day([v], { day: 2 }), clock)).toMatchObject({ phase: 'past', eventsLeft: 0 })
  })
  it('counts restaurants with a children’s menu and a cover charge', () => {
    const s = summariseDay(day([venue('a', [['06:00', '22:00']], [], { kidsMenu: [{ name: 'Pasta', contains: [] }], cover: 3000 }), venue('b', [['06:00', '22:00']])], { explorer: 'dining' }), clock)
    expect(s).toMatchObject({ kidsMenus: 1, coverCharge: 1 })
  })
})

describe('summaryLines', () => {
  const base = summariseDay(day([venue('a', [['06:00', '22:00']], [event('soon', 30), event('later', 120)]), venue('b', [['15:00', '18:00']])]), clock)
  it('writes each Explorer in its own words, at most four lines', () => {
    expect(summaryLines('exercise', base, 3, fmt).map((l) => l.key)).toEqual(['exercise.open', 'exercise.next', 'exercise.left'])
    expect(summaryLines('entertainment', base, 3, fmt)[1].key).toBe('entertainment.next')
    expect(summaryLines('exercise', { ...base, onPlan: 1, eventsLeft: 5 }, 3, fmt).map((l) => l.key)).toContain('plan')
  })
  it('gives the restaurants children’s menus and cover charges instead of events', () => {
    const keys = summaryLines('dining', { ...base, kidsMenus: 2, coverCharge: 1 }, 3, fmt).map((l) => l.key)
    expect(keys).toEqual(['dining.open', 'dining.nextOpen', 'dining.kids', 'dining.cover'])
  })
  it('explains closed shops in port, a quiet moment, and a past day', () => {
    expect(summaryLines('shopping', { ...base, open: 0, nextOpen: null, alongside: 2 }, 3, fmt)[0].key).toBe('shopping.alongside')
    expect(summaryLines('spa', { ...base, open: 0 }, 3, fmt)[0]).toMatchObject({ key: 'spa.nothingOpen', params: { title: 'Venue b', time: '15:00' } })
    expect(summaryLines('spa', { ...base, phase: 'past' }, 2, fmt)).toEqual([{ key: 'past', params: { day: 2 } }])
  })
  it('uses first-of-the-day wording for a later day', () => {
    const later = { ...base, phase: 'future' as const }
    expect(summaryLines('activities', later, 5, fmt).map((l) => l.key)).toEqual(['activities.openDay', 'activities.firstDay', 'activities.onDay'])
  })
})

describe('summary wording', () => {
  it('has every sentence for every Explorer', async () => {
    const { enCore } = await import('../../../shared/i18n/locales/enCore')
    const words = enCore as Record<string, string>
    const per = ['open', 'openDay', 'nothingOpen', 'closed']
    const events = ['next', 'firstDay', 'left_one', 'left_other', 'onDay_one', 'onDay_other']
    const missing = (['dining', 'entertainment', 'shopping', 'spa', 'exercise', 'activities'] as const)
      .flatMap((k) => [...per, ...(k === 'dining' ? [] : events)].map((s) => `exp.sum.${k}.${s}`))
      .concat(['exp.sum.past', 'exp.sum.title', 'exp.sum.plan_one', 'exp.sum.plan_other', 'exp.sum.included_one', 'exp.sum.included_other', 'exp.sum.shopping.alongside', 'exp.sum.dining.nextOpen',
        'exp.sum.dining.kids_one', 'exp.sum.dining.kids_other', 'exp.sum.dining.cover_one', 'exp.sum.dining.cover_other', 'exp.sum.activities.family_one', 'exp.sum.activities.family_other'])
      .filter((k) => !words[k])
    expect(missing).toEqual([])
  })
})
