/** How urgent chat messages look and behave (docs/chat-urgency-plan.md, phase 3). Framework-free; the server decides who may send what. */
import type { ChatConversation, ChatMessage, ChatUrgency } from '../api/chatTypes'

export const URGENCY_LEVELS: readonly ChatUrgency[] = ['normal', 'important', 'urgent']

/** The level of a message or a last line; absent means normal. */
export const urgencyOf = (x: { urgency?: ChatUrgency } | null | undefined): ChatUrgency => x?.urgency ?? 'normal'

/** The levels the composer offers: urgent only where the server said the guest may send it. */
export const levelsFor = (mayUrgent: boolean): readonly ChatUrgency[] => (mayUrgent ? URGENCY_LEVELS : URGENCY_LEVELS.filter((l) => l !== 'urgent'))

/** Urgent is announced at once (`role="alert"`); everything else politely. */
export const announceMode = (level: ChatUrgency): 'assertive' | 'polite' => (level === 'urgent' ? 'assertive' : 'polite')

/**
 * The conversation list order: conversations with an unacknowledged urgent message first, then those whose last message is an unread important one from someone else,
 * then the rest. Each group keeps the order it came in (newest activity first).
 */
export function sortConversations(rows: readonly ChatConversation[], urgentIds: readonly string[]): ChatConversation[] {
  const urgent = new Set(urgentIds)
  const rank = (c: ChatConversation): number =>
    urgent.has(c.id) ? 0 : urgencyOf(c.last) === 'important' && c.unread > 0 && !c.last?.mine && !c.muted ? 1 : 2
  return rows.map((c, i) => ({ c, i, r: rank(c) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.c)
}

/** Urgent messages from others that the guest has not acknowledged yet. */
export const unackedUrgent = (messages: readonly ChatMessage[]): ChatMessage[] =>
  messages.filter((m) => !m.system && urgencyOf(m) === 'urgent' && m.acked === false)

/** How many members have acknowledged one of your own urgent messages. */
export const ackedCount = (m: Pick<ChatMessage, 'ackedBy'>): number => m.ackedBy?.length ?? 0

/** The rank behind a send problem for the level: whether the server refused the level itself. */
export const isUrgencyRefusal = (code: string, title?: string): boolean => (code === 'forbidden' || code === 'invalid') && title === 'urgency'
