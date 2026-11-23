import type { StatsCounters } from '../../../shared/api/statsTypes'

/** The tab a path belongs to, for the "favourite part of the app" stat. Anything that is not one of the five tabs is `other`. */
export function areaOf(path: string): 'home' | 'plan' | 'ship' | 'chat' | 'me' | 'other' {
  const first = path.split('/').filter(Boolean)[0]
  if (first === undefined) return 'home'
  return first === 'plan' || first === 'ship' || first === 'chat' || first === 'me' ? first : 'other'
}

/** A segment that looks like an id (a booking number, a date, a long number): left out of the key so one screen counts as one screen. */
const looksLikeId = (s: string): boolean => /^\d+$/.test(s) || (s.match(/\d/g)?.length ?? 0) >= 3

/**
 * The counter key for a screen: its first two path segments, letters, digits and dashes only, so `/me/trips/AB123456` counts as `route.me.trips`.
 * Null for a path with nothing usable in it. At most 40 characters, the most the server accepts.
 */
export function routeKey(path: string): string | null {
  const parts = path.split(/[?#]/)[0].split('/').filter(Boolean).map((s) => s.toLowerCase().replace(/[^a-z0-9-]/g, '')).filter((s) => s !== '' && !looksLikeId(s)).slice(0, 2)
  if (parts.length === 0) return path === '/' || path === '' ? 'route.home' : null
  return `route.${parts.join('.')}`.slice(0, 40).replace(/\.$/, '')
}

/** The date as yyyy-MM-dd on the device's clock. */
export const dayOf = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export interface StatsBatch { day: string; counters: StatsCounters }

export interface Tracker {
  /** The guest opened the app (once per browser tab session). */
  opened(): void
  /** The guest is looking at this screen. */
  view(path: string): void
  /** The guest was active for this many seconds. */
  active(seconds: number): void
  /** The guest shared a stat. */
  shared(): void
  /** The guest asked Stanley a question (however he answers it). */
  asked(): void
  /** Everything counted since the last take, or null when nothing was. Counting starts again from zero. */
  take(): StatsBatch | null
  /** Puts a batch back after a failed send, so it goes with the next one. */
  restore(batch: StatsBatch): void
}

/** Counts what the guest does on this device until it is time to report it. Plain data, no timers: the hook decides when to call. */
export function createTracker(now: () => Date = () => new Date()): Tracker {
  let counters: StatsCounters = {}
  let day = dayOf(now())
  const add = (key: string, n: number): void => { counters[key] = (counters[key] ?? 0) + n }
  return {
    opened: () => add('opens', 1),
    view(path) {
      add('views', 1)
      add(`area.${areaOf(path)}`, 1)
      const key = routeKey(path)
      if (key) add(key, 1)
    },
    active(seconds) {
      const n = Math.max(0, Math.round(seconds))
      if (n === 0) return
      add('seconds', n)
      add(`hour.${String(now().getHours()).padStart(2, '0')}`, n)
    },
    shared: () => add('shares', 1),
    asked: () => add('asks', 1),
    take() {
      if (Object.keys(counters).length === 0) return null
      const batch = { day, counters }
      counters = {}
      day = dayOf(now())
      return batch
    },
    restore(batch) {
      // A batch from an earlier day is added to today's counts: a small blur in the day totals, never a lost stat.
      for (const [k, v] of Object.entries(batch.counters)) add(k, v)
    },
  }
}
