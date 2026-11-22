import { STANLEY_JOKES } from '../data/stanleyJokes'

const KEY = 'princess.jokeDismissed'

/** A random joke from the list; `random` is injectable so a test can choose. Empty when the list is. */
export const pickJoke = (jokes: readonly string[] = STANLEY_JOKES, random: () => number = Math.random): string =>
  jokes.length === 0 ? '' : jokes[Math.min(Math.floor(random() * jokes.length), jokes.length - 1)]

/** This device's calendar day, "YYYY-MM-DD". */
export const todayLocal = (now: Date = new Date()): string => now.toLocaleDateString('sv-SE')

const store = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }

/** Whether the guest dismissed the joke today. A dismissal on an earlier day no longer counts, so the joke is back the next day. */
export function jokeDismissed(day: string = todayLocal(), s: Storage | null = store()): boolean {
  try { return s?.getItem(KEY) === day } catch { return false }
}

/** Hides the joke for the rest of today. */
export function dismissJoke(day: string = todayLocal(), s: Storage | null = store()): void {
  try { s?.setItem(KEY, day) } catch { /* nothing is lost if it cannot be kept: the joke shows again at the next visit */ }
}

/** Brings the joke back: called at sign-out, so signing in again shows it even on the same day. */
export function clearJokeDismissal(s: Storage | null = store()): void {
  try { s?.removeItem(KEY) } catch { /* nothing kept, nothing to clear */ }
}
