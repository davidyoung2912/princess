import { CACHE_PREFIX, maxAgeFor } from './offlineCache'

/**
 * The Offline Capsule (MOB-03, QOL-04, OFF-02, OFF-03): a plain account of what this phone has kept for use with no signal, how big it is,
 * how old it is and when it stops being trusted. Framework-free; the screen reads storage and passes the entries in.
 */

/** One kept item as found in storage. */
export interface CapsuleEntry { key: string; bytes: number; savedAt: number | null }

export type CapsuleKind = 'pass' | 'muster' | 'emergency' | 'folio' | 'portDay' | 'onward' | 'disembark' | 'dining' | 'program' | 'health' | 'room' | 'photos'

export interface CapsuleKindDef {
  kind: CapsuleKind
  /** Needed for boarding, safety and getting home; a capsule missing one of these is not ready. */
  essential: boolean
  /** The screen that saves the copy when it is opened with a signal. */
  path: string
}

/** The things a guest can keep, essentials first (OFF-02: boarding pass, muster and emergency information, itinerary, bill). */
export const CAPSULE_KINDS: readonly CapsuleKindDef[] = [
  { kind: 'pass', essential: true, path: '/home/boarding-pass' },
  { kind: 'muster', essential: true, path: '/ship/muster' },
  { kind: 'emergency', essential: true, path: '/ship/emergency' },
  { kind: 'program', essential: false, path: '/ship' },
  { kind: 'dining', essential: false, path: '/ship' },
  { kind: 'portDay', essential: false, path: '/ship/port' },
  { kind: 'folio', essential: false, path: '/me/bill' },
  { kind: 'disembark', essential: false, path: '/home/disembark' },
  { kind: 'onward', essential: false, path: '/home/disembark/onward' },
  { kind: 'health', essential: false, path: '/plan/medical' },
  { kind: 'room', essential: false, path: '/ship/room' },
  { kind: 'photos', essential: false, path: '/ship/photos' },
]

/** fresh: well inside its limit. ageing: past half of its limit, worth refreshing. expired: past its limit, so screens no longer rely on it. */
export type CapsuleState = 'fresh' | 'ageing' | 'expired'

export interface CapsuleRow {
  kind: CapsuleKind
  essential: boolean
  path: string
  /** How many separate copies of this kind are kept (one per person, day or ship). */
  copies: number
  bytes: number
  /** When the newest copy was saved. */
  savedAt: number
  /** When the newest copy stops being used. */
  expiresAt: number
  state: CapsuleState
}

export type CapsuleReadiness = 'ready' | 'partial' | 'empty'

export interface Capsule {
  rows: CapsuleRow[]
  /** Essential kinds with no usable copy (none kept, or the kept one has expired). */
  missing: CapsuleKindDef[]
  readiness: CapsuleReadiness
  /** Everything under the app's cache prefix, kept or not (reference tables and live answers included). */
  totalBytes: number
  /** Copies that could not be read, so they are no use offline. */
  unreadable: number
  /** The oldest moment an essential copy will stop being used; null when there is none. */
  earliestExpiry: number | null
}

/** Splits `princess:cache:<kind>:<id>` into its kind; null for any other key. */
export function kindOfKey(key: string): string | null {
  if (!key.startsWith(CACHE_PREFIX)) return null
  const rest = key.slice(CACHE_PREFIX.length)
  const colon = rest.indexOf(':')
  return colon > 0 ? rest.slice(0, colon) : null
}

/** What this phone has kept, read from the entries found in storage at `now` (the demo clock, the same one the copies were stamped with). */
export function buildCapsule(entries: readonly CapsuleEntry[], now: number): Capsule {
  const byKind = new Map<string, CapsuleEntry[]>()
  let totalBytes = 0
  let unreadable = 0
  for (const e of entries) {
    const kind = kindOfKey(e.key)
    if (kind === null) continue
    totalBytes += e.bytes
    if (e.savedAt === null) { unreadable += 1; continue }
    byKind.set(kind, [...(byKind.get(kind) ?? []), e])
  }
  const rows: CapsuleRow[] = []
  for (const def of CAPSULE_KINDS) {
    const list = byKind.get(def.kind)
    if (!list || list.length === 0) continue
    const savedAt = Math.max(...list.map((e) => e.savedAt ?? 0))
    const limit = maxAgeFor(def.kind)
    const age = now - savedAt
    const state: CapsuleState = age > limit ? 'expired' : age > limit / 2 ? 'ageing' : 'fresh'
    rows.push({ ...def, copies: list.length, bytes: list.reduce((n, e) => n + e.bytes, 0), savedAt, expiresAt: savedAt + limit, state })
  }
  const usable = new Set(rows.filter((r) => r.state !== 'expired').map((r) => r.kind))
  const missing = CAPSULE_KINDS.filter((d) => d.essential && !usable.has(d.kind))
  const essentials = CAPSULE_KINDS.filter((d) => d.essential).length
  const readiness: CapsuleReadiness = missing.length === 0 ? 'ready' : missing.length === essentials ? 'empty' : 'partial'
  const essentialExpiries = rows.filter((r) => r.essential && r.state !== 'expired').map((r) => r.expiresAt)
  return { rows, missing, readiness, totalBytes, unreadable, earliestExpiry: essentialExpiries.length > 0 ? Math.min(...essentialExpiries) : null }
}

