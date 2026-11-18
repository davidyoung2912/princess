/**
 * Tapping someone else's picture in a chat starts a message to them: the message box gets "Hey Name, " when it is empty, scrolls into view and takes the focus.
 * This is the small bus between the pictures and whichever message box is on the page; nothing is sent until the guest presses Send.
 */
const listeners = new Set<(name: string) => void>()

export const requestGreeting = (name: string): void => listeners.forEach((fn) => fn(name))
export const subscribeGreeting = (fn: (name: string) => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

/** The opening words for a name: its first word, so "Maria Lopez" is greeted as "Hey Maria, ". Empty when there is no name. */
export const greetingFor = (name: string): string => {
  const first = name.trim().split(/\s+/)[0] ?? ''
  return first ? `Hey ${first}, ` : ''
}

/** The box's new text: the greeting when it is empty (or only spaces), otherwise unchanged so nothing the guest has typed is touched. */
export const withGreeting = (text: string, name: string): string => (text.trim() === '' ? greetingFor(name) || text : text)
