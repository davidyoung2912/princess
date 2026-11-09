import type { Cabin, Position, Side } from './cabins'

/**
 * The cabin map (DSC-05) and nearby cabins (DSC-12). Pure, no React. The map is a schematic of one deck (forward at the left, port above,
 * starboard below); the staterooms are modelled samples, so "nearby" means the same deck and the same or a neighbouring part of the ship.
 * It does not mean connecting: whether a door joins two staterooms is not known (see `comfortIndicators`).
 */
export const POSITION_ORDER: readonly Position[] = ['forward', 'midship', 'aft']
export const SIDE_ORDER: readonly Side[] = ['port', 'starboard']
const idx = (c: Cabin): number => POSITION_ORDER.indexOf(c.position)

/** One deck as rows (port, starboard) of columns (forward, midship, aft); each cell holds the staterooms there. */
export interface DeckMap { deck: number; rows: { side: Side; cells: { position: Position; cabins: Cabin[] }[] }[] }

export function deckMaps(cabins: readonly Cabin[]): DeckMap[] {
  const decks = [...new Set(cabins.map((c) => c.deck))].sort((a, b) => a - b)
  return decks.map((deck) => ({
    deck,
    rows: SIDE_ORDER.map((side) => ({ side, cells: POSITION_ORDER.map((position) => ({ position, cabins: cabins.filter((c) => c.deck === deck && c.side === side && c.position === position) })) })),
  }))
}

/** How many staterooms a party needs: the guests over what one room of this type holds. */
export const cabinsNeeded = (guests: number, capacity: number): number => Math.max(1, Math.ceil(guests / Math.max(1, capacity)))

/** Sets of `size` free staterooms on one deck that lie within one part of the ship of each other. Empty when `size` is 1 or none fit. */
export function nearbyGroups(cabins: readonly Cabin[], size: number): Cabin[][] {
  if (size < 2) return []
  const out: Cabin[][] = []
  const decks = [...new Set(cabins.map((c) => c.deck))].sort((a, b) => a - b)
  for (const deck of decks) {
    const free = cabins.filter((c) => c.deck === deck && c.available).sort((a, b) => idx(a) - idx(b) || a.number.localeCompare(b.number))
    for (let i = 0; i + size <= free.length; i++) {
      const run = free.slice(i, i + size)
      if (idx(run[run.length - 1]) - idx(run[0]) <= 1) out.push(run)
    }
  }
  return out
}

/** The answer when the inventory is looked at again just before a stateroom is kept: still free, taken meanwhile, or no longer offered. */
export function recheck(fresh: readonly Cabin[], number: string): 'free' | 'taken' | 'gone' {
  const c = fresh.find((x) => x.number === number)
  return !c ? 'gone' : c.available ? 'free' : 'taken'
}
