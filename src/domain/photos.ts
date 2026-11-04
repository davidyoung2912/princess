import type { PersonaId } from './people'
import type { Cents } from './money'
import { limit } from './limits'
import { registerContent } from './content'

/**
 * Ship photos (SHP-02, SHP-07): browse by day, place and person, choose photos first, see package options priced
 * against the choice, buy, and download in resumable batches that are checked. Prices and places are authored concept values.
 */
export type PhotoVenue = 'gangway' | 'portrait' | 'port' | 'pool' | 'dining'

export const PHOTO_VENUES: readonly PhotoVenue[] = ['gangway', 'portrait', 'port', 'pool', 'dining']

export interface Photo { id: string; day: number; venue: PhotoVenue; title: string; time: string; people: PersonaId[] }

export interface PhotoFilter { day: number | null; venue: PhotoVenue | null; person: PersonaId | null; favouritesOnly: boolean }
export const NO_PHOTO_FILTER: PhotoFilter = { day: null, venue: null, person: null, favouritesOnly: false }

export function filterPhotos(list: readonly Photo[], f: PhotoFilter, favourites: readonly string[]): Photo[] {
  return list.filter((p) => (f.day === null || p.day === f.day) && (f.venue === null || p.venue === f.venue) && (f.person === null || p.people.includes(f.person)) && (!f.favouritesOnly || favourites.includes(p.id)))
}

export const PRICES = { each: 1995, five: 7995, all: 14995 } as const

export type OptionId = 'each' | 'five' | 'all'
export const OPTION_IDS: readonly OptionId[] = ['each', 'five', 'all']

/** Digital photos the Premier package includes. */
export let INCLUDED_WITH_PREMIER = 12

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
export let DOWNLOAD_BATCH = 5

/** A simple check value for a saved photo, so "12 of 12 saved" means 12 that match. */
export function checksum(id: string): string {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16).padStart(8, '0')
}

export let REDOWNLOAD_DAYS = 14

/** Photographers' posted sessions, served with the photos for the sailing. */
export interface PhotographerSlot { day: number; time: string; placeId: string; what: string }

// Served limits (`GET /reference/limits`) replace these defaults in place.
limit('INCLUDED_WITH_PREMIER', (v) => { INCLUDED_WITH_PREMIER = v }, INCLUDED_WITH_PREMIER)
limit('DOWNLOAD_BATCH', (v) => { DOWNLOAD_BATCH = v }, DOWNLOAD_BATCH)
limit('REDOWNLOAD_DAYS', (v) => { REDOWNLOAD_DAYS = v }, REDOWNLOAD_DAYS)

registerContent('photos', { PHOTO_VENUES, NO_PHOTO_FILTER, PRICES, OPTION_IDS })
