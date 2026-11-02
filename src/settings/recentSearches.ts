import { parseRecent, pushRecent, type Recent } from '../domain/recentSearches'

const KEY = 'princess.recentSearches'

/** The screens this device searched for most recently (a per-device convenience, never sent anywhere). */
export function loadRecent(): Recent[] {
  try { return parseRecent(localStorage.getItem(KEY)) } catch { return [] }
}

export function rememberSearch(list: readonly Recent[], item: Recent): Recent[] {
  const next = pushRecent(list, item)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode: recents just are not kept */ }
  return next
}

export function clearRecent(): void {
  try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
}
