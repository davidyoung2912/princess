/**
 * Which addresses this tab has opened by following a link or button inside the app. An address a stage does not list is "stale" when typed, bookmarked or
 * opened from an old history entry, and goes Home; but a screen the guest was sent to by the app itself must open, and must still be there when they refresh.
 * Kept for the tab's session only (never sent anywhere); a new tab or a typed address starts with none.
 */
const KEY = 'princess.openedByLink'
const MAX = 60

function read(): string[] {
  try {
    const data: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]')
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

/** Notes that the app itself opened this address. */
export function markOpenedByLink(pathname: string): void {
  const list = read()
  if (list.includes(pathname)) return
  try { sessionStorage.setItem(KEY, JSON.stringify([...list, pathname].slice(-MAX))) } catch { /* private mode: a refresh may go Home */ }
}

/** Whether the app opened this address earlier in this tab (so a refresh or Back to it is not a stale address). */
export const wasOpenedByLink = (pathname: string): boolean => read().includes(pathname)

/** True when the visit arrived by following a link (a push or a replace, not a typed address, refresh or history move) or this tab was sent here by one before. */
export const openedByLink = (navigationType: 'PUSH' | 'REPLACE' | 'POP', pathname: string): boolean => navigationType !== 'POP' || wasOpenedByLink(pathname)
