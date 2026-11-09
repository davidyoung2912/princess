import { DECKS, elevatorsNear, placeById, placesOnDeck, type Place, type Section } from './deck'
import { cabinPlace, SECTION_ORDER, wayBetween } from './deckGraph'

/**
 * Visual ship literacy (QOL-17): a short orientation that teaches deck logic and the way from a cabin to common destinations. Pure data and
 * wording inputs, no React. It is built from the deck plan and graph the route finder uses, so it never disagrees with them; it is a
 * teaching aid, not navigation, and the screen says so and points to the route finder.
 */

/** The common destinations taught first. Ids that the focused ship does not list are dropped. */
export const LITERACY_DESTINATIONS: readonly string[] = ['guest-services', 'piazza', 'eclipse', 'lido', 'medical', 'landing']

export interface LiteracyStop {
  place: Place
  /** Decks up (positive) or down (negative) from the cabin; 0 is the same deck. */
  decksUp: number
  /** Sections along the ship: positive is toward the stern, negative toward the bow, 0 is the same section. */
  sectionsAft: number
  /** The lift banks passed through on the way, in order, without repeats. */
  banks: string[]
  /** False when the graph has no way (never for the listed places, but kept honest). */
  reachable: boolean
}

export interface ShipLiteracy {
  cabin: Place
  /** The lift banks in the cabin's section. */
  nearBanks: string[]
  stops: LiteracyStop[]
}

const sectionIndex = (s: Section): number => SECTION_ORDER.indexOf(s)

/** The orientation for a cabin number, or null when the number is not a cabin on this ship. */
export function shipLiteracy(cabinNumber: string): ShipLiteracy | null {
  const cabin = cabinPlace(cabinNumber.trim())
  if (!cabin) return null
  const stops = LITERACY_DESTINATIONS.flatMap((id): LiteracyStop[] => {
    const place = placeById(id)
    if (!place) return []
    const way = wayBetween(cabin, place)
    const banks = way ? [...new Set(way.flatMap((w) => (w.kind === 'lift' ? [w.bank] : [])))] : []
    return [{ place, decksUp: place.deck - cabin.deck, sectionsAft: sectionIndex(place.section) - sectionIndex(cabin.section), banks, reachable: way !== null }]
  })
  return { cabin, nearBanks: elevatorsNear(cabin).map((e) => e.bank), stops }
}

/** One row of the side-on cutaway: a deck, what kinds of public rooms it has, and whether the cabin or a destination is on it. */
export interface CutawayDeck { deck: number; count: number; cabin: boolean; destinations: string[] }

/** The decks from top to bottom with the cabin's deck included even when it has no listed public rooms (cabin decks usually have none). */
export function cutaway(lit: ShipLiteracy): CutawayDeck[] {
  const decks = [...new Set([...DECKS, lit.cabin.deck])].sort((a, b) => b - a)
  return decks.map((deck) => ({
    deck,
    count: placesOnDeck(deck).length,
    cabin: deck === lit.cabin.deck,
    destinations: lit.stops.filter((s) => s.place.deck === deck).map((s) => s.place.name),
  }))
}
