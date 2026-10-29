/**
 * Copies of things the guest must be able to open with no signal: the boarding pass and the check-in receipt
 * (CHK-04, CHK-13, CHK-14). Each copy is kept on the phone with the moment it was saved, so a screen can say how old it is.
 */
export interface Cached<T> { savedAt: number; value: T }

type ReadStore = Pick<Storage, 'getItem'>
type WriteStore = Pick<Storage, 'setItem'>

export const CACHE_PREFIX = 'princess:cache:'
export const cacheKey = (kind: string, id: string): string => `${CACHE_PREFIX}${kind}:${id}`

/** Saves a copy; false when the phone refuses (full or private mode), in which case nothing changes. */
export function cachePut<T>(storage: WriteStore | null, kind: string, id: string, value: T, savedAt: number): boolean {
  try {
    storage?.setItem(cacheKey(kind, id), JSON.stringify({ savedAt, value } satisfies Cached<T>))
    return !!storage
  } catch {
    return false
  }
}

/** The saved copy, or null when there is none or it cannot be read. `check` vets the contents, since stored text can be anything. */
export function cacheGet<T>(storage: ReadStore | null, kind: string, id: string, check: (raw: unknown) => T | null): Cached<T> | null {
  try {
    const text = storage?.getItem(cacheKey(kind, id))
    if (!text) return null
    const o = JSON.parse(text) as { savedAt?: unknown; value?: unknown }
    if (typeof o.savedAt !== 'number') return null
    const value = check(o.value)
    return value === null ? null : { savedAt: o.savedAt, value }
  } catch {
    return null
  }
}
