import { describe, expect, it } from 'vitest'
import type { ExplorerVenueInfo, HoursDay, MealMenu, VenueDay } from '../../api/explorerTypes'
import { dishHits, filterDining, matchesPrompt, NO_DINING_FILTER, servesPeriod, sortDining } from './diningDiscovery'

const hours = (...windows: [string, string][]): HoursDay => ({ windows, staffed: [], closedBecause: null })
const menu = (meal: MealMenu['meal'], ...dishes: string[]): MealMenu => ({ venueId: 'x', meal, from: '12:00', to: '14:00', title: meal, formal: false, courses: [{ name: 'c', dishes: dishes.map((name) => ({ name, contains: [] })) }] })
const day = (id: string, kind: string, h: HoursDay, extra: Partial<ExplorerVenueInfo> = {}, menus: MealMenu[] = []): VenueDay => ({
  venue: { id, shipId: 's', explorer: 'dining', kind, title: id, short: '', long: '', placeId: 'p', deckLabel: '', bookable: 'none', order: 0, features: [], accessibility: [], ...extra }, hours: h, events: [], menus,
})

const buffet = day('buffet', 'casual', hours(['06:00', '24:00']), { family: ['High chairs'], kidsMenu: ['Pasta'] }, [menu('lunch', 'Penne arrabbiata')])
const steak = day('steak', 'specialty', hours(['17:30', '21:30']), { cover: 3500 })
const dining = day('dining', 'main', hours(['07:00', '09:30'], ['17:30', '21:30']), { family: ['Boosters'] })
const pub = day('pub', 'bar', hours(['16:00', '24:00']), { minAge: 18 })
const all = [steak, pub, buffet, dining]

describe('servesPeriod', () => {
  it('is true when the hours overlap the period', () => {
    expect(servesPeriod(steak.hours, 'dinner')).toBe(true)
    expect(servesPeriod(steak.hours, 'lunch')).toBe(false)
    expect(servesPeriod(steak.hours, 'late')).toBe(false)
    expect(servesPeriod(dining.hours, 'breakfast')).toBe(true)
  })
  it('does not count a window that only touches the period', () => {
    expect(servesPeriod(hours(['10:30', '11:30']), 'breakfast')).toBe(false)
    expect(servesPeriod(hours(['10:30', '11:30']), 'lunch')).toBe(false)
  })
  it('finds places open late', () => {
    expect(servesPeriod(pub.hours, 'late')).toBe(true)
  })
})

describe('prompts', () => {
  it('matches each ready-made prompt', () => {
    expect(matchesPrompt(buffet, 'quick')).toBe(true)
    expect(matchesPrompt(steak, 'occasion')).toBe(true)
    expect(matchesPrompt(steak, 'included')).toBe(false)
    expect(matchesPrompt(dining, 'included')).toBe(true)
    expect(matchesPrompt(pub, 'included')).toBe(false)
    expect(matchesPrompt(pub, 'late')).toBe(true)
  })
  it('keeps adults-only places and bars out of family-friendly', () => {
    expect(all.filter((d) => matchesPrompt(d, 'family')).map((d) => d.venue.id)).toEqual(['buffet', 'dining'])
  })
})

describe('dish search', () => {
  it('finds a dish by words in its name, ignoring case', () => {
    expect(dishHits(buffet.menus, 'ARRABB')).toEqual([{ name: 'Penne arrabbiata', meal: 'lunch' }])
    expect(dishHits(buffet.menus, 'penne pizza')).toEqual([])
    expect(dishHits(buffet.menus, '  ')).toEqual([])
  })
  it('lets a dish find its venue', () => {
    expect(filterDining(all, { ...NO_DINING_FILTER, query: 'penne' }).map((d) => d.venue.id)).toEqual(['buffet'])
  })
})

describe('filterDining', () => {
  it('combines the filters', () => {
    expect(filterDining(all, { ...NO_DINING_FILTER, period: 'dinner', kind: 'main' }).map((d) => d.venue.id)).toEqual(['dining'])
    expect(filterDining(all, { ...NO_DINING_FILTER, kidsMenu: true }).map((d) => d.venue.id)).toEqual(['buffet'])
    expect(filterDining(all, NO_DINING_FILTER)).toHaveLength(4)
  })
})

describe('sortDining', () => {
  const o = { chosenDay: 2, currentDay: 2, now: '18:00' }
  it('keeps the given order when suggested', () => {
    expect(sortDining(all, 'suggested', o).map((d) => d.venue.id)).toEqual(['steak', 'pub', 'buffet', 'dining'])
  })
  it('puts what is open now first, then what opens later, keeping order among equals', () => {
    const late = day('late', 'main', hours(['20:00', '22:00']))
    const shut = day('shut', 'main', hours(['07:00', '09:00']))
    expect(sortDining([shut, late, steak, buffet], 'open', o).map((d) => d.venue.id)).toEqual(['steak', 'buffet', 'late', 'shut'])
  })
  it('puts the cheapest first', () => {
    expect(sortDining(all, 'price', o).map((d) => d.venue.id)).toEqual(['pub', 'buffet', 'dining', 'steak'])
  })
})
