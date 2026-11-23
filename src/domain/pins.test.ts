import { describe, expect, it } from 'vitest'
import { pinsToUpload, reorderScreenKeys, screenIdsOf, screenPinKey, toggleScreenKey, toggleVenueKey, venueKeysOf } from './pins'
import { MAX_VENUE_PINS, venuePinKey } from '../features/explorer/domain/venueOrder'

describe('screen pins', () => {
  it('reads the screen ids of a favourites list in order, leaving other kinds out', () => {
    expect(screenIdsOf(['sailing:a', 'screen:S2', 'venue:s.v', 'screen:S1'])).toEqual(['S2', 'S1'])
  })

  it('adds a pin at the end and takes it away on a second tap', () => {
    const on = toggleScreenKey(['sailing:a'], 'S1')
    expect(on).toEqual(['sailing:a', 'screen:S1'])
    expect(toggleScreenKey(on, 'S1')).toEqual(['sailing:a'])
  })

  it('lets the oldest pin make room when five are pinned, as the server does', () => {
    const five = ['S1', 'S2', 'S3', 'S4', 'S5'].map(screenPinKey)
    expect(screenIdsOf(toggleScreenKey(five, 'S6'))).toEqual(['S2', 'S3', 'S4', 'S5', 'S6'])
  })

  it('puts the pinned screens in the given order and keeps other kinds where they were', () => {
    const keys = ['screen:S1', 'sailing:a', 'screen:S2', 'screen:S3']
    expect(reorderScreenKeys(keys, ['S3', 'S1'])).toEqual(['screen:S3', 'sailing:a', 'screen:S1', 'screen:S2'])
  })

  it('ignores ids that are not pinned when putting in order', () => {
    expect(reorderScreenKeys(['screen:S1'], ['S9', 'S1'])).toEqual(['screen:S1'])
  })

  it('works out which old device pins still have to go up', () => {
    expect(pinsToUpload(['S1', 'S2', 'S3'], ['screen:S2'])).toEqual(['S1', 'S3'])
    expect(pinsToUpload([], ['screen:S2'])).toEqual([])
  })
})

describe('venue pins', () => {
  it('reads the venue pins of a list', () => {
    expect(venueKeysOf(['screen:S1', venuePinKey('sun-princess', 'crown'), 'venue:bad'])).toEqual([venuePinKey('sun-princess', 'crown')])
  })

  it('pins, unpins and refuses when the Explorer is full', () => {
    const none = toggleVenueKey([], 'sun-princess', 'crown', () => true)
    expect(none).toMatchObject({ outcome: 'pinned', keys: [venuePinKey('sun-princess', 'crown')] })
    expect(toggleVenueKey(none.keys, 'sun-princess', 'crown', () => true)).toMatchObject({ outcome: 'unpinned', keys: [] })
    const full = Array.from({ length: MAX_VENUE_PINS }, (_, i) => venuePinKey('sun-princess', `v${i}`))
    expect(toggleVenueKey(full, 'sun-princess', 'new', () => true)).toMatchObject({ outcome: 'full', keys: full })
  })
})
