/**
 * What a guest has been shown and dismissed, kept on their account so a tip dismissed on one device is not shown again on another:
 * `tips` is how many of each page's tips have been dismissed (page id to count), `tour` the first-visit tour steps dismissed, and `tourOn` whether the guest
 * wants the guided tour (on unless they turn it off).
 * Plain data and plain functions, so it can be tested without a browser; `hints.ts` holds it in memory and syncs it.
 */
export interface Hints {
  tips: Readonly<Record<string, number>>
  tour: readonly string[]
  tourOn: boolean
}

export const EMPTY_HINTS: Hints = { tips: {}, tour: [], tourOn: true }

/** The most pages and tour steps kept, and the longest id: the same limits the server checks. */
export const HINTS_MAX_PAGES = 400, HINTS_MAX_STEPS = 120, HINTS_MAX_ID = 40

const validId = (id: string): boolean => id.length > 0 && id.length <= HINTS_MAX_ID && /^[A-Za-z0-9._-]+$/.test(id)

/** Reads a stored or served document defensively: anything unreadable is dropped, and nothing readable means empty (the same object, so it can be compared). */
export function normalizeHints(raw: unknown): Hints {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const tips: Record<string, number> = {}
  if (src.tips && typeof src.tips === 'object' && !Array.isArray(src.tips)) {
    for (const [id, n] of Object.entries(src.tips)) {
      if (validId(id) && typeof n === 'number' && Number.isFinite(n) && n > 0 && Object.keys(tips).length < HINTS_MAX_PAGES) tips[id] = Math.floor(n)
    }
  }
  const tour = Array.isArray(src.tour) ? [...new Set(src.tour.filter((s): s is string => typeof s === 'string' && validId(s)))].slice(0, HINTS_MAX_STEPS) : []
  const tourOn = src.tourOn !== false
  return Object.keys(tips).length === 0 && tour.length === 0 && tourOn ? EMPTY_HINTS : { tips, tour, tourOn }
}

/** Two devices both dismissed things: keep every dismissal (the larger count for a page, every tour step). */
export function mergeHints(remote: unknown, local: unknown): Hints {
  const a = normalizeHints(remote)
  const b = normalizeHints(local)
  const tips: Record<string, number> = { ...a.tips }
  for (const [id, n] of Object.entries(b.tips)) tips[id] = Math.max(tips[id] ?? 0, n)
  return normalizeHints({ tips, tour: [...a.tour, ...b.tour], tourOn: a.tourOn && b.tourOn })
}

/** Dismisses a page's current tip (`total` is how many tips the page has, so the count never passes it). The same object comes back when nothing changes. */
export function dismissTipIn(h: Hints, id: string, total: number): Hints {
  const now = h.tips[id] ?? 0
  const next = Math.min(now + 1, total)
  return next === now || !validId(id) ? h : normalizeHints({ ...h, tips: { ...h.tips, [id]: next } })
}

/** Marks tour steps as dismissed. The same object comes back when they all were already. */
export function markTourIn(h: Hints, ids: readonly string[]): Hints {
  const add = ids.filter((s) => !h.tour.includes(s))
  return add.length === 0 ? h : normalizeHints({ ...h, tour: [...h.tour, ...add] })
}

/** Brings every page tip back, leaving the tour as it is. */
export const resetTipsIn = (h: Hints): Hints => (Object.keys(h.tips).length === 0 ? h : normalizeHints({ ...h, tips: {} }))

/** Turns the guided tour on and brings every step back, leaving the page tips as they are. */
export const resetTourIn = (h: Hints): Hints => (h.tour.length === 0 && h.tourOn ? h : normalizeHints({ ...h, tour: [], tourOn: true }))
