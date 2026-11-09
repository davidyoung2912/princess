import type { StanleySource } from '../ai/stanleyRoute'

/**
 * Which source answered each of Stanley's replies, counted on this device only (SG7). It shows what share of questions cost money (`model`, `trip`, `before`)
 * and what share were free (`library`, `ship`), so the authored library can be tuned. Only counts are kept, never the words typed. Not sent anywhere.
 */
export const TIERS_KEY = 'princess:diagnostics:stanley'
export type Tier = StanleySource | 'handoff' | 'unanswered'
export const TIERS: readonly Tier[] = ['library', 'ship', 'trip', 'before', 'model', 'handoff', 'unanswered']
export type TierCounts = Record<Tier, number>

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const empty = (): TierCounts => Object.fromEntries(TIERS.map((k) => [k, 0])) as TierCounts

export function readTiers(store: Store | null): TierCounts {
  const counts = empty()
  try {
    const raw: unknown = JSON.parse(store?.getItem(TIERS_KEY) ?? '{}')
    if (raw && typeof raw === 'object') for (const k of TIERS) { const n = (raw as Record<string, unknown>)[k]; if (typeof n === 'number' && Number.isFinite(n) && n > 0) counts[k] = Math.floor(n) }
  } catch { /* unreadable counts start again from zero */ }
  return counts
}

/** Adds one to a tier. Never throws: a full or blocked store must not get in the way of an answer. */
export function recordTier(store: Store | null, tier: Tier): void {
  if (!store) return
  try {
    const counts = readTiers(store)
    counts[tier] += 1
    store.setItem(TIERS_KEY, JSON.stringify(counts))
  } catch { /* nothing to do */ }
}

export const clearTiers = (store: Store | null): void => { try { store?.removeItem(TIERS_KEY) } catch { /* nothing to do */ } }

/** The share of answered questions that needed no paid call, as a whole percent; null before anything was answered. */
export function freeShare(c: TierCounts): number | null {
  const free = c.library + c.ship
  const total = free + c.trip + c.before + c.model
  return total === 0 ? null : Math.round((free / total) * 100)
}

/** The share of answered questions that reached a paid call, as a whole percent; null before anything was answered. */
export function modelShare(c: TierCounts): number | null {
  const free = freeShare(c)
  return free === null ? null : 100 - free
}

/** Each tier's share of every reply, as whole percents in the order of {@link TIERS}; all zero before anything is counted. */
export function tierMix(c: TierCounts): { tier: Tier; count: number; percent: number }[] {
  const total = TIERS.reduce((n, k) => n + c[k], 0)
  return TIERS.map((tier) => ({ tier, count: c[tier], percent: total === 0 ? 0 : Math.round((c[tier] / total) * 100) }))
}

/**
 * How often each written answer was given on this device, for the repeat-question view: which authored questions guests keep asking, so the library can be tuned.
 * The keys are a closed set (`library:<entry id>` or `ship:<fact id>`), never the words typed, and nothing is sent anywhere.
 */
export const ASKED_KEY = 'princess:diagnostics:stanley:asked'
const ASKED_ID = /^(library|ship):[A-Za-z0-9.]{1,60}$/
/** Entries kept; when there are more, the least asked go first. */
export const MAX_ASKED = 200
export type AskedCounts = Record<string, number>

export function readAsked(store: Store | null): AskedCounts {
  const counts: AskedCounts = {}
  try {
    const raw: unknown = JSON.parse(store?.getItem(ASKED_KEY) ?? '{}')
    if (raw && typeof raw === 'object') for (const [k, n] of Object.entries(raw)) if (ASKED_ID.test(k) && typeof n === 'number' && Number.isFinite(n) && n > 0) counts[k] = Math.floor(n)
  } catch { /* unreadable counts start again from zero */ }
  return counts
}

/** Adds one to a written answer. Never throws, and refuses anything that is not an entry or fact id. */
export function recordAsked(store: Store | null, id: string): void {
  if (!store || !ASKED_ID.test(id)) return
  try {
    const counts = readAsked(store)
    counts[id] = (counts[id] ?? 0) + 1
    const kept = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, MAX_ASKED)
    store.setItem(ASKED_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch { /* nothing to do */ }
}

export const clearAsked = (store: Store | null): void => { try { store?.removeItem(ASKED_KEY) } catch { /* nothing to do */ } }

/** The answers given more than once, most often first, then by id so the order is steady. */
export function repeated(counts: AskedCounts, limit = 5): { id: string; count: number }[] {
  return Object.entries(counts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([id, count]) => ({ id, count }))
}

/** Counts one reply on this device, and the written answer behind it when there was one. Safe where there is no storage. */
export function countTier(tier: Tier, asked?: string): void {
  try {
    const store = typeof window === 'undefined' ? null : window.localStorage
    recordTier(store, tier)
    if (asked) recordAsked(store, asked)
  } catch { /* storage blocked */ }
}
