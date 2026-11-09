import { demoNow } from '../demo/store'
import { buildCapsule, readCapsuleEntries, type Capsule, type StorageReport } from '../domain/offlineCapsule'

const local = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
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
