/** The deck plan: where things are, the six elevator banks and the muster stations (OB-04, SAF-01). Places follow the ship profile; deck and position are authored where the profile is silent (verify before real use). */
export type Section = 'forward' | 'midship' | 'aft'
export type PlaceKind = 'dining' | 'bar' | 'show' | 'family' | 'wellness' | 'pool' | 'shop' | 'service' | 'medical'

export interface Place {
  id: string
  name: string
  deck: number
  section: Section
  kind: PlaceKind
  /** Reached without steps from the elevators. */
  stepFree: boolean
  /** A short accessibility note, shown when something is not obvious. */
  note?: string
}

const pl = (id: string, name: string, deck: number, section: Section, kind: PlaceKind, stepFree = true, note?: string): Place => ({ id, name, deck, section, kind, stepFree, note })

export const PLACES: readonly Place[] = [
  pl('landing', 'The Landing (gangway)', 4, 'midship', 'service'),
  pl('medical', 'Medical Center', 4, 'forward', 'medical'),
  pl('soleil', 'Soleil Dining Room', 6, 'aft', 'dining'),
  pl('guest-services', 'Guest Services', 6, 'forward', 'service'),
  pl('firefly', 'Firefly Park', 6, 'forward', 'family'),
  pl('lotus', 'Lotus Spa', 6, 'midship', 'wellness'),
  pl('eclipse', 'Eclipse Dining Room', 7, 'aft', 'dining'),
  pl('crown', 'Crown Grill', 7, 'aft', 'dining'),
  pl('catch', 'The Catch by Rudi', 7, 'midship', 'dining'),
  pl('omalleys', 'O’Malley’s Irish Pub', 7, 'midship', 'dining'),
  pl('piazza', 'The Piazza', 7, 'midship', 'show', true, 'Three levels; each has a lift to the others'),
  pl('arena', 'Princess Arena', 7, 'forward', 'show', true, 'Wheelchair spaces on both sides of the middle block; ask an usher'),
  pl('live', 'Princess Live!', 7, 'forward', 'show'),
  pl('neon-grove', 'Neon Grove Tweens Club', 7, 'forward', 'family'),
  pl('underground', 'The Underground Teen Lounge', 7, 'forward', 'family'),
  pl('bellinis', 'Bellini’s Cocktail Bar', 7, 'midship', 'bar'),
  pl('coffee-currents', 'Coffee Currents', 7, 'midship', 'bar'),
  pl('wheelhouse', 'Wheelhouse Bar', 7, 'aft', 'bar'),
  pl('shops', 'Shops of Princess', 8, 'midship', 'shop'),
  pl('sabatini', 'Sabatini’s', 8, 'aft', 'dining'),
  pl('crooners', 'Crooners', 8, 'midship', 'bar'),
  pl('casino', 'Princess Casino', 8, 'forward', 'show'),
  pl('oceanfront', 'OceanFront (Medallion help)', 8, 'midship', 'service'),
  pl('eatery', 'The Eatery', 9, 'midship', 'dining'),
  pl('alfredo', 'Alfredo’s Pizzeria', 9, 'midship', 'dining'),
  pl('americana', 'Americana Diner', 9, 'aft', 'dining'),
  pl('promenade', 'Promenade (outdoor)', 9, 'aft', 'pool', true, 'Gentle ramps at each door; the deck is flat'),
  pl('intl-cafe', 'International Café', 9, 'midship', 'dining'),
  pl('excursions-desk', 'Shore Excursions desk', 9, 'midship', 'service'),
  pl('lido', 'The Lido (Lido Eats)', 17, 'midship', 'dining'),
  pl('love', 'Love by Britto', 17, 'aft', 'dining'),
  pl('lido-pool', 'Lido Pool', 17, 'midship', 'pool', true, 'Pool lift at the shallow end'),
  pl('sea-view', 'Sea View Bar', 17, 'forward', 'bar'),
  pl('dome', 'The Dome', 17, 'midship', 'show', true, 'Step-free from the Lido; seats and open spaces for wheelchairs'),
  pl('sun-bar', 'Sun Bar', 18, 'forward', 'bar', false, 'Two steps up from the sun deck. The Sea View Bar on deck 17 serves the same drinks, step-free'),
  pl('fitness', 'Fitness Center', 18, 'midship', 'wellness'),
  pl('salon', 'Lotus Salon', 18, 'midship', 'wellness'),
]

export const placeById = (id: unknown): Place | undefined => PLACES.find((p) => p.id === id)

export const DECKS: readonly number[] = [...new Set(PLACES.map((p) => p.deck))].sort((a, b) => a - b)

export const placesOnDeck = (deck: number): Place[] => PLACES.filter((p) => p.deck === deck)

export interface ElevatorBank { bank: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; section: Section; side: 'port' | 'starboard' }

/** Six banks (ship profile §2): A and B forward, C and D midship, E and F aft. Each has a touchscreen that assigns a car. */
export const ELEVATORS: readonly ElevatorBank[] = [
  { bank: 'A', section: 'forward', side: 'port' }, { bank: 'B', section: 'forward', side: 'starboard' },
  { bank: 'C', section: 'midship', side: 'port' }, { bank: 'D', section: 'midship', side: 'starboard' },
  { bank: 'E', section: 'aft', side: 'port' }, { bank: 'F', section: 'aft', side: 'starboard' },
]

/** The elevator banks nearest a place. */
export const elevatorsNear = (p: Place): ElevatorBank[] => ELEVATORS.filter((e) => e.section === p.section)

export interface MusterStation { letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; name: string; placeId: string; deck: number }

/** Muster stations match the six elevator banks, so the station letter on the boarding pass is also the nearest bank. */
export const MUSTER_STATIONS: Record<MusterStation['letter'], MusterStation> = {
  A: { letter: 'A', name: 'Princess Arena, port side', placeId: 'arena', deck: 7 },
  B: { letter: 'B', name: 'Princess Live!, starboard side', placeId: 'live', deck: 7 },
  C: { letter: 'C', name: 'The Piazza, port side', placeId: 'piazza', deck: 7 },
  D: { letter: 'D', name: 'The Piazza, starboard side', placeId: 'piazza', deck: 7 },
  E: { letter: 'E', name: 'Eclipse Dining Room', placeId: 'eclipse', deck: 7 },
  F: { letter: 'F', name: 'Soleil Dining Room', placeId: 'soleil', deck: 6 },
}

/** The station for a label such as "Station C"; unknown labels give null. */
export function musterByLabel(label: string): MusterStation | null {
  const m = /^Station ([A-F])$/.exec(label.trim())
  return m ? MUSTER_STATIONS[m[1] as MusterStation['letter']] : null
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ’']/g, '')

/** Places whose name, kind or deck match every word typed ("pizza", "deck 7", "bar"). An empty query lists none. */
export function searchPlaces(query: string, list: readonly Place[] = PLACES): Place[] {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return list.filter((p) => {
    const hay = norm(`${p.name} ${p.kind} deck ${p.deck} ${p.section}`)
    return words.every((w) => hay.includes(w))
  })
}
