import { parseRecents, pushRecent, RECENT_SENT_KEY } from '../domain/chatRecents'

/** The chats last sent to, kept on this device only (a display preference, not guest data). */
export function loadRecentSent(): string[] {
  try { return parseRecents(localStorage.getItem(RECENT_SENT_KEY)) } catch { return [] }
}

export function saveRecentSent(ids: readonly string[]): void {
  try { localStorage.setItem(RECENT_SENT_KEY, JSON.stringify(pushRecent(loadRecentSent(), ids))) } catch { /* storage may be full or blocked */ }
}
