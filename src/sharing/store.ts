import { APP_PREFIX } from '../data/lifecycle'
import { sync } from '../sync'
import { NOTHING_SHARED, normalizeSharing, type Sharing } from '../domain/partyShare'

/**
 * What this person shares with the rest of their party (XG-02): four switches, all off until they say so. Kept on the device and saved to the account
 * (key `sharing`) so the server can enforce them for every other person on the booking.
 */
export const sharingKeyFor = (personId: string | null): string => `${APP_PREFIX}sharing:${personId ?? ''}`

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function loadSharing(personId: string | null, storage: Pick<Storage, 'getItem'> | null = safeStorage()): Sharing {
  try {
    const text = storage?.getItem(sharingKeyFor(personId))
    return text ? normalizeSharing(JSON.parse(text)) : NOTHING_SHARED
  } catch {
    return NOTHING_SHARED
  }
}

const cache = new Map<string, Sharing>()
const listeners = new Set<() => void>()

export function getSharing(personId: string | null): Sharing {
  const key = sharingKeyFor(personId)
  let s = cache.get(key)
  if (!s) { s = loadSharing(personId); cache.set(key, s) }
  return s
}

export function subscribeSharing(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function remember(personId: string | null, next: Sharing): void {
  cache.set(sharingKeyFor(personId), next)
  try { safeStorage()?.setItem(sharingKeyFor(personId), JSON.stringify(next)) } catch { /* the account copy still holds it */ }
  listeners.forEach((l) => l())
}

export function updateSharing(personId: string | null, change: (s: Sharing) => Sharing): void {
  remember(personId, normalizeSharing(change(getSharing(personId))))
  sync.changed('sharing', personId)
}

/** Takes the server's copy without telling the sync module it changed. */
export function applyRemoteSharing(personId: string | null, next: Sharing): void {
  remember(personId, next)
}
