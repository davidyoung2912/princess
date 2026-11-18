/** The facts of Sun Princess, the ship the server's `/reference/ship` serves, swapped in by `replaceShip`; the authored values show until it arrives. All three ships are at `aboard` depth; the others come from the catalogue (`shipCatalogue.ts`). */
export interface ShipFacts {
  id: string; name: string; className: string; entered: number; tonnage: number; length: string; guests: number; crew: number
  staterooms: number; accessibleStaterooms: number; connectingStaterooms: number; decks: number; sanctuaryStaterooms: number; intro: string
}

/** The authored values show until the server's reference arrives; `replaceShip` swaps every table below in place (see `shipServed.ts`). */
export const SUN_SHIP: ShipFacts = {
  id: 'sun-princess',
  name: 'Sun Princess',
  className: 'Sphere class',
  entered: 2024,
  tonnage: 177_882,
  length: '1,133 ft',
  guests: 4300,
  crew: 1600,
  staterooms: 2157,
  accessibleStaterooms: 51,
  connectingStaterooms: 100,
  decks: 21,
  sanctuaryStaterooms: 215,
  intro: 'Princess’s newest ship, built around the Piazza, a three-level gathering place under a glass Sphere, and the Dome, a glass-roofed pool by day and a theatre by night.',
}

export const SHIP_HIGHLIGHTS: readonly { title: string; body: string }[] = [
  { title: 'The Piazza', body: "The heart of the ship: a three-level gathering place under the glass Sphere, open from morning coffee until late. Each level has cafés, bars and live music, and through the day there are game shows, roaming performers and dancing. It is the easiest place to meet your group, so many guests make it their usual meeting point." },
  { title: 'The Dome', body: "A glass dome on decks 17 and 18. By day it is a pool and lounge with views out to sea in any weather. By night it becomes a theatre with acrobatic shows, and late in the evening it turns into a dance party. Show times appear in Today’s Plan, and seats go quickly, so arrive early." },
  { title: 'Princess Arena', body: "The main show venue, seating about 900. The seating is set up three ways (a traditional stage, a keyhole and in the round) so each production can use the room differently. Arrive about half an hour early for a good seat, and ask a crew member about wheelchair-accessible places." },
  { title: 'Dining included', body: "Three dining rooms serve breakfast, lunch and dinner at no extra charge, with menus that change each night. The Eatery buffet, the Americana Diner, casual grills and pizza are open through the day, and room service runs 24 hours. Menus flag dietary needs and allergens, and you can tell your server about them on your first night." },
  { title: 'Specialty dining', body: "Steakhouse, Italian, seafood, sushi, teppanyaki and a prix fixe with sea views. Each is at an extra charge unless your package covers it, and tables are limited, so reserve before you sail or on the first day. Stanley can check what your package covers and book a table for you." },
  { title: 'Kids and teens', body: "Three clubs by age, all on decks 6 and 7: Firefly Park (3–7), Neon Grove (8–12) and The Underground (13–17). Each has games, crafts, sports and evening activities led by youth staff. Register your children before you sail so signing in at the door is quick, and ask staff about pickup and sign-out rules." },
  { title: 'The Sanctuary', body: "An adults-only retreat on deck 18 for guests in the Sanctuary Collection of 215 staterooms. It is a quieter place to lounge, with its own bar and dining, away from the busier decks. Guests under 18 are not admitted." },
]

/** A stateroom type id: Sun Princess's six (`interior`, `oceanview`, `balcony`, `miniSuite`, `sanctuaryMiniSuite`, `signatureSuite`) or another ship's own (`sky-balcony`). */
export type CategoryId = string

export interface StateroomCategory {
  id: CategoryId
  name: string
  /** Illustrative category code. */
  code: string
  size: string
  view: string
  summary: string
  /** Multiplier on the interior fare. */
  ratio: number
  /** Suites and the Sanctuary Collection pay the higher gratuity. */
  suite?: boolean
}

