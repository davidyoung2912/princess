/** Relay to a person and the group recap (docs/chat-features-research.md, phase 13). Framework-free; the server decides everything, this only picks what to offer and the words for what it said. */
import type { ChatMessage, ChatRecap } from '../../../shared/api/chatTypes'

export const RELAY_MAX_MESSAGES = 10
export const RELAY_ISSUE_MAX = 1000
export const RECAP_MAX_PHOTOS = 6

/** Messages the guest can choose to hand over: words a person typed, not deleted, not a card, poll or system line. The newest come first, at most `limit`. */
export function relayChoices(messages: readonly ChatMessage[], limit = 20): ChatMessage[] {
  return messages.filter((m) => !m.system && !m.deleted && !m.kind && m.text.trim() !== '' && m.stanley !== true).slice(-limit).reverse()
}

/** Toggles one id, never going past the limit. */
export function toggleChoice(chosen: readonly string[], id: string, max = RELAY_MAX_MESSAGES): string[] {
  if (chosen.includes(id)) return chosen.filter((c) => c !== id)
  return chosen.length >= max ? [...chosen] : [...chosen, id]
}

/** Whether the guest may send: they have agreed, and the text is there and not too long. */
export const mayHandOver = (text: string, consent: boolean): boolean => consent && text.trim() !== '' && text.length <= RELAY_ISSUE_MAX

export type RelayProblem = 'child' | 'notChat' | 'none' | 'tooMany' | 'offline' | 'other'

export function relayProblem(code: string, message: string | undefined): RelayProblem {
  if (code === 'offline' || code === 'network' || code === 'timeout') return 'offline'
  switch (message) {
    case 'child': case 'notChat': case 'none': case 'tooMany': return message
    default: return 'other'
  }
}

export type RecapProblem = 'notGroup' | 'child' | 'small' | 'shared' | 'waiting' | 'empty' | 'tooMany' | 'notYours' | 'offline' | 'other'

export function recapProblem(code: string, message: string | undefined): RecapProblem {
  if (code === 'offline' || code === 'network' || code === 'timeout') return 'offline'
  switch (message) {
    case 'notGroup': case 'child': case 'small': case 'shared': case 'waiting': case 'empty': case 'tooMany': case 'notYours': return message
    default: return 'other'
  }
}

/** The caller's own parts that still wait for their answer. */
export const awaitingMe = (r: Pick<ChatRecap, 'plans'>): number => r.plans.filter((p) => p.mine && p.decision === 'pending').length

/** How many photos the caller has in, for the picker's count. */
export const photosIn = (r: Pick<ChatRecap, 'photos'>): number => r.photos.filter((p) => p.mine && p.decision === 'approved').length
