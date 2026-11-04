import { cacheGet, cachePut, CACHE_PREFIX } from '../domain/offlineCache'
import { portById } from '../domain/sailings'

/**
 * One feed the server answers. The client holds no simulation of its own: `now()` is the server's answer if it has come, else the last answer kept
 * on this device (when the feed is kept), else null, which a screen shows as "loading". An answer that is not the expected shape is ignored, so a bad
 * server never breaks a screen.
 */
export interface Feed<A extends unknown[], V> {
  /** What is known now: this session's answer, else the copy kept on the device, else null (not here yet). */
  now(...args: A): V | null
  /** Fetches the server's answer once per key and session; resolves true when a new value was stored. Failures leave what is known. */
  load(...args: A): Promise<boolean>
  /** Set by the runtime. */
  setFetcher(f: ((...args: A) => Promise<unknown>) | null): void
  /** Forgets this session's answers and the copies kept on the device (sign-out). */
  forget(): void
}

const store = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

/**
 * `kind` (optional) keeps each answer on the device under `princess:cache:feed-<kind>:<key>` so the last figures show with no signal. Feeds keyed by the
 * minute are not kept.
 */
export function createFeed<A extends unknown[], V>(key: (...args: A) => string, normalize: (raw: unknown) => V | null, kind?: string): Feed<A, V> {
  let fetcher: ((...args: A) => Promise<unknown>) | null = null
  const served = new Map<string, V>()
  const fetched = new Set<string>()
  const cacheKind = kind ? `feed-${kind}` : null
  return {
    now(...args) {
      const k = key(...args)
      const mem = served.get(k)
      if (mem !== undefined) return mem
      if (!cacheKind) return null
      const copy = cacheGet(store(), cacheKind, k, normalize, Date.now())
      return copy ? copy.value : null
    },
    async load(...args) {
      const k = key(...args)
      if (!fetcher || fetched.has(k)) return false
      fetched.add(k)
      try {
        const raw = await fetcher(...args)
        const value = normalize(raw)
        if (value === null) { fetched.delete(k); return false }
        served.set(k, value)
        if (cacheKind) cachePut(store(), cacheKind, k, raw, Date.now())
        return true
      } catch {
        fetched.delete(k)
        return false
      }
    },
    setFetcher: (f) => { fetcher = f },
    forget() {
      served.clear()
      fetched.clear()
      const s = store()
      if (!s || !cacheKind) return
      const prefix = `${CACHE_PREFIX}${cacheKind}:`
      for (let i = s.length - 1; i >= 0; i--) {
        const name = s.key(i)
        if (name && name.startsWith(prefix)) s.removeItem(name)
      }
    },
  }
}

export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
/** A port the catalogue knows, or `sea`. The feed does not know the route; any port of any sailing is allowed. */
export const isPortIdText = (v: unknown): v is string => typeof v === 'string' && (v === 'sea' || portById(v) !== undefined)

export const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
