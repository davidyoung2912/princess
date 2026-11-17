import { describe, expect, it } from 'vitest'
import { carryOverVenue, MAX_SAVED_ITEMS, parseTourKey, parseTreatmentKey, reminderAt, reminderId, reminderText, savedKeys, shortlistItems, toggleSavedKey, tourKey, treatmentKey } from './shortlist'

const lookups = {
  shipId: 'sun-princess',
  venues: [{ id: 'crown', shipId: 'sun-princess', explorer: 'dining' as const, title: 'Crown Grill' }, { id: 'lotus', shipId: 'sun-princess', explorer: 'spa' as const, title: 'Lotus Spa' }],
  treatments: [{ id: 'massage', venueId: 'lotus', title: 'Massage' }],
  tours: [{ id: 'coz-snorkel', name: 'Reef snorkel' }],
}

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

describe('shortlistItems', () => {
  it('names each item in the order saved and says where it books', () => {
    const items = shortlistItems(['tour:coz-snorkel', 'venue:sun-princess.crown', 'treatment:sun-princess.massage'], lookups)
    expect(items.map((i) => i.title)).toEqual(['Reef snorkel', 'Crown Grill', 'Massage'])
    expect(items[1].bookTo).toBe('/dining-today/crown')
    expect(items[2].bookTo).toBe('/spa-explorer/lotus?book=new&treatment=massage')
  })
  it('leaves out items that are not on this ship', () => {
    expect(shortlistItems(['venue:other.crown', 'treatment:other.massage', 'tour:gone', 'screen:S1'], lookups)).toEqual([])
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
