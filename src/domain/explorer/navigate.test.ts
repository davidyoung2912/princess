import { describe, expect, it } from 'vitest'
import { navigatePath, spotFromQuery, venueSpot } from './navigate'

describe('venueSpot', () => {
  it('uses a place on the map', () => {
    expect(venueSpot({ placeId: 'soleil', deckLabel: 'Deck 6 aft' })).toEqual({ deck: 6, section: 'aft', placeId: 'soleil' })
  })
  it('reads the deck and section from the label', () => {
    expect(venueSpot({ placeId: 'nope', deckLabel: 'Deck 7 forward and midship' })).toEqual({ deck: 7, section: 'forward' })
    expect(venueSpot({ placeId: 'nope', deckLabel: 'Decks 5 and 6 forward' })).toEqual({ deck: 5, section: 'forward' })
  })
  it('puts a label with a deck but no section midship', () => {
    expect(venueSpot({ placeId: 'nope', deckLabel: 'Deck 9' })).toEqual({ deck: 9, section: 'midship' })
  })
  it('has no spot without a deck', () => {
    expect(venueSpot({ placeId: 'nope', deckLabel: 'Near Guest Services' })).toBeNull()
    expect(venueSpot({ placeId: 'nope', deckLabel: 'Upper aft decks' })).toBeNull()
  })
})

describe('navigatePath and spotFromQuery', () => {
  it('round-trips', () => {
    const path = navigatePath({ title: 'Crown Grill', shipId: 'sun-princess', placeId: 'crown', deckLabel: 'Deck 7 aft' })!
    const spot = spotFromQuery(new URL(path, 'http://x').searchParams)
    expect(spot?.label).toBe('Crown Grill')
    expect(spot?.deck).toBeGreaterThan(0)
  })
  it('opens the deck plan picture for a deck the map does not list', () => {
    const path = navigatePath({ title: 'Lido Pool', shipId: 'sky-princess', placeId: 'nope', deckLabel: 'Deck 16 aft' })!
    expect(path.startsWith('/deck-plans?')).toBe(true)
    expect(new URL(path, 'http://x').searchParams.get('ship')).toBe('sky')
  })
  it('rejects a bad query', () => {
    expect(spotFromQuery(new URLSearchParams('deck=0&section=aft&to=X'))).toBeNull()
    expect(spotFromQuery(new URLSearchParams('deck=7&section=up&to=X'))).toBeNull()
    expect(spotFromQuery(new URLSearchParams('deck=7&section=aft'))).toBeNull()
  })
})

describe('placeNavigatePath', () => {
  it('opens the map at a listed place and says where it is', async () => {
    const { PLACES } = await import('../deck')
    const { placeNavigatePath } = await import('./navigate')
    const p = PLACES[0]!
    const path = placeNavigatePath(p.id)!
    const q = new URLSearchParams(path.split('?')[1])
    expect(path.startsWith('/ship/map?')).toBe(true)
    expect(q.get('place')).toBe(p.id)
    expect(q.get('deck')).toBe(String(p.deck))
    expect(q.get('section')).toBe(p.section)
    expect(q.get('to')).toBe(p.name)
  })
  it('has nowhere to go for an unknown place', async () => {
    const { placeNavigatePath } = await import('./navigate')
    expect(placeNavigatePath('nowhere')).toBeNull()
  })
})
