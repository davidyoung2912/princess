import { MAX_PINS } from '../settings/settings'
import { parseVenuePinKey, togglePinKey, venuePinKey, type PinResult } from './explorer/venueOrder'

/** A pinned screen is stored among the guest's favourites as `screen:<id>`, a pinned venue as `venue:<shipId>.<venueId>`. The server holds the list, in the order the guest arranged. */
export const screenPinKey = (id: string): string => `screen:${id}`

/** The screen ids in a favourites list, in order. */
export const screenIdsOf = (keys: readonly string[]): string[] => keys.filter((k) => k.startsWith('screen:')).map((k) => k.slice('screen:'.length))

/** The venue pins in a favourites list, in order. */
export const venueKeysOf = (keys: readonly string[]): string[] => keys.filter((k) => parseVenuePinKey(k) !== null)

/** The favourites after a tap on a screen pin, as the server will have them: removed if there; added at the end, the oldest making room when `max` would be passed. */
export function toggleScreenKey(keys: readonly string[], id: string, max = MAX_PINS): string[] {
  const key = screenPinKey(id)
  if (keys.includes(key)) return keys.filter((k) => k !== key)
  const screens = keys.filter((k) => k.startsWith('screen:'))
  const drop = screens.length >= max ? screens[0] : null
  return [...keys.filter((k) => k !== drop), key]
}

/** The favourites with the screen pins in the given order (those not named keep theirs, after); other kinds stay where they are. */
export function reorderScreenKeys(keys: readonly string[], ids: readonly string[]): string[] {
  const want = ids.map(screenPinKey).filter((k) => keys.includes(k))
  const rest = keys.filter((k) => k.startsWith('screen:') && !want.includes(k))
  const ordered = [...want, ...rest]
  let at = 0
  return keys.map((k) => (k.startsWith('screen:') ? ordered[at++] : k))
}

/** The old per-device pins that still need to go to the server: those not there yet, in their old order. */
export const pinsToUpload = (local: readonly string[], keys: readonly string[]): string[] => local.filter((id) => !keys.includes(screenPinKey(id)))

export type VenuePinOutcome = 'pinned' | 'unpinned' | 'full'

/** The favourites after a tap on a venue pin, and what happened. */
export function toggleVenueKey(keys: readonly string[], shipId: string, venueId: string, inExplorer: (key: string) => boolean): PinResult & { outcome: VenuePinOutcome } {
  const key = venuePinKey(shipId, venueId)
  const had = keys.includes(key)
  const r = togglePinKey(keys, key, inExplorer)
  return { ...r, outcome: r.full ? 'full' : had ? 'unpinned' : 'pinned' }
}
