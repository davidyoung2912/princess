import type { Store } from '../domain/chatCache'

/** The device's storage for the chat copy (docs/chat-plan.md, 4.8), or null when it is blocked. Kept here so screens never touch `localStorage` themselves. */
export const chatStorage = (): Store | null => {
  try { return window.localStorage } catch { return null }
}
