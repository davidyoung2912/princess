import { DECKS, placeById, type Section } from '../../../domain/deck'

/** Where a venue sits on the deck plan: a known place, or the deck and section read from its authored label ("Deck 7 aft"). */
export interface VenueSpot {
  deck: number
  section: Section
  /** The map place the venue is drawn at, when the map lists it. */
  placeId?: string
}

const SECTION_WORDS: readonly Section[] = ['forward', 'midship', 'aft']

/**
 * The spot of a venue on the deck plan. A venue whose `placeId` is a place on the map uses it. Otherwise the first deck number in the deck label and its section word
 * give a spot at the middle of that section (midship when the label names none). Labels with no deck ("Near Guest Services", "Upper aft decks") have no spot.
 */
export function venueSpot(venue: { placeId: string; deckLabel: string }): VenueSpot | null {
  const place = placeById(venue.placeId)
  if (place) return { deck: place.deck, section: place.section, placeId: place.id }
  const deck = Number(/\bDecks?\s+(\d+)/i.exec(venue.deckLabel)?.[1])
  if (!Number.isInteger(deck) || deck < 1) return null
  const section = SECTION_WORDS.find((s) => new RegExp(`\\b${s}\\b`, 'i').test(venue.deckLabel)) ?? 'midship'
  return { deck, section }
}

const SHIP_KEYS: Record<string, string> = { 'sun-princess': 'sun', 'sky-princess': 'sky', 'sapphire-princess': 'sapphire' }

/**
 * Where "Navigate" goes, or null when the venue has no deck. The schematic deck map (`/ship/map`, which can mark a spot) covers only the decks it lists, so a venue on one of those opens it with a mark;
 * a venue on any other deck opens the deck plan picture of its ship at that deck, with no mark. The name travels in the link so the page can say what it is showing.
 */
export function navigatePath(venue: { title: string; shipId: string; placeId: string; deckLabel: string }): string | null {
  const spot = venueSpot(venue)
  if (!spot) return null
  const q = new URLSearchParams({ deck: String(spot.deck), section: spot.section, to: venue.title })
  if (DECKS.includes(spot.deck)) {
    if (spot.placeId) q.set('place', spot.placeId)
    return `/ship/map?${q.toString()}`
  }
  q.set('ship', SHIP_KEYS[venue.shipId] ?? 'sun')
  return `/deck-plans?${q.toString()}`
}

/** The spot named by a Navigate link's query, or null when it is missing or malformed. */
export function spotFromQuery(params: URLSearchParams): (VenueSpot & { label: string }) | null {
  const deck = Number(params.get('deck'))
  const section = params.get('section') as Section | null
  const label = (params.get('to') ?? '').trim().slice(0, 80)
  if (!Number.isInteger(deck) || deck < 1 || !section || !SECTION_WORDS.includes(section) || label === '') return null
  const placeId = params.get('place') ?? undefined
  return { deck, section, label, ...(placeId && placeById(placeId) ? { placeId } : {}) }
}

/** Where "Take me there" goes for a place on the schematic map, or null when the map does not list it. Used for a ship event's place and a meeting point. */
export function placeNavigatePath(placeId: string): string | null {
  const place = placeById(placeId)
  if (!place) return null
  return `/ship/map?${new URLSearchParams({ deck: String(place.deck), section: place.section, to: place.name, place: place.id }).toString()}`
}
