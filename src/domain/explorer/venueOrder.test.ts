import { describe, expect, it } from 'vitest'
import { MAX_VENUE_PINS, orderVenues, parseVenuePinKey, pinsIn, togglePinKey, venuePinKey } from './venueOrder'

const v = (id: string, explorer: 'dining' | 'spa' = 'dining', shipId = 'sun-princess') => ({ id, shipId, explorer })

describe('venue pin keys', () => {
  it('round-trips, including ids with dots or colons', () => {
    expect(parseVenuePinKey(venuePinKey('sun-princess', 'crown'))).toEqual({ shipId: 'sun-princess', venueId: 'crown' })
    expect(parseVenuePinKey(venuePinKey('sun-princess', 'a.b:c'))).toEqual({ shipId: 'sun-princess', venueId: 'a.b:c' })
  })
  it('refuses other things', () => {
    for (const bad of ['port:x', 'venue:', 'venue:ship', 'venue:.x', 'venue:ship.', 5, null]) expect(parseVenuePinKey(bad)).toBeNull()
  })
})

describe('orderVenues', () => {
  const list = [v('a'), v('b'), v('c'), v('d')]
  it('puts pinned venues first and keeps each group in its own order', () => {
    expect(orderVenues(list, [venuePinKey('sun-princess', 'c'), venuePinKey('sun-princess', 'a')]).map((x) => x.id)).toEqual(['a', 'c', 'b', 'd'])
  })
  it('ignores pins for other ships and unknown venues', () => {
    expect(orderVenues(list, [venuePinKey('sky-princess', 'c'), venuePinKey('sun-princess', 'zzz')]).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('with no pins returns the same order as a new array', () => {
    const out = orderVenues(list, [])
    expect(out).toEqual(list)
    expect(out).not.toBe(list)
  })
})

describe('togglePinKey', () => {
  const key = (i: number) => venuePinKey('s', `v${i}`)
  it('adds then removes', () => {
    const on = togglePinKey([], key(1), () => true)
    expect(on).toEqual({ keys: [key(1)], full: false })
    expect(togglePinKey(on.keys, key(1), () => true)).toEqual({ keys: [], full: false })
  })
  it('refuses a new pin when the Explorer is full, but still lets one go', () => {
    const full = Array.from({ length: MAX_VENUE_PINS }, (_, i) => key(i))
    expect(togglePinKey(full, key(99), () => true)).toEqual({ keys: full, full: true })
    expect(togglePinKey(full, key(0), () => true).keys).toHaveLength(MAX_VENUE_PINS - 1)
  })
  it('counts only the pins of the Explorer in question', () => {
    const others = Array.from({ length: MAX_VENUE_PINS }, (_, i) => key(i))
    expect(togglePinKey(others, key(99), () => false).full).toBe(false)
  })
})

describe('pinsIn', () => {
  it('keeps the pins that belong to the Explorer', () => {
    const venues = [v('a'), v('s', 'spa')]
    const keys = [venuePinKey('sun-princess', 'a'), venuePinKey('sun-princess', 's')]
    expect(pinsIn(venues, keys, 'dining')).toEqual([keys[0]])
  })
})
