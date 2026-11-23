// Static deck plan images (one tall strip per deck), served from public/deckplans.
// Source: cruisedeckplans.com (personal use only); replace with official Princess plans before release.

export type DeckPlanShip = 'sun' | 'sky' | 'sapphire'

export const SHIP_NAMES: Record<DeckPlanShip, string> = {
  sun: 'Sun Princess',
  sky: 'Sky Princess',
  sapphire: 'Sapphire Princess',
}

export interface DeckPlan {
  deck: number
  /** Deck name where the ship uses names (Sapphire Princess). */
  name?: string
  src: string
}

const DECKS: Record<DeckPlanShip, readonly number[]> = {
  sun: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21],
  sky: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19],
  sapphire: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17],
}

const SAPPHIRE_NAMES: Record<number, string> = {
  17: 'Sky',
  16: 'Sports',
  15: 'Sun',
  14: 'Lido',
  12: 'Aloha',
  11: 'Baja',
  10: 'Caribe',
  9: 'Dolphin',
  8: 'Emerald',
  7: 'Promenade',
  6: 'Fiesta',
  5: 'Plaza',
  4: 'Gala',
}

/** Deck plans for a ship, lowest deck first. */
export function deckPlansFor(ship: DeckPlanShip): DeckPlan[] {
  return DECKS[ship].map((deck) => ({
    deck,
    name: ship === 'sapphire' ? SAPPHIRE_NAMES[deck] : undefined,
    src: `/deckplans/${ship}/deck-${deck}.gif`,
  }))
}
