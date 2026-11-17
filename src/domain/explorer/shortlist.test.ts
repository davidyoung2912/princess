import { describe, expect, it } from 'vitest'
import { carryOverVenue, eventKey, parseEventKey, MAX_SAVED_ITEMS, parseTourKey, parseTreatmentKey, reminderAt, reminderId, reminderText, savedKeys, shortlistFrom, toggleSavedKey, tourKey, treatmentKey } from './shortlist'

const lookups = {
  venues: [{ id: 'crown', shipId: 'sun-princess', explorer: 'dining' as const }, { id: 'lotus', shipId: 'sun-princess', explorer: 'spa' as const }],
}
const served = [
  { key: 'tour:coz-snorkel', kind: 'tour', title: 'Reef snorkel', explorer: 'excursions', itemId: 'coz-snorkel', venueId: null, shipId: null },
  { key: 'venue:sun-princess.crown', kind: 'venue', title: 'Crown Grill', explorer: 'dining', itemId: 'crown', venueId: 'crown', shipId: 'sun-princess' },
  { key: 'treatment:sun-princess.massage', kind: 'treatment', title: 'Massage', explorer: 'spa', itemId: 'massage', venueId: 'lotus', shipId: 'sun-princess' },
  { key: 'event:sun-princess.trivia', kind: 'event', title: 'Trivia night', explorer: 'entertainment', itemId: 'trivia', venueId: 'piazza', shipId: 'sun-princess' },
] as const

describe('shortlist keys', () => {
  it('round-trips treatments and tours', () => {
    expect(parseTreatmentKey(treatmentKey('sun-princess', 'massage'))).toEqual({ shipId: 'sun-princess', treatmentId: 'massage' })
    expect(parseTourKey(tourKey('coz-snorkel'))).toBe('coz-snorkel')
    expect(parseTreatmentKey('treatment:nodot')).toBeNull()
    expect(parseTourKey('tour:')).toBeNull()
    expect(parseTourKey('venue:a.b')).toBeNull()
  })
  it('keeps only shortlist kinds', () => {
    expect(savedKeys(['screen:S1', 'taste:like.x', 'venue:sun-princess.crown', 'tour:a', 'treatment:s.t'])).toEqual(['venue:sun-princess.crown', 'tour:a', 'treatment:s.t'])
  })
})

describe('toggleSavedKey', () => {
  it('adds and removes', () => {
    const on = toggleSavedKey(['screen:S1'], 'tour:a')
    expect(on).toEqual({ keys: ['screen:S1', 'tour:a'], full: false })
    expect(toggleSavedKey(on.keys, 'tour:a').keys).toEqual(['screen:S1'])
  })
  it('refuses the eleventh of a kind and leaves the list alone, but not another kind', () => {
    const tours = Array.from({ length: MAX_SAVED_ITEMS }, (_, i) => `tour:t${i}`)
    const refused = toggleSavedKey(tours, 'tour:extra')
    expect(refused.full).toBe(true)
    expect(refused.keys).toEqual(tours)
    expect(toggleSavedKey(tours, 'treatment:s.t').full).toBe(false)
  })
})

describe('shortlistFrom', () => {
  it('keeps the order saved and says where each item opens', () => {
    const items = shortlistFrom(served, 'sun-princess')
    expect(items.map((i) => i.title)).toEqual(['Reef snorkel', 'Crown Grill', 'Massage', 'Trivia night'])
    expect(items[1].to).toBe('/dining-today/crown')
    expect(items[2].to).toBe('/spa-explorer/lotus?book=new&treatment=massage')
    expect(items[3].to).toBe('/entertainment/piazza')
  })
  it('marks a show or event as not bookable', () => {
    expect(shortlistFrom(served, 'sun-princess').map((i) => i.bookable)).toEqual([true, true, true, false])
  })
  it('works before a ship is chosen, and drops other ships', () => {
    expect(shortlistFrom(served, '')).toHaveLength(4)
    expect(shortlistFrom(served, 'star-princess').map((i) => i.kind)).toEqual(['tour'])
  })
  it('drops an item it cannot open', () => {
    expect(shortlistFrom([{ ...served[2], venueId: null }, { ...served[3], venueId: null }], '')).toEqual([])
  })
})

describe('event keys', () => {
  it('round-trips and counts as a shortlist kind with its own limit', () => {
    expect(parseEventKey(eventKey('sun-princess', 'trivia'))).toEqual({ shipId: 'sun-princess', eventId: 'trivia' })
    expect(parseEventKey('event:nodot')).toBeNull()
    expect(savedKeys(['event:s.e', 'screen:S1'])).toEqual(['event:s.e'])
    const events = Array.from({ length: MAX_SAVED_ITEMS }, (_, i) => `event:s.e${i}`)
    expect(toggleSavedKey(events, 'event:s.extra').full).toBe(true)
    expect(toggleSavedKey(events, 'tour:a').full).toBe(false)
  })
})

describe('carryOverVenue', () => {
  it('picks the first saved place in that Explorer', () => {
    const keys = ['venue:sun-princess.lotus', 'venue:sun-princess.crown']
    expect(carryOverVenue(keys, 'dining', lookups.venues)).toBe('crown')
    expect(carryOverVenue(keys, 'entertainment', lookups.venues)).toBeNull()
  })
})

describe('reminders', () => {
  it('goes at nine on the day it opens', () => {
    const at = reminderAt('2027-01-12')
    expect(new Date(at!).getHours()).toBe(9)
    expect(new Date(at!).getDate()).toBe(12)
    expect(reminderAt(undefined)).toBeNull()
    expect(reminderAt('12 Jan')).toBeNull()
  })
  it('has a stable id and wording that promises nothing about availability', () => {
    expect(reminderId('tour:a')).toBe('shortlist:tour:a')
    expect(reminderText('Crown Grill')).toBe('Booking opens today: Crown Grill')
    expect(reminderText('x'.repeat(200)).length).toBe(80)
    expect(reminderText('Crown Grill')).not.toMatch(/guarantee|available|secured/i)
  })
})
