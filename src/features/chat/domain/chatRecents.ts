/** "Recently sent to" for the send dialog: the chats a guest last sent a bundle to come first. Only chat ids are kept, on this device. */
export const RECENT_SENT_KEY = 'princess.chat.recentSent'
export const RECENT_SENT_MAX = 8

/** The saved list with `ids` put first (most recent first), kept short, without repeats. */
export function pushRecent(saved: readonly string[], ids: readonly string[]): string[] {
  return [...new Set([...ids, ...saved])].slice(0, RECENT_SENT_MAX)
}

/** Reads the saved list, ignoring anything that is not a list of text. */
export function parseRecents(raw: string | null): string[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, RECENT_SENT_MAX) : []
  } catch { return [] }
}

/** Puts recently used rows first, in recent order; the others keep their order. */
export function orderByRecent<T extends { id: string }>(rows: readonly T[], recent: readonly string[]): T[] {
  const rank = (id: string): number => { const i = recent.indexOf(id); return i < 0 ? recent.length : i }
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r.id) - rank(b.r.id) || a.i - b.i).map((x) => x.r)
}
