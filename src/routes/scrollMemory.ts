/**
 * Where a guest was on a screen, so Back returns to the same place in a long list (docs/pain-points-scorecard-and-plan.md, R1).
 * A history entry has its own key, so two visits to the same list do not share a position. Framework-free; the shell feeds it scroll events
 * and asks for a position on Back. Positions live for the browser session only and never hold anything but a number.
 */
export const SCROLL_KEY = 'princess:scroll-memory'
export const MAX_REMEMBERED = 60

export interface ScrollStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

type Positions = Record<string, number>

function read(store: ScrollStore | null): Positions {
  try {
    const raw = store?.getItem(SCROLL_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Positions = {}
    for (const [k, v] of Object.entries(parsed)) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.round(v)
    return out
  } catch { return {} }
}

/** Remembers a position for a history entry; the oldest entries drop out past the cap. A position of 0 is kept, so a deliberate return to the top is honoured. */
export function rememberScroll(store: ScrollStore | null, key: string, y: number): void {
  if (!key || !Number.isFinite(y) || y < 0) return
  const all = read(store)
  delete all[key]   // re-insert so the newest entry is last
  all[key] = Math.round(y)
  const keys = Object.keys(all)
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_REMEMBERED))) delete all[k]
  try { store?.setItem(SCROLL_KEY, JSON.stringify(all)) } catch { /* storage full or blocked: Back then opens at the top */ }
}

/** The remembered position for a history entry, or null when none. */
export function recallScroll(store: ScrollStore | null, key: string): number | null {
  const v = read(store)[key]
  return typeof v === 'number' ? v : null
}

/** What to do after a navigation: restore a remembered place on Back or Forward (and on a reload of the same entry), otherwise start at the top. */
export function scrollTarget(store: ScrollStore | null, key: string, type: 'POP' | 'PUSH' | 'REPLACE'): number {
  if (type !== 'POP') return 0
  return recallScroll(store, key) ?? 0
}

/** True when a page is tall enough to scroll to `y` now; the shell keeps trying while a list is still loading. */
export const canReach = (y: number, scrollHeight: number, viewport: number): boolean => y <= Math.max(0, scrollHeight - viewport) + 1
