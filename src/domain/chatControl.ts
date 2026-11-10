/** Control and safety in a thread (docs/chat-features-research.md, section 11, phase 2): the 15-minute change window, the typing line, timed mute and the archive. Framework-free. */
import type { ChatConversation, ChatMessage } from '../api/chatTypes'

/** How long after sending you may edit or delete your own message. The server decides on its own clock; this is only so the buttons go away when the time is up. */
export const CHANGE_WINDOW_MS = 15 * 60 * 1000

/** You may still change a message when it is yours, a person's plain message (not a deleted one, a line about the group or a notice) and inside the window. */
export function canChange(m: Pick<ChatMessage, 'from' | 'at' | 'system' | 'stanley' | 'deleted'>, me: string, now: number): boolean {
  return m.from === me && !m.system && !m.stanley && !m.deleted && now - m.at <= CHANGE_WINDOW_MS
}

/** Only plain text can be edited; a photo, an important or an urgent message can only be deleted (the server refuses the rest). */
export const canEdit = (m: Pick<ChatMessage, 'hasPhoto' | 'photo' | 'urgency'>): boolean => !m.hasPhoto && !m.photo && (m.urgency ?? 'normal') === 'normal'

/** Milliseconds until the window closes (0 once it has). Used to switch the buttons off live. */
export const windowLeft = (at: number, now: number): number => Math.max(0, at + CHANGE_WINDOW_MS - now)

/** Why a change failed, as a key the screen turns into words: the window closed, or the text was not acceptable. */
export type ChangeProblem = 'tooLate' | 'blocked' | 'contact' | 'text' | 'deleted' | 'other'
export function changeProblem(code: string | undefined, message: string | undefined): ChangeProblem {
  if (message === 'tooLate') return 'tooLate'
  if (message === 'deleted') return 'deleted'
  if (message === 'blocked') return 'blocked'
  if (message === 'contactInfo') return 'contact'
  if (message === 'text') return 'text'
  return code === 'conflict' ? 'tooLate' : 'other'
}

// ---- Typing ----

/** At most one "I am typing" call this often while a guest keeps typing; the server throttles the same way. */
export const TYPING_SEND_MS = 3000
/** Someone shown as typing is dropped this long after the last nudge, so a guest who stops mid-word does not stay "typing". */
export const TYPING_EXPIRE_MS = 6000

/** Whether a keystroke should tell the server now: the first since the throttle passed. */
export const shouldSendTyping = (lastSentAt: number | null, now: number): boolean => lastSentAt === null || now - lastSentAt >= TYPING_SEND_MS

/** The words for the typing line: one name, two names, or "Several people". Empty when nobody is typing. */
export function typingNames(names: readonly string[]): { kind: 'none' } | { kind: 'one'; a: string } | { kind: 'two'; a: string; b: string } | { kind: 'many' } {
  if (names.length === 0) return { kind: 'none' }
  if (names.length === 1) return { kind: 'one', a: names[0] }
  if (names.length === 2) return { kind: 'two', a: names[0], b: names[1] }
  return { kind: 'many' }
}

/**
 * Whether a screen reader should be told: once per burst, when typing goes from nobody to somebody. A change of who is typing within a burst, and the same people still typing, stay quiet
 * (a polite live region repeating "Sam is typing" every few seconds would drown out the conversation).
 */
export const announceTyping = (before: readonly string[], after: readonly string[]): boolean => before.length === 0 && after.length > 0

// ---- Mute ----

export type MuteLength = 'hour' | 'day' | 'week' | 'forever'
export const MUTE_LENGTHS: readonly MuteLength[] = ['hour', 'day', 'week', 'forever']

/** The wire value for a choice: `forever` is no length at all. */
export const muteFor = (l: MuteLength): 'hour' | 'day' | 'week' | undefined => (l === 'forever' ? undefined : l)

/** Whether a conversation shows as muted: the server already ends a timed mute, and this also stops showing one on a copy held offline once its end has passed. */
export const isMuted = (c: Pick<ChatConversation, 'muted' | 'mutedUntil'>, now: number): boolean => c.muted && (c.mutedUntil === undefined || c.mutedUntil > now)

// ---- Archive ----

/** The list split into what shows and what is archived. Order is kept. A conversation with an urgent message nobody acknowledged is never hidden away. */
export function splitArchived<T extends Pick<ChatConversation, 'id' | 'archived' | 'permanent'>>(rows: readonly T[], urgentIds: readonly string[] = []): { shown: T[]; archived: T[] } {
  const shown: T[] = []
  const archived: T[] = []
  for (const c of rows) (c.archived && !c.permanent && !urgentIds.includes(c.id) ? archived : shown).push(c)
  return { shown, archived }
}

/** The conversation a live "typing" nudge is about, as 32 hex digits, or null for any other event. Nudge ids look like `chat:typing:{conversation}:{person}:{guid}`. */
export function typingEventConversation(eventId: string): string | null {
  const parts = eventId.split(':')
  return parts[0] === 'chat' && parts[1] === 'typing' && /^[0-9a-f]{32}$/i.test(parts[2] ?? '') ? parts[2].toLowerCase() : null
}

/** Whether a conversation id (with dashes, as the app holds it) is the one a nudge names. */
export const isSameConversation = (id: string, hex: string): boolean => id.replace(/-/g, '').toLowerCase() === hex
