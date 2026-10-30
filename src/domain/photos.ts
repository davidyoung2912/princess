import type { PersonaId } from './personas'
import type { Cents } from './pricing'

/**
 * Ship photos (SHP-02, SHP-07): browse by day, place and person, choose photos first, see package options priced
 * against the choice, buy, and download in resumable batches that are checked. Prices and places are authored concept values.
 */
export type PhotoVenue = 'gangway' | 'portrait' | 'port' | 'pool' | 'dining'

export const PHOTO_VENUES: readonly PhotoVenue[] = ['gangway', 'portrait', 'port', 'pool', 'dining']

export interface Spot { id: string; day: number; venue: PhotoVenue; title: string; time: string; individual: boolean }

export const SPOTS: readonly Spot[] = [
  { id: 'gangway', day: 1, venue: 'gangway', title: 'Welcome aboard, the gangway', time: '12:30', individual: false },
  { id: 'formal1', day: 2, venue: 'portrait', title: 'Formal night portraits, the Piazza', time: '18:00', individual: true },
  { id: 'cozumel', day: 3, venue: 'port', title: 'Cozumel, back at the dock', time: '16:00', individual: false },
  { id: 'belize', day: 4, venue: 'port', title: 'Belize City tender pier', time: '13:30', individual: false },
  { id: 'roatan', day: 5, venue: 'port', title: 'Roatán, the cruise pier', time: '14:00', individual: false },
  { id: 'pool', day: 6, venue: 'pool', title: 'Lido pool, sea day', time: '11:30', individual: false },
  { id: 'dining', day: 6, venue: 'dining', title: 'Your table, Eclipse Dining Room', time: '19:15', individual: false },
  { id: 'formal2', day: 7, venue: 'portrait', title: 'Second formal night portraits', time: '18:00', individual: true },
]

export interface Photo { id: string; day: number; venue: PhotoVenue; title: string; time: string; people: PersonaId[] }

/** Photos taken so far of the people on the booking: one group photo per spot, and one each at portrait spots. */
export function photosFor(party: readonly PersonaId[], throughDay: number): Photo[] {
  const out: Photo[] = []
  for (const s of SPOTS) {
    if (s.day > throughDay) continue
    const base = { day: s.day, venue: s.venue, title: s.title, time: s.time }
    out.push({ ...base, id: `ph-${s.id}-group`, people: [...party] })
    if (s.individual && party.length > 1) for (const p of party) out.push({ ...base, id: `ph-${s.id}-${p}`, people: [p] })
  }
  return out
}

export interface PhotoFilter { day: number | null; venue: PhotoVenue | null; person: PersonaId | null; favouritesOnly: boolean }
export const NO_PHOTO_FILTER: PhotoFilter = { day: null, venue: null, person: null, favouritesOnly: false }

export function filterPhotos(list: readonly Photo[], f: PhotoFilter, favourites: readonly string[]): Photo[] {
  return list.filter((p) => (f.day === null || p.day === f.day) && (f.venue === null || p.venue === f.venue) && (f.person === null || p.people.includes(f.person)) && (!f.favouritesOnly || favourites.includes(p.id)))
}

export const PRICES = { each: 1995, five: 7995, all: 14995 } as const

export type OptionId = 'each' | 'five' | 'all'
export const OPTION_IDS: readonly OptionId[] = ['each', 'five', 'all']

/** Digital photos the Premier package includes. */
export const INCLUDED_WITH_PREMIER = 12

export interface PhotoOption { id: OptionId; total: Cents; /** Photos in the choice paid for by this option. */ covers: number }

/** What each way of buying costs for a choice of photos, after any included photos. The cheapest is marked by the caller. */
export function photoOptions(selected: number, includedLeft: number): { included: number; paid: number; options: PhotoOption[] } {
  const included = Math.min(selected, Math.max(0, includedLeft))
  const paid = selected - included
  return {
    included, paid,
    options: [
      { id: 'each', total: paid * PRICES.each, covers: paid },
      { id: 'five', total: Math.ceil(paid / 5) * PRICES.five, covers: paid },
      { id: 'all', total: paid > 0 ? PRICES.all : 0, covers: paid },
    ],
  }
}

export const cheapest = (options: readonly PhotoOption[]): OptionId => options.reduce((a, b) => (b.total < a.total ? b : a)).id

/** Photos saved per attempt; an attempt that is cut short keeps what it saved. */
export const DOWNLOAD_BATCH = 5

/** A simple check value for a saved photo, so "12 of 12 saved" means 12 that match. */
export function checksum(id: string): string {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16).padStart(8, '0')
}

export const REDOWNLOAD_DAYS = 14

export interface PhotographerSlot { day: number; time: string; placeId: string; what: string }

export const PHOTOGRAPHERS: readonly PhotographerSlot[] = [
  { day: 1, time: '12:00', placeId: 'landing', what: 'Welcome aboard photos at the gangway' },
  { day: 2, time: '18:00', placeId: 'piazza', what: 'Formal night portraits' },
  { day: 3, time: '15:30', placeId: 'landing', what: 'Back at the ship, Cozumel' },
  { day: 6, time: '11:00', placeId: 'lido-pool', what: 'Pool and deck photos' },
  { day: 6, time: '19:00', placeId: 'eclipse', what: 'Dining room table photos' },
  { day: 7, time: '18:00', placeId: 'piazza', what: 'Second formal night portraits' },
]
