// Finds a cabin on the deck plan pictures. Positions are pixel positions on the plan image, read from the printed cabin numbers
// (see scripts/deckplans); the plans are tall strips with the bow at the top, so the left edge is the port side.
import sapphireData from './cabins/sapphire.json'
import skyData from './cabins/sky.json'
import sunData from './cabins/sun.json'
import type { DeckPlanShip } from './deckPlans'

interface ShipCabins {
  /** Deck number to [image width, image height]. */
  decks: Record<string, [number, number]>
  /** Cabin number to [deck, x, y] with a trailing 1 when the position was estimated from the cabins either side. */
  cabins: Record<string, [number, number, number] | [number, number, number, number]>
}

const DATA: Record<DeckPlanShip, ShipCabins> = {
  sun: sunData as unknown as ShipCabins,
  sky: skyData as unknown as ShipCabins,
  sapphire: sapphireData as unknown as ShipCabins,
}

export type CabinSide = 'port' | 'starboard' | 'middle'
export type CabinEnd = 'forward' | 'midship' | 'aft'

export interface CabinLocation {
  ship: DeckPlanShip
  cabin: string
  deck: number
  /** Position on the deck plan image, in image pixels. */
  x: number
  y: number
  side: CabinSide
  end: CabinEnd
  /** True when the position was worked out from the neighbouring cabins rather than read from the cabin's own label. */
  estimated: boolean
}

/** Upper-cases and drops spaces, dashes and dots, so "d 422" and "D-422" find D422. */
export function normalizeCabin(input: string): string {
  return input.toUpperCase().replace(/[\s\-.]/g, '')
}

function locate(ship: DeckPlanShip, cabin: string): CabinLocation | null {
  const data = DATA[ship]
  const hit = data.cabins[cabin]
  if (!hit) return null
  const [deck, x, y] = hit
  const [width, height] = data.decks[String(deck)]
  const across = x / width
  const along = y / height
  return {
    ship,
    cabin,
    deck,
    x,
    y,
    side: across < 0.4 ? 'port' : across > 0.6 ? 'starboard' : 'middle',
    end: along < 1 / 3 ? 'forward' : along < 2 / 3 ? 'midship' : 'aft',
    estimated: hit.length === 4,
  }
}

const ORDER: readonly DeckPlanShip[] = ['sun', 'sky', 'sapphire']

/** Looks for a cabin on the preferred ship first, then the other two. Returns null when no plan has it. */
export function findCabin(input: string, preferred: DeckPlanShip): CabinLocation | null {
  const cabin = normalizeCabin(input)
  if (cabin === '') return null
  for (const ship of [preferred, ...ORDER.filter((s) => s !== preferred)]) {
    const found = locate(ship, cabin)
    if (found) return found
  }
  return null
}

/** How many cabins have a position on a ship's plans. */
export function cabinCount(ship: DeckPlanShip): number {
  return Object.keys(DATA[ship].cabins).length
}
