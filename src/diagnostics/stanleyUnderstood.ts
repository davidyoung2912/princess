/**
 * How Stanley's understanding of a question went, counted on this device only (docs/stanley-answers-plan.md, section 10): how often he was sure, unsure or lost, which topics came up and which pills were tapped.
 * Only counts under a closed set of keys (`outcome:<x>`, `topic:<id>`, `pill:<destination>`), never the words typed. Nothing is sent anywhere.
 */
export const UNDERSTOOD_KEY = 'princess:diagnostics:stanley:understood'
const KEY = /^(outcome:(confident|ambiguous|miss|skipped|replaced)|topic:[A-Za-z0-9.]{1,40}|pill:[A-Za-z0-9.]{1,40})$/
/** Entries kept; when there are more, the least counted go first. */
export const MAX_UNDERSTOOD = 300
export type UnderstoodCounts = Record<string, number>

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function readUnderstood(store: Store | null): UnderstoodCounts {
  const counts: UnderstoodCounts = {}
  try {
    const raw: unknown = JSON.parse(store?.getItem(UNDERSTOOD_KEY) ?? '{}')
    if (raw && typeof raw === 'object') for (const [k, n] of Object.entries(raw)) if (KEY.test(k) && typeof n === 'number' && Number.isFinite(n) && n > 0) counts[k] = Math.floor(n)
  } catch { /* unreadable counts start again from zero */ }
  return counts
}

/** Adds one to each key. Never throws and refuses anything outside the closed set. */
export function recordUnderstood(store: Store | null, keys: readonly string[]): void {
  if (!store) return
  try {
    const counts = readUnderstood(store)
    for (const k of keys) if (KEY.test(k)) counts[k] = (counts[k] ?? 0) + 1
    const kept = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, MAX_UNDERSTOOD)
    store.setItem(UNDERSTOOD_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch { /* nothing to do */ }
}

export const clearUnderstood = (store: Store | null): void => { try { store?.removeItem(UNDERSTOOD_KEY) } catch { /* nothing to do */ } }

/** Counts one understood question (its outcome and topic), and any pill tapped. Safe where there is no storage. */
export function countUnderstood(keys: readonly string[]): void {
  try { recordUnderstood(typeof window === 'undefined' ? null : window.localStorage, keys) } catch { /* storage blocked */ }
}
