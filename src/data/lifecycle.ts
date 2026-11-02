import { DEMO_KEY } from '../demo/state'
import { CACHE_PREFIX, maxAgeFor } from '../domain/offlineCache'

/** The part of Storage these functions need; localStorage, sessionStorage and test fakes all fit. */
export interface KeyValueStorage {
  readonly length: number
  key(index: number): string | null
  removeItem(key: string): void
}

export const APP_PREFIX = 'princess:'

/** Removes every app key from a storage, leaving other sites' and tools' keys alone. */
export function removeAppKeys(storage: KeyValueStorage | null, except: readonly string[] = []): void {
  if (!storage) return
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k?.startsWith(APP_PREFIX) && !except.includes(k)) keys.push(k)
  }
  keys.forEach((k) => storage.removeItem(k))
}

/** Who the copies on this device belong to (the server's user id). A different person signing in finds the earlier person's copies gone. */
export const OWNER_KEY = 'princess:owner'

/** Kept when a person's copies are cleared: display settings, diagnostics and the reports waiting to go, who the copies belong to, and the shared reference tables. */
const KEPT_PREFIXES = ['princess:settings', 'princess:diagnostics', 'princess:improve', 'princess:telemetry', 'princess:reloaded', OWNER_KEY] as const
/** Reference tables are the same for everyone, so they are kept for reading with no signal. */
const SHARED_CACHE_KINDS = ['catalogue', 'sailings', 'ship', 'program', 'ports', 'packages', 'limits', 'access', 'rates'] as const
/** The outbox of unsent messages and requests (an empty outbox keeps no key). The other place a change can wait is the sync stores, which `syncStatus()` reports (documents and the port day's rows). */
export const UNSENT_PREFIXES = ['princess:outbox:'] as const

/** True for a key that holds something belonging to one person. */
export function isPersonKey(key: string): boolean {
  if (!key.startsWith(APP_PREFIX)) return false
  if (KEPT_PREFIXES.some((p) => key === p || key.startsWith(`${p}:`))) return false
  return !SHARED_CACHE_KINDS.some((k) => key.startsWith(`${APP_PREFIX}cache:${k}:`))
}

/**
 * Removes everything this device holds for a person (their documents, saved copies, feed answers, demo controls). `keep` names key prefixes to leave,
 * used for changes that have not reached the server yet. Display settings, diagnostics and the shared reference tables stay.
 */
export function clearPersonCopies(storage: KeyValueStorage | null, keep: readonly string[] = []): void {
  if (!storage) return
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k && isPersonKey(k) && !keep.some((p) => k.startsWith(p))) keys.push(k)
  }
  keys.forEach((k) => storage.removeItem(k))
}

/** "Reset demo": the demo controls go back to first-run. */
export async function resetDemo(local: KeyValueStorage | null): Promise<void> {
  local?.removeItem(DEMO_KEY)
}

/** "Wipe everything": every setting and session kept on this device. */
export function wipeEverything(opts: { local: KeyValueStorage | null; session: KeyValueStorage | null }): void {
  removeAppKeys(opts.local)
  removeAppKeys(opts.session)
}

/**
 * Removes shared reference tables and feed answers saved longer ago than their kind's maximum age. They are refused on read anyway; this stops them
 * filling the phone. Only these kinds are swept, because they are saved by the real clock (`Date.now()`); saved screens use the demo clock.
 */
export function sweepExpiredCopies(storage: (KeyValueStorage & Pick<Storage, 'getItem'>) | null, now: number): void {
  if (!storage) return
  const stale: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (!k?.startsWith(CACHE_PREFIX)) continue
    const kind = k.slice(CACHE_PREFIX.length).split(':')[0]
    if (!(SHARED_CACHE_KINDS as readonly string[]).includes(kind) && !kind.startsWith('feed-')) continue
    try {
      const savedAt = (JSON.parse(storage.getItem(k) ?? 'null') as { savedAt?: unknown } | null)?.savedAt
      if (typeof savedAt !== 'number' || now - savedAt > maxAgeFor(kind)) stale.push(k)
    } catch {
      stale.push(k)
    }
  }
  stale.forEach((k) => storage.removeItem(k))
}