export const CATEGORIES: readonly StateroomCategory[] = [
  { id: 'interior', name: 'Interior', code: 'IF', size: '135–145 sq ft', view: 'No window', summary: "The best-value way to sail. Sleeps two to four, with two lower beds that can be made into a queen and pull-down beds for a third and fourth guest. There is no window, so the room stays dark and quiet for sleeping in. Every room has a private bathroom with a shower, a desk, a TV and a safe, and you have the same access to everything on the ship as in any other room.", ratio: 1 },
  { id: 'oceanview', name: 'Premium Oceanview', code: 'OV', size: 'About 215 sq ft', view: 'Large window, no balcony', summary: "Daylight and a sea view without a balcony, through a large picture window. Sleeps two to three, with a sitting area, a desk and a private bathroom. A good middle choice if you want to watch each port arrive but would rather not pay for a balcony.", ratio: 1.22 },
  { id: 'balcony', name: 'Deluxe Balcony', code: 'BF', size: 'About 236 sq ft', view: 'Private balcony', summary: "Sofa bed, desk, mini-fridge and a balcony to watch each port arrive. Sleeps two to four, with two lower beds that can be made into a queen and a private bathroom with a shower. Step outside for fresh air, an unhurried breakfast and the sunset.", ratio: 1.45 },
  { id: 'miniSuite', name: 'Mini-Suite', code: 'MB', size: 'Larger than a balcony', view: 'Private balcony', summary: "Extra room, a sitting area and a larger bathroom. A sofa bed makes space for a third guest, and there is a private balcony. A good choice for a family of three or four, or for anyone who spends a lot of time in the room. Suite guests pay the higher daily gratuity.", ratio: 1.9, suite: true },
  { id: 'sanctuaryMiniSuite', name: 'Sanctuary Mini-Suite', code: 'M1', size: 'Mini-suite size', view: 'Private balcony', summary: "Includes the adults-only Sanctuary, the Sanctuary restaurant and the Premier package, which bundles extras such as drinks, Wi-Fi and specialty dining. Part of the Sanctuary Collection of 215 staterooms, with a private balcony and the extra room of a mini-suite. Suite guests pay the higher daily gratuity.", ratio: 2.45, suite: true },
  { id: 'signatureSuite', name: 'Signature Suite', code: 'SS', size: 'About 270 sq ft plus balcony', view: 'Large balcony', summary: "Suite lounge access, priority boarding and the Premier package. The largest rooms on the ship, with a large balcony, a separate living area and space to sleep up to four. Suite guests pay the higher daily gratuity.", ratio: 3.4, suite: true },
]

/** Sun's room class of another ship's own id (`sky-balcony` is `balcony`, `sapphire-minisuite` is `miniSuite`), or undefined when the id is not of that form. */
export function classOfOwnId(id: string): string | undefined {
  const m = /^[a-z]+-(interior|oceanview|balcony|minisuite|signaturesuite|sanctuaryminisuite)$/.exec(id)
  return m ? CATEGORIES.find((c) => c.id.toLowerCase() === m[1])?.id : undefined
}

/** Other ships' room types as their servers describe them (kept when a ship's or sailing's rooms load), by id. */
const OWN_CATEGORIES = new Map<string, StateroomCategory>()

/** A room another ship serves, as a category: its own name, size and words, with the view and price ratio of the same class on Sun. */
export function categoryFromRoom(r: { id: string; name: string; suite: boolean; sizeSqFt: number; description: string }): StateroomCategory | undefined {
  const base = CATEGORIES.find((c) => c.id === classOfOwnId(r.id))
  if (!base) return undefined
  return { ...base, id: r.id, name: r.name, suite: r.suite, size: r.sizeSqFt > 0 ? `About ${r.sizeSqFt} sq ft` : base.size, summary: r.description || base.summary }
}

export function registerCategories(list: readonly StateroomCategory[]): void { for (const c of list) OWN_CATEGORIES.set(c.id, c) }

/** A room type by id: Sun's six, then another ship's as it served them, then another ship's own id described by its class (so a saved choice survives before the rooms load). */
export function categoryById(id: unknown): StateroomCategory | undefined {
  const sun = CATEGORIES.find((c) => c.id === id)
  if (sun || typeof id !== 'string') return sun
  const served = OWN_CATEGORIES.get(id)
  if (served) return served
  const base = CATEGORIES.find((c) => c.id === classOfOwnId(id))
  return base ? { ...base, id } : undefined
}

/** What the ship offers guests who need step-free access or help (accessibility notes up front, per the Linda test). */
export const SHIP_ACCESSIBILITY: readonly string[] = [
  '51 accessible staterooms, with roll-in showers and wider doors.',
  'Six elevator banks with touchscreens that assign a car; interactive deck maps beside each bank.',
  'Wheelchair-accessible seating in the Arena, the Piazza and the main dining rooms.',
  'Belize City is a tender port: the boats have steps, and mobility help there is limited. Ask Guest Services before you book a shore day.',
  'Tell Princess about a wheelchair, scooter or other need at least 30 days before you sail.',
]

/** The "other Princess ships" teaser (requirements §22.4): content only, none can be booked here. */
export const OTHER_SHIPS: readonly { name: string; note: string; guests: number; entered: number }[] = [
  { name: 'Star Princess', note: 'Sun Princess’s sister ship, also Sphere class.', guests: 4300, entered: 2025 },
  { name: 'Sky Princess', note: 'Grand class, known for the SeaWalk over the side of the ship.', guests: 3660, entered: 2019 },
  { name: 'Enchanted Princess', note: 'Royal class, with a larger spa and plenty of casual dining.', guests: 3660, entered: 2020 },
]

export interface ShipContent {
  ship: ShipFacts
  highlights: readonly { title: string; body: string }[]
  categories: readonly StateroomCategory[]
  accessibility: readonly string[]
  otherShips: readonly { name: string; note: string; guests: number; entered: number }[]
}

/** Replaces the ship content in place, so every earlier import sees the served values. */
export function replaceShip(next: ShipContent): void {
  Object.assign(SUN_SHIP, next.ship)
  const swap = <T,>(list: readonly T[], to: readonly T[]) => { (list as T[]).splice(0, list.length, ...to) }
  swap(SHIP_HIGHLIGHTS, next.highlights)
  swap(CATEGORIES, next.categories)
  swap(SHIP_ACCESSIBILITY, next.accessibility)
  swap(OTHER_SHIPS, next.otherShips)
}
