import { demoNow } from '../demo/store'
import { CACHE_PREFIX, cachePut } from '../domain/offlineCache'
import { parseResult, type PackResult } from './cruisePack'
import { buildCapsule, DEFAULT_PREFS, isKept, parsePrefs, readCapsuleEntries, type Capsule, type CapsulePrefs, type StorageReport } from '../domain/offlineCapsule'
import { deviceStore } from './deviceStorage'

const local = (): Storage | null => {
  return deviceStore()
}

/** What this phone has kept for use offline, read now on the demo clock the copies were stamped with. */
export const readCapsule = (): { capsule: Capsule; at: number } => {
  const at = demoNow()
  return { capsule: buildCapsule(readCapsuleEntries(local()), at), at }
}

/** The browser's own account of its storage for this site; empty answers where it gives none. */
export async function readStorageReport(): Promise<StorageReport> {
  const s = typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!s) return { usage: null, quota: null, persisted: null }
  const [est, persisted] = await Promise.all([s.estimate?.().catch(() => null) ?? null, s.persisted?.().catch(() => null) ?? null])
  return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted }
}

/** Asks the browser to keep this site's storage; false when it declines or cannot. */
export async function requestPersistence(): Promise<boolean> {
  const s = typeof navigator === 'undefined' ? undefined : navigator.storage
  return (await s?.persist?.().catch(() => false)) ?? false
}

const PREFS_KEY = 'princess:capsule-prefs'

/** The guest's capsule choices and last test result, on this device only. */
export const readPrefs = (): CapsulePrefs => {
  try { return parsePrefs(local()?.getItem(PREFS_KEY)) } catch { return DEFAULT_PREFS }
}

export function writePrefs(prefs: CapsulePrefs): void {
  try { local()?.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* storage full or blocked: the choice lasts for this visit only */ }
}

/** Should a copy of this kind be saved now? */
export const shouldKeep = (kind: string): boolean => isKept(kind, readPrefs())

/** Deletes every saved copy of a kind (when the guest switches it off). Returns how many were removed. */
export function dropCopies(kind: string): number {
  const s = local()
  if (!s) return 0
  const prefix = `${CACHE_PREFIX}${kind}:`
  const keys: string[] = []
  try { for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k?.startsWith(prefix)) keys.push(k) } } catch { return 0 }
  for (const k of keys) { try { s.removeItem(k) } catch { /* ignore */ } }
  return keys.length
}

/** Keeps a downloaded view under the name the screens read. `kept` is false when the phone refuses it (full or private mode). */
export function keepCopy(kind: string, key: string, value: unknown, at: number): { kept: boolean; bytes: number } {
  const kept = cachePut(local(), kind, key, value, at)
  return { kept, bytes: kept ? (CACHE_PREFIX.length + kind.length + key.length + JSON.stringify(value).length + 40) * 2 : 0 }
}

/** The size of each kept copy by `kind:key`, for an honest estimate before a download. */
export function keptSizes(): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of readCapsuleEntries(local())) if (e.key.startsWith(CACHE_PREFIX)) out.set(e.key.slice(CACHE_PREFIX.length), e.bytes)
  return out
}

const PACK_KEY = 'princess:pack-last'
/** The last "Download my cruise" result on this phone, or null. */
export const readPackResult = (): PackResult | null => { try { return parseResult(local()?.getItem(PACK_KEY)) } catch { return null } }
export function writePackResult(r: PackResult): void { try { local()?.setItem(PACK_KEY, JSON.stringify(r)) } catch { /* the result is shown for this visit only */ } }
