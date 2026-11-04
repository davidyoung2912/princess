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

/** Counts one reply on this device. Safe where there is no storage. */
export function countTier(tier: Tier): void {
  try { recordTier(typeof window === 'undefined' ? null : window.localStorage, tier) } catch { /* storage blocked */ }
}
