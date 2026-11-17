import { EXPLORER_ROUTES } from './lens'
import type { ExplorerKind } from './types'
import { parseVenuePinKey, venuePinKey } from './venueOrder'

/**
 * The shortlist: places, treatments and tours a guest saved to come back to, kept among their server favourites as `venue:<ship>.<id>`, `treatment:<ship>.<id>` and `tour:<id>`.
 * A saved item never books anything; it only surfaces at the right time and pre-fills the first reservation.
 */
export const MAX_SAVED_ITEMS = 10

export const treatmentKey = (shipId: string, treatmentId: string): string => `treatment:${shipId}.${treatmentId}`
export const tourKey = (excursionId: string): string => `tour:${excursionId}`

export function parseTreatmentKey(key: unknown): { shipId: string; treatmentId: string } | null {
  if (typeof key !== 'string' || !key.startsWith('treatment:')) return null
  const rest = key.slice('treatment:'.length)
  const dot = rest.indexOf('.')
  const treatmentId = rest.slice(dot + 1)
  return dot > 0 && treatmentId ? { shipId: rest.slice(0, dot), treatmentId } : null
}

export function parseTourKey(key: unknown): string | null {
  return typeof key === 'string' && key.startsWith('tour:') && key.length > 'tour:'.length ? key.slice('tour:'.length) : null
}

export type SavedKind = 'venue' | 'treatment' | 'tour'

const kindOf = (key: string): SavedKind | null => parseVenuePinKey(key) ? 'venue' : parseTreatmentKey(key) ? 'treatment' : parseTourKey(key) ? 'tour' : null

/** The saved keys of the shortlist kinds, in the order saved. */
export const savedKeys = (keys: readonly string[]): string[] => keys.filter((k) => kindOf(k) !== null)

/** The favourites after a tap on a treatment or tour: removed if there; refused (and the list unchanged) when that kind already has ten, so nothing vanishes unseen. */
export function toggleSavedKey(keys: readonly string[], key: string): { keys: string[]; full: boolean } {
  if (keys.includes(key)) return { keys: keys.filter((k) => k !== key), full: false }
  const kind = kindOf(key)
  if (kind && kind !== 'venue' && keys.filter((k) => kindOf(k) === kind).length >= MAX_SAVED_ITEMS) return { keys: [...keys], full: true }
  return { keys: [...keys, key], full: false }
}

export interface SavedItem {
  key: string
  kind: SavedKind
  title: string
  /** Where the item lives, so the list can open it. */
  explorer: ExplorerKind | 'excursions'
  /** The Explorer page that books it, with the item already chosen. */
  bookTo: string
}

export interface ShortlistLookups {
  venues: readonly { id: string; shipId: string; explorer: ExplorerKind; title: string }[]
  treatments: readonly { id: string; venueId: string; title: string }[]
  tours: readonly { id: string; name: string }[]
  shipId: string
}


/** The shortlist with names, in the order saved. Keys naming something not on this ship (or no longer there) are left out rather than shown blank. */
export function shortlistItems(keys: readonly string[], lookups: ShortlistLookups): SavedItem[] {
  const out: SavedItem[] = []
  for (const key of keys) {
    const venue = parseVenuePinKey(key)
    if (venue) {
      const v = lookups.venues.find((x) => x.shipId === venue.shipId && x.id === venue.venueId)
      if (v) out.push({ key, kind: 'venue', title: v.title, explorer: v.explorer, bookTo: `${EXPLORER_ROUTES[v.explorer]}/${v.id}` })
      continue
    }
    const tr = parseTreatmentKey(key)
    if (tr) {
      const x = tr.shipId === lookups.shipId ? lookups.treatments.find((y) => y.id === tr.treatmentId) : undefined
      if (x) out.push({ key, kind: 'treatment', title: x.title, explorer: 'spa', bookTo: `/spa-explorer/${x.venueId}?book=new&treatment=${encodeURIComponent(x.id)}` })
      continue
    }
    const tourId = parseTourKey(key)
    const tour = tourId ? lookups.tours.find((y) => y.id === tourId) : undefined
    if (tour) out.push({ key, kind: 'tour', title: tour.name, explorer: 'excursions', bookTo: `/excursions-explorer/${tour.id}` })
  }
  return out
}

/** The first saved place in an Explorer, so the reserve page can start on it. Null when none is saved there. */
export function carryOverVenue(keys: readonly string[], explorer: ExplorerKind, venues: readonly { id: string; shipId: string; explorer: ExplorerKind }[]): string | null {
  for (const key of keys) {
    const v = parseVenuePinKey(key)
    if (v && venues.some((x) => x.explorer === explorer && x.shipId === v.shipId && x.id === v.venueId)) return v.venueId
  }
  return null
}

/** The key that saves a venue, for callers that only have the ids. */
export const savedVenueKey = venuePinKey

/** The local time a "remind me when it opens" reminder goes: nine in the morning on the day the window opens, as an epoch time for the device's zone. Null for a date that is not a date. */
export function reminderAt(opensOn: string | undefined): number | null {
  if (!opensOn || !/^\d{4}-\d{2}-\d{2}$/.test(opensOn)) return null
  const [y, m, d] = opensOn.split('-').map(Number)
  const at = new Date(y, m - 1, d, 9, 0, 0).getTime()
  return Number.isFinite(at) ? at : null
}

/** What the reminder says. It makes no promise about availability, only that the window has opened. */
export const reminderText = (title: string): string => `Booking opens today: ${title}`.slice(0, 80)

/** The id a reminder for one saved item keeps, so asking twice keeps one. */
export const reminderId = (key: string): string => `shortlist:${key}`.slice(0, 64)
