/** Stanley on tap in a thread (docs/chat-features-research.md, phase 10). Framework-free; mirrors the limits of `ChatStanleyRules` on the server, which decides everything else. */
import type { ChatCatchUp, ChatMessage, ChatPlanPreview, ChatStanleyTap } from '../api/chatTypes'

/** The catch-up button shows once more than this many messages are unread (the server's `UnreadThreshold`). */
export const UNREAD_THRESHOLD = 15
/** What a guest types to ask Stanley in a conversation. The server treats a message that starts with it as a question to him. */
export const STANLEY_HANDLE = '@Stanley'
const ASK = /^\s*@stanley\b/i

/** Whether a message starts with his name (the server's rule: plain text that only mentions him never calls him). */
export const isAskStanley = (text: string): boolean => ASK.test(text)

/** The message with his name put in front, unless it is already there. The Ask Stanley button uses it, so the guest sees exactly what will be sent. */
export function withAsk(text: string): string {
  if (isAskStanley(text)) return text
  const rest = text.replace(/^\s+/, '')
  return rest.length === 0 ? `${STANLEY_HANDLE} ` : `${STANLEY_HANDLE} ${rest}`
}

export const LATE_MIN = 5
export const LATE_MAX = 180
export const PLACE_MAX = 40
export const TIME_MAX = 8

/** How many messages from other people came after the first one you had not read when the thread opened. Your own messages and lines about the group are not counted. */
export function unreadAfter(messages: readonly Pick<ChatMessage, 'id' | 'from' | 'system' | 'stanley'>[], firstUnread: string | null | undefined, mine: string): number {
  if (!firstUnread) return 0
  const at = messages.findIndex((m) => m.id === firstUnread)
  if (at < 0) return 0
  return messages.slice(at).filter((m) => m.from !== mine && !m.system && !m.stanley).length
}

/** Whether to offer "Catch me up": Stanley's help is on here and a lot has come in since you last looked. */
export const showCatchUp = (tap: Pick<ChatStanleyTap, 'available'> | undefined, unread: number): boolean => tap?.available === true && unread > UNREAD_THRESHOLD

/** Whether the per-message helpers (make a plan, what does this mean) are offered: the server says it is on, and the message is plain text someone wrote. */
export const mayHelpWith = (tap: Pick<ChatStanleyTap, 'available'> | undefined, m: Pick<ChatMessage, 'text' | 'system' | 'stanley' | 'kind' | 'deleted'>): boolean =>
  tap?.available === true && !m.system && !m.stanley && !m.deleted && m.kind === undefined && m.text.trim().length > 0

export type StanleyProblem = 'tooShort' | 'limit' | 'off' | 'child' | 'noPlan' | 'notMessage' | 'offline' | 'draft' | 'other'

/** The kind of failure from an API error's `message` (the server's problem title) and code, so a screen picks one sentence. */
export function stanleyProblem(code: string, message: string | undefined): StanleyProblem {
  if (code === 'offline' || code === 'network' || code === 'timeout') return 'offline'
  switch (message) {
    case 'tooShort': return 'tooShort'
    case 'catchUpLimit': return 'limit'
    case 'off': return 'off'
    case 'child': return 'child'
    case 'noPlan': return 'noPlan'
    case 'notMessage': return 'notMessage'
    case 'draft': return 'draft'
    default: return 'other'
  }
}

/** Whether a catch-up found anything beyond the latest lines. */
export const hasHighlights = (c: Pick<ChatCatchUp, 'decided' | 'open'>): boolean => c.decided.length > 0 || c.open.length > 0

/** One polite sentence for a screen reader when a catch-up opens. */
export const catchUpAnnouncement = (c: Pick<ChatCatchUp, 'messages' | 'decided' | 'open'>): string =>
  `Summary of ${c.messages} messages: ${c.decided.length} that look decided, ${c.open.length} still open.`

/** Minutes typed for "running late": a whole number from 5 to 180, or undefined when blank or out of range. */
export function cleanMinutes(raw: string): number | undefined {
  const n = Number(raw.trim())
  return raw.trim() !== '' && Number.isInteger(n) && n >= LATE_MIN && n <= LATE_MAX ? n : undefined
}

/** Whether the draft form can ask: a late note needs nothing but minutes in range if any were typed; a meet note needs a place. */
export function canDraft(kind: 'late' | 'meet', minutesRaw: string, place: string): boolean {
  if (place.trim().length > PLACE_MAX) return false
  if (kind === 'meet') return place.trim().length > 0
  return minutesRaw.trim() === '' || cleanMinutes(minutesRaw) !== undefined
}

/** The preview as the plain list a screen reader reads: the question, then each option. */
export const planSummary = (p: ChatPlanPreview): string => `${p.question} ${p.options.join(', ')}`
