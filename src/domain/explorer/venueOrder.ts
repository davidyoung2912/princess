import type { ExplorerKind } from './types'

/** The most venues a guest can pin in one Explorer. The server enforces the same limit. */
export const MAX_VENUE_PINS = 10

/** A venue pin is stored as one string among the guest's favourites: `venue:<shipId>.<venueId>`. */
export const venuePinKey = (shipId: string, venueId: string): string => `venue:${shipId}.${venueId}`

export function parseVenuePinKey(key: unknown): { shipId: string; venueId: string } | null {
  if (typeof key !== 'string' || !key.startsWith('venue:')) return null
  const rest = key.slice('venue:'.length)
  const dot = rest.indexOf('.')
  const shipId = rest.slice(0, dot)
  const venueId = rest.slice(dot + 1)
  return dot > 0 && venueId ? { shipId, venueId } : null
}

/** Venues with the pinned ones first. Each group keeps its given order, so the sort is stable and the authored order still rules inside both. */
export function orderVenues<V extends { id: string; shipId: string }>(venues: readonly V[], pinned: readonly string[]): V[] {
  const set = new Set(pinned)
  const isPinned = (v: V) => set.has(venuePinKey(v.shipId, v.id))
  return [...venues.filter(isPinned), ...venues.filter((v) => !isPinned(v))]
}

export interface PinResult { keys: string[]; /** True when a pin was refused because the Explorer already has the most it may. */ full: boolean }

/**
 * The pin list after a tap: removed if there, else added. `inExplorer` says which of the guest's pins belong to this Explorer, since the cap is per Explorer.
 * Unlike screen pins, a full list refuses the new pin instead of dropping the oldest, so nothing disappears unseen.
 */
export function togglePinKey(keys: readonly string[], key: string, inExplorer: (k: string) => boolean, max = MAX_VENUE_PINS): PinResult {
  if (keys.includes(key)) return { keys: keys.filter((k) => k !== key), full: false }
  if (keys.filter(inExplorer).length >= max) return { keys: [...keys], full: true }
  return { keys: [...keys, key], full: false }
}

/** Which pins belong to an Explorer, given the venues it lists. */
export function pinsIn(venues: readonly { id: string; shipId: string; explorer: ExplorerKind }[], keys: readonly string[], explorer: ExplorerKind): string[] {
  const mine = new Set(venues.filter((v) => v.explorer === explorer).map((v) => venuePinKey(v.shipId, v.id)))
  return keys.filter((k) => mine.has(k))
}
