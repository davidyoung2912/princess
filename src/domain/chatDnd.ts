import type { ChatDndMode } from '../api/chatTypes'

/** One-tap do not disturb (docs/chat-urgency-plan.md, phase 4). The server owns the end time; the screen only shows it and honours it for the in-app pop-up. */

/** Whether do not disturb is on at `now` (it ends by itself). */
export const dndActive = (until: number, now: number): boolean => until > now

/** Milliseconds to wait before the screen should look again (the end), or null when it is off. Never negative. */
export const dndRecheckIn = (until: number, now: number): number | null => (dndActive(until, now) ? until - now : null)

/** The choices to offer: when on, the guest can only turn it off; when off, an hour or until morning. */
export const dndChoices = (active: boolean): readonly ChatDndMode[] => (active ? ['off'] : ['hour', 'morning'])

/** "HH:MM" on the guest's own clock for the end time, for "until 7:00 AM"-style text. */
export function dndEndsAt(until: number, locale?: string): string {
  return new Date(until).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}
