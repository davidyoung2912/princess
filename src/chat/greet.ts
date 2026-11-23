/**
 * Tapping someone else's picture in a chat starts a message to them: the message box gets "Hey @Name, " when it is empty, scrolls into view and takes the focus.
 * This is the small bus between the pictures and whichever message box is on the page; nothing is sent until the guest presses Send.
 */
const listeners = new Set<(name: string) => void>()

/** A greeting asked for while no message box is on the page (from the members list on the chat list): kept for a moment for the conversation that opens next. */
let pending: { name: string; at: number } | null = null

export const requestGreeting = (name: string): void => {
  if (listeners.size === 0) { pending = { name, at: Date.now() }; return }
  listeners.forEach((fn) => fn(name))
}
/** The greeting waiting for a message box, if it was asked for in the last 15 seconds. It is handed over once. */
export const takePendingGreeting = (): string | null => {
  const p = pending
  pending = null
  return p && Date.now() - p.at < 15_000 ? p.name : null
}
export const subscribeGreeting = (fn: (name: string) => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

/** The opening words for a name: "Hey @Name, " (the @ names them, so their card is highlighted for them); Stanley is greeted plainly. Empty when there is no name. */
export const greetingFor = (name: string): string => {
  const who = name.trim()
  if (!who) return ''
  return who === 'Stanley' ? 'Hey Stanley, ' : `Hey @${who}, `
}

/** The box's new text: the greeting when it is empty (or only spaces), otherwise unchanged so nothing the guest has typed is touched. */
export const withGreeting = (text: string, name: string): string => (text.trim() === '' ? greetingFor(name) || text : text)
