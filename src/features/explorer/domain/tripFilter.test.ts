import { describe, expect, it } from 'vitest'
import { filterTripItems, NO_TRIP_FILTER, readKinds, tripSearchText, writeKinds } from './tripFilter'

const item = (o: Partial<Parameters<typeof tripSearchText>[0]> & { kind: 'dining' | 'spa' | 'tour' }) => ({ title: 'Crown Grill', venueTitle: 'Crown Grill', day: 3, date: '2027-03-14', id: 'r-77', start: '19:00', ...o })
const items = [
  item({ kind: 'dining' }),
  item({ kind: 'spa', title: 'Hot stone massage', venueTitle: 'Lotus Spa', day: 4, date: '2027-03-15', id: 's-1', start: '10:30' }),
  item({ kind: 'tour', title: 'Snorkel and beach', venueTitle: 'Snorkel and beach', day: 5, date: '2027-03-16', id: 't-9', start: '09:00' }),
]

describe('trip filter', () => {
  it('shows everything with no filter', () => { expect(filterTripItems(items, NO_TRIP_FILTER)).toHaveLength(3) })
  it('filters by kind', () => {
    expect(filterTripItems(items, { kinds: new Set(['spa']), query: '' }).map((i) => i.id)).toEqual(['s-1'])
    expect(filterTripItems(items, { kinds: new Set(['spa', 'tour']), query: '' })).toHaveLength(2)
  })
  it('finds by venue, kind word, day, date and reference', () => {
    const find = (query: string) => filterTripItems(items, { kinds: new Set(), query }).map((i) => i.id)
    expect(find('lotus')).toEqual(['s-1'])
    expect(find('dinner')).toEqual(['r-77'])
    expect(find('day 5')).toEqual(['t-9'])
    expect(find('march 14')).toEqual(['r-77'])
    expect(find('2027-03-16')).toEqual(['t-9'])
    expect(find('r-77')).toEqual(['r-77'])
    expect(find('Crown   GRILL')).toEqual(['r-77'])
    expect(find('nothing here')).toEqual([])
  })
  it('needs every word to match', () => { expect(filterTripItems(items, { kinds: new Set(), query: 'crown snorkel' })).toEqual([]) })
  it('reads and writes the address list', () => {
    expect([...readKinds('spa,bogus,dining')].sort()).toEqual(['dining', 'spa'])
    expect(writeKinds(new Set(['tour', 'dining']))).toBe('dining,tour')
    expect(writeKinds(new Set())).toBeNull()
    expect(readKinds(null).size).toBe(0)
  })
})
