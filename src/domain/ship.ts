/** Sun Princess, the one supported ship (ship profile §1–§9). Facts are from the profile; category codes and prices are authored concept data. */
export const SHIP = {
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
  decks: 17,
  sanctuaryStaterooms: 215,
  intro: 'Princess’s newest ship, built around the Piazza, a three-level gathering place under a glass Sphere, and the Dome, a glass-roofed pool by day and a theatre by night.',
} as const

export const SHIP_HIGHLIGHTS: readonly { title: string; body: string }[] = [
  { title: 'The Piazza', body: 'Three levels of cafés, bars and live music under the Sphere, with game shows and roaming performers.' },
  { title: 'The Dome', body: 'A glass dome on decks 17 and 18: a pool by day, acrobatic theatre at night, and a dance party late.' },
  { title: 'Princess Arena', body: 'The main show venue, seating about 900, set up three ways for different productions.' },
  { title: 'Dining included', body: 'Three dining rooms, the Eatery buffet, the Americana Diner, casual grills and pizza, plus 24-hour room service.' },
  { title: 'Specialty dining', body: 'Steakhouse, Italian, seafood, sushi, teppanyaki and a prix fixe with sea views, at an extra charge unless your package covers them.' },
  { title: 'Kids and teens', body: 'Firefly Park (3–7), Neon Grove (8–12) and The Underground (13–17), all on decks 6 and 7.' },
  { title: 'The Sanctuary', body: 'An adults-only retreat on deck 18 for guests in the Sanctuary Collection of 215 staterooms.' },
]

export type CategoryId = 'interior' | 'oceanview' | 'balcony' | 'miniSuite' | 'sanctuaryMiniSuite' | 'signatureSuite'

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
  { id: 'interior', name: 'Interior', code: 'IF', size: '135–145 sq ft', view: 'No window', summary: 'The best-value way to sail. Sleeps two to four.', ratio: 1 },
  { id: 'oceanview', name: 'Premium Oceanview', code: 'OV', size: 'About 215 sq ft', view: 'Large window, no balcony', summary: 'Daylight and a sea view without a balcony.', ratio: 1.22 },
  { id: 'balcony', name: 'Deluxe Balcony', code: 'BF', size: 'About 236 sq ft', view: 'Private balcony', summary: 'Sofa bed, desk, mini-fridge and a balcony to watch each port arrive.', ratio: 1.45 },
  { id: 'miniSuite', name: 'Mini-Suite', code: 'MB', size: 'Larger than a balcony', view: 'Private balcony', summary: 'Extra room, a sitting area and a larger bathroom.', ratio: 1.9, suite: true },
  { id: 'sanctuaryMiniSuite', name: 'Sanctuary Mini-Suite', code: 'M1', size: 'Mini-suite size', view: 'Private balcony', summary: 'Includes the adults-only Sanctuary, the Sanctuary restaurant and the Premier package.', ratio: 2.45, suite: true },
  { id: 'signatureSuite', name: 'Signature Suite', code: 'SS', size: 'About 270 sq ft plus balcony', view: 'Large balcony', summary: 'Suite lounge access, priority boarding and the Premier package.', ratio: 3.4, suite: true },
]

export const categoryById = (id: unknown): StateroomCategory | undefined => CATEGORIES.find((c) => c.id === id)

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
