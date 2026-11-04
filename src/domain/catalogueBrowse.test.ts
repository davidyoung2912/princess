import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  browseSailings, compareHighlights, filterSailings, groupByMonth, legBadge, matchSailings, monthsOf, nightsBand, pricePerNight, regionMonthGrid, routeSketch,
  savedSailingsToCompare, shipCompareRows, sailingFacts, sortSailings,
} from './catalogueBrowse'
import { applyPatterns, applyShips, setSailingEntries, normalizeEntries, normalizePatterns, normalizeShips } from './shipCatalogue'

const entry = (id: string, over: object = {}) => ({
  id, ship: 'sky-princess', departure: '2027-03-01', nights: 7, title: id, region: 'caribbean', startPort: 'a', endPort: 'a',
  legs: [{ leg: 1, pattern: 'p7', startDay: 1 }], holiday: false, bookingOpen: false, dataStatus: 'sample', fromCents: 70_000, ...over,
})
const pat = (id: string, nights: number, ports: string[]) => ({
  id, name: id, region: 'caribbean', nights, startPort: 'a', endPort: 'a', description: '',
  days: Array.from({ length: nights + 1 }, (_, i) => ({ day: i + 1, port: ports[i] ?? 'sea' })),
})

beforeEach(() => {
  applyPatterns(normalizePatterns({ version: 'v', items: [pat('p7', 7, ['a', 'b', 'sea', 'c', 'sea', 'sea', 'sea', 'a'])] })!)
  applyShips(normalizeShips({ version: 'v', items: [
    { id: 'sky-princess', name: 'Sky', class: 'Royal', depth: 'browse', decks: 19, tonnage: 145000, capacity: 3600, intro: 'x' },
    { id: 'sun-princess', name: 'Sun', class: 'Sphere', depth: 'aboard', decks: 17, tonnage: 177000, capacity: 4300, entered: 2024, intro: 'y' },
  ] })!)
  setSailingEntries(normalizeEntries([
    entry('s1'),
    entry('s2', { departure: '2027-03-08', fromCents: 140_000, nights: 14 }),
    entry('s3', { departure: '2027-04-05', region: 'med', fromCents: undefined, ship: 'sun-princess', bookingOpen: true }),
    entry('s4', { departure: '2027-03-15', nights: 21, region: 'med', fromCents: 105_000 }),
  ]))
})
afterEach(() => setSailingEntries([]))

describe('catalogueBrowse', () => {
  it('bands lengths', () => {
    expect([6, 7, 8, 10, 14, 21, 31].map(nightsBand)).toEqual(['short', 'week', 'week', 'long', 'long', 'grand', 'grand'])
  })
  it('lists sailings by date with return date and month', () => {
    const l = browseSailings()
    expect(l.map((s) => s.id)).toEqual(['s1', 's2', 's4', 's3'])
    expect(l[0]).toMatchObject({ returnDate: '2027-03-08', month: '2027-03' })
  })
  it('filters by ship, region, month, length, port and bookable', () => {
    const l = browseSailings()
    expect(filterSailings(l, { ship: 'sun-princess' }).map((s) => s.id)).toEqual(['s3'])
    expect(filterSailings(l, { region: 'med' }).map((s) => s.id)).toEqual(['s4', 's3'])
    expect(filterSailings(l, { month: '2027-03', nights: 'long' }).map((s) => s.id)).toEqual(['s2'])
    expect(filterSailings(l, { port: 'c' }).length).toBe(4)
    expect(filterSailings(l, { port: 'zz' })).toEqual([])
    expect(filterSailings(l, { bookable: true }).map((s) => s.id)).toEqual(['s3'])
  })
  it('sorts cheapest by price a night, unpriced last, and shortest by nights', () => {
    const l = browseSailings()
    expect(pricePerNight(l[1])).toBe(10_000)
    expect(sortSailings(l, 'cheapest').map((s) => s.id)).toEqual(['s4', 's1', 's2', 's3'])
    expect(sortSailings(l, 'shortest').map((s) => s.nights)).toEqual([7, 7, 14, 21])
  })
  it('groups by month in order', () => {
    expect(groupByMonth(browseSailings()).map((g) => [g.month, g.sailings.length])).toEqual([['2027-03', 3], ['2027-04', 1]])
    expect(monthsOf(browseSailings())).toEqual(['2027-03', '2027-04'])
  })
  it('offers the next leg when a sailing starts as another ends', () => {
    const l = browseSailings()
    expect(legBadge(l[0], l)).toEqual({ kind: 'addNext', nights: 14, nextId: 's2' })
    expect(legBadge(l[3], l)).toBeNull()
  })
  it('compares sailings and marks the cheapest night', () => {
    const facts = browseSailings().slice(0, 3).map(sailingFacts)
    expect(facts[0].ports).toEqual(['a', 'b', 'c'])
    expect(facts[0].seaDays).toBe(4)
    expect(compareHighlights(facts).cheapest).toEqual(['s4'])
    expect(compareHighlights([facts[0]]).cheapest).toEqual([])
  })
  it('takes saved sailings in order, at most three, ignoring other kinds', () => {
    expect(savedSailingsToCompare(['ship:x', 'sailing:s2', 'sailing:nope', 'sailing:s1', 'sailing:s3', 'sailing:s4']).map((s) => s.id)).toEqual(['s2', 's1', 's3'])
  })
  it('compares ship facts and flags rows that differ', () => {
    const rows = shipCompareRows([{ id: 'a', name: 'A', className: 'X', depth: 'aboard', decks: 17, tonnage: 1, guests: 1, intro: '', highlights: [] }, { id: 'b', name: 'B', className: 'X', depth: 'browse', decks: 19, tonnage: 1, guests: 1, intro: '', highlights: [] }])
    expect(rows.find((r) => r.key === 'className')!.differs).toBe(false)
    expect(rows.find((r) => r.key === 'decks')!.differs).toBe(true)
  })
  it('counts sailings by region and month', () => {
    const grid = regionMonthGrid(browseSailings(), ['caribbean', 'asia'])
    expect(grid.map((r) => [r.region, r.total])).toEqual([['caribbean', 2], ['med', 2]])
  })
  it('matches a wish: the region is required, month and length score', () => {
    const l = browseSailings()
    expect(matchSailings(l, {})).toEqual([])
    expect(matchSailings(l, { region: 'med', month: '2027-03' }).map((m) => m.sailing.id)).toEqual(['s4'])
    const m = matchSailings(l, { region: 'caribbean', nights: 'week' })
    expect(m.map((x) => x.sailing.id)).toEqual(['s1'])
    expect(m[0].reasons).toContain('nights')
  })
  it('sketches a route inside the canvas, and nothing for ports with no coordinates', () => {
    expect(routeSketch(['unknown'], 300, 200)).toEqual([])
  })
})
