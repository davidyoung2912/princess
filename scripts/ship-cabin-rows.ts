// The sample decks, muster stations and staterooms of the ships other than Sun Princess, as SQL rows for the catalogue seed.
// Lives apart from catalogue.ts because it reads the client's cabin generator (src), which the node tsconfig does not include.
import { cabinsFor, ownCategoryId, SHIP_CABINS, SUN_SHIP } from '../src/domain/cabins.ts'
import { q, shipPrefix, type CatalogueSource, type ShipCabinRows } from './catalogue.ts'

const bit = (v: boolean) => (v ? '1' : '0')

/** The sample muster stations of the other ships (as `AboardPlans.cs`): letter, place, deck. Sun Princess's are seeded by 01-ship.sql. */
const MUSTER_SAMPLE: Record<string, readonly (readonly [string, string, number])[]> = {
  'sky-princess': [['A', 'Princess Theater, port side', 7], ['B', 'Princess Theater, starboard side', 7], ['C', 'The Piazza, port side', 5], ['D', 'The Piazza, starboard side', 5], ['E', 'Concerto Dining Room', 7], ['F', 'Allegro Dining Room', 6]],
  'sapphire-princess': [['A', 'Princess Theater, port side', 6], ['B', 'Princess Theater, starboard side', 6], ['C', 'The Piazza, port side', 5], ['D', 'The Piazza, starboard side', 5], ['E', 'Vivaldi Dining Room', 6], ['F', 'Santa Fe Dining Room', 5]],
}

/** The sample staterooms, decks and muster stations of the ships other than Sun Princess (AB2): the same generator the server runs, so the rows match `CabinRules`. */
export function shipCabinRows(c: CatalogueSource): ShipCabinRows {
  const ships = c.ships.filter((s) => s.id !== SUN_SHIP && SHIP_CABINS[s.id] && MUSTER_SAMPLE[s.id])
  const decks: string[][] = []
  const stations: string[][] = []
  const cabins: string[][] = []
  for (const ship of ships) {
    const prefix = shipPrefix(ship.id)
    const stationId = (letter: string) => `${prefix}-station-${letter.toLowerCase()}`
    const rows = Object.keys(SHIP_CABINS[ship.id].decks).flatMap((roomClass) => cabinsFor('x', ownCategoryId(ship.id, roomClass), ship.id).map((x) => ({ roomClass, x })))
    const deckNumbers = [...new Set([...rows.map((r) => r.x.deck), ...MUSTER_SAMPLE[ship.id].map((m) => m[2])])].sort((a, b) => a - b)
    for (const d of deckNumbers) decks.push([q(ship.id), String(d), q(`Deck ${d}`), q('')])
    for (const [letter, place, deck] of MUSTER_SAMPLE[ship.id]) stations.push([q(stationId(letter)), q(ship.id), q(`Station ${letter}`), q(place), String(deck)])
    // A stateroom's muster station is the one beside its elevator bank: A/B forward, C/D midship, E/F aft, port then starboard.
    for (const { roomClass, x } of rows) {
      const letter = 'ABCDEF'[['forward', 'midship', 'aft'].indexOf(x.position) * 2 + (x.side === 'port' ? 0 : 1)]
      cabins.push([q(ship.id), q(x.number), q(ownCategoryId(ship.id, roomClass)), String(x.deck), q(x.position === 'forward' ? 'fwd' : x.position === 'midship' ? 'mid' : 'aft'), q(x.side), bit(x.accessible), '0', q(stationId(letter))])
    }
  }
  return { decks, stations, cabins }
}