/** Reads every kept copy in a storage as entries. Sizes count characters of the stored text (two bytes each in the browser's string storage). */
export function readCapsuleEntries(storage: Pick<Storage, 'length' | 'key' | 'getItem'> | null): CapsuleEntry[] {
  if (!storage) return []
  const out: CapsuleEntry[] = []
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key || !key.startsWith(CACHE_PREFIX)) continue
      const text = storage.getItem(key) ?? ''
      let savedAt: number | null = null
      try {
        const o = JSON.parse(text) as { savedAt?: unknown; value?: unknown }
        if (typeof o.savedAt === 'number' && o.value !== undefined) savedAt = o.savedAt
      } catch { /* unreadable, reported as such */ }
      out.push({ key, bytes: (key.length + text.length) * 2, savedAt })
    }
  } catch { /* storage refused; nothing is kept as far as we can tell */ }
  return out
}

/** "1.2 MB", "48 KB", "312 B". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** What the browser says about its storage for this site. */
export interface StorageReport { usage: number | null; quota: number | null; persisted: boolean | null }

export type StorageState = 'protected' | 'unprotected' | 'low' | 'unknown'

/** Whether the phone has promised to keep what is saved: 'protected' (persistent), 'low' (over 80% of its space used), 'unprotected' (the browser may clear it when short of space) or 'unknown'. */
export function storageState(r: StorageReport): StorageState {
  if (r.quota !== null && r.usage !== null && r.quota > 0 && r.usage / r.quota > 0.8) return 'low'
  if (r.persisted === true) return 'protected'
  if (r.persisted === false) return 'unprotected'
  return 'unknown'
}

/** "Nov 8, 9:14 am" in the phone's own time (a saved copy's age is about the phone, not the ship). */
export function formatWhen(at: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(at))
    .replace(/\s?(AM|PM)$/i, (_, ap: string) => ` ${ap.toLowerCase()}`)
}

/** The guest's choice of which kinds to keep (MOB-03). Essentials are always kept; the rest can be switched off. */
export interface CapsulePrefs {
  skipped: CapsuleKind[]
  /** The last "test" the guest ran: when (the demo clock) and how it came out. */
  lastTest: { at: number; result: 'pass' | 'warn' | 'fail' } | null
}

export const DEFAULT_PREFS: CapsulePrefs = { skipped: [], lastTest: null }

/** True when a copy of this kind should be saved. Essentials cannot be switched off. */
export const isKept = (kind: string, prefs: Pick<CapsulePrefs, 'skipped'>): boolean => {
  const def = CAPSULE_KINDS.find((d) => d.kind === kind)
  return !def || def.essential || !prefs.skipped.includes(def.kind)
}

/** Reads stored preferences, ignoring anything unknown or an attempt to skip an essential. */
export function parsePrefs(text: string | null | undefined): CapsulePrefs {
  try {
    const o = JSON.parse(text ?? 'null') as { skipped?: unknown; lastTest?: { at?: unknown; result?: unknown } | null } | null
    const skipped = Array.isArray(o?.skipped) ? CAPSULE_KINDS.filter((d) => !d.essential && (o.skipped as unknown[]).includes(d.kind)).map((d) => d.kind) : []
    const t = o?.lastTest
    const lastTest: CapsulePrefs['lastTest'] = t && typeof t.at === 'number' && (t.result === 'pass' || t.result === 'warn' || t.result === 'fail') ? { at: t.at, result: t.result } : null
    return { skipped, lastTest }
  } catch {
    return DEFAULT_PREFS
  }
}

/** Switches a kind on or off; an essential is left on. */
export function setKept(prefs: CapsulePrefs, kind: CapsuleKind, keep: boolean): CapsulePrefs {
  const def = CAPSULE_KINDS.find((d) => d.kind === kind)
  if (!def || def.essential) return prefs
  const without = prefs.skipped.filter((k) => k !== kind)
  return { ...prefs, skipped: keep ? without : [...without, kind] }
}
