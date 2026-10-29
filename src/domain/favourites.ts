import { portGuideById } from './ports'
import { sailingById } from './sailings'
import { SHIP } from './ship'

/** Things a guest can save: a sailing date, a port, or the ship (DIS-08). */
export type FavouriteKind = 'sailing' | 'port' | 'ship'

export const FAVOURITE_KINDS: readonly FavouriteKind[] = ['sailing', 'port', 'ship']

/** A saved item is one string, `kind:id`, so a list is just strings. */
export const favouriteKey = (kind: FavouriteKind, id: string): string => `${kind}:${id}`

export function parseFavouriteKey(key: unknown): { kind: FavouriteKind; id: string } | null {
  if (typeof key !== 'string') return null
  const at = key.indexOf(':')
  const kind = key.slice(0, at)
  const id = key.slice(at + 1)
  return at > 0 && id && (FAVOURITE_KINDS as readonly string[]).includes(kind) ? { kind: kind as FavouriteKind, id } : null
}

/** The address of a saved item inside the app. */
export function favouritePath(kind: FavouriteKind, id: string): string {
  return kind === 'sailing' ? `/home/sailings/${id}` : kind === 'port' ? `/home/ports/${id}` : '/home/ship'
}

/** A link a guest can send, so whoever opens it lands on the same screen. */
export const shareUrl = (origin: string, kind: FavouriteKind, id: string): string => `${origin}${favouritePath(kind, id)}`

/** The list with a key added, or removed if it was there. Order is the order saved. */
export const toggleKey = (keys: readonly string[], key: string): string[] => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key])

/** Whether the key names something that exists, so a stale or made-up link cannot be saved. */
export function isSavable(key: unknown): boolean {
  const parsed = parseFavouriteKey(key)
  if (!parsed) return false
  if (parsed.kind === 'sailing') return !!sailingById(parsed.id)
  if (parsed.kind === 'port') return !!portGuideById(parsed.id)
  return parsed.id === SHIP.id
}
