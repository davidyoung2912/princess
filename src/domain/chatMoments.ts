import type { ChatMessage } from '../api/chatTypes'
export type { MomentMode, StanleyChatPrefs } from '../api/chatTypes'
import { noticeState } from './stanleyThread'

/**
 * Stanley's suggestion cards (docs/chat-features-research.md, section 7, phase 6). The server decides whether and when a card appears; this module only says how one reads on the screen and
 * which topics a guest may switch off. Plain TypeScript so it is tested without React.
 */

/** The topics the server accepts, in the order the settings list shows them. */
export const MOMENT_TOPICS = ['payment', 'planning', 'packing', 'steps', 'discovery', 'travel'] as const
export type MomentTopic = (typeof MOMENT_TOPICS)[number]

export const isMoment = (m: Pick<ChatMessage, 'notice'>): boolean => m.notice?.lane === 'suggestion'

/** How a card reads: still offering its action, put away by the guest (Not now or Don't show again), or no longer needed. */
export type MomentView = 'open' | 'putAway' | 'expired'
export const momentView = (m: Pick<ChatMessage, 'notice'>, now?: number): MomentView => {
  const s = noticeState(m, now)
  return s === 'superseded' ? 'putAway' : s === 'expired' ? 'expired' : 'open'
}

/** The topics after one is switched on or off. Unknown names are dropped, so a stale value can never reach the server. */
export const toggleTopic = (off: readonly string[], topic: string, on: boolean): string[] => {
  const known = off.filter((x) => (MOMENT_TOPICS as readonly string[]).includes(x) && x !== topic)
  return on ? known : [...known, topic]
}

/** Whether a topic is on: a topic is on unless it is in the off list. */
export const topicOn = (off: readonly string[], topic: string): boolean => !off.includes(topic)

/** A shared card (7.4) names the group it would be posted to in its notice `subject`; no other suggestion has one. The server checks everything again when the admin taps. */
export const shareGroupOf = (m: Pick<ChatMessage, 'notice'>): string | null => (isMoment(m) && m.notice?.subject ? m.notice.subject : null)
