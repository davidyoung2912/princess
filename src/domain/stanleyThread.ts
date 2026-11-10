/**
 * The permanent Stanley chat (docs/chat-features-research.md, section 15, phase 0a). Framework-free: which conversation it is, how the notices the server holds and the questions the device holds
 * are shown in one time-ordered thread, and the one wording rule: nothing the guest reads says "AI" (owner decision, 2026-11-10).
 */
import type { ChatConversation, ChatMessage, NoticeLane } from '../api/chatTypes'

/** The question and answer history Stanley keeps on the device (the shape the Ask dialog holds, narrowed to what the thread shows). */
export interface DeviceTurn { id: string; role: 'user' | 'assistant'; text: string; at: number }

export const isStanleyChat = (c: Pick<ChatConversation, 'kind' | 'permanent'>): boolean => c.permanent === true || c.kind === 'stanley'

/** One thing in the thread: a message the server holds (a notice, a card, a line marking a change of voice), or a question or answer held on this device. */
export type ThreadItem =
  | { key: string; at: number; kind: 'server'; message: ChatMessage }
  | { key: string; at: number; kind: 'question' | 'answer'; text: string }

/**
 * The server's messages and the device's questions in time order. An answer with no text (a refusal, a handed-off turn, an unreachable server) is left out: the Ask dialog explains those
 * where the guest asked. On equal times the server's message comes first, so a notice never lands between a question and its answer by accident.
 */
export function threadItems(server: readonly ChatMessage[], device: readonly DeviceTurn[]): ThreadItem[] {
  const items: ThreadItem[] = [
    ...server.map((message): ThreadItem => ({ key: `s:${message.id}`, at: message.at, kind: 'server', message })),
    ...device.filter((d) => d.text.trim() !== '').map((d): ThreadItem => ({ key: `d:${d.id}`, at: d.at, kind: d.role === 'user' ? 'question' : 'answer', text: d.text })),
  ]
  return items.map((x, i) => ({ x, i })).sort((a, b) => a.x.at - b.x.at || (a.x.kind === 'server' ? 0 : 1) - (b.x.kind === 'server' ? 0 : 1) || a.i - b.i).map((e) => e.x)
}

/** The line under Stanley's name: the company or the ship, as the server said. Never empty text for a screen reader to trip on. */
export const subtitleOf = (c: Pick<ChatConversation, 'subtitle'>): string => c.subtitle?.trim() ?? ''

/** True when the text would show the guest the word "AI" on its own. Used by a test that fails the build if a guest-facing Stanley string contains it. */
export const mentionsAI = (text: string): boolean => /\bAI\b/.test(text)

/** What the free-text box passes on: trimmed, and nothing when empty. The Ask dialog does the sending, so the guest presses Send there. */
export const questionFrom = (text: string): string | null => {
  const t = text.trim()
  return t === '' ? null : t.slice(0, 500)
}

/** Whether a relayed notice can still be acted on, or why not: replaced by a newer one, or past its time. Messages that are not notices are always 'active'. */
export type NoticeState = 'active' | 'superseded' | 'expired'
export const noticeState = (m: Pick<ChatMessage, 'notice'>): NoticeState =>
  m.notice?.superseded ? 'superseded' : m.notice?.expired ? 'expired' : 'active'

/** The lane's order for sorting a strip, most pressing first. */
const LANE_RANK: Record<NoticeLane, number> = { critical: 0, important: 1, reminder: 2, info: 3 }

/** First line of a notice: its headline. The rest is the body. */
export const noticeHeadline = (text: string): string => text.split('\n', 1)[0] ?? ''
export const noticeBody = (text: string): string => text.includes('\n') ? text.slice(text.indexOf('\n') + 1) : ''

/**
 * The "Needs you" strip: critical and important notices that are still actionable and that the guest has not confirmed with Got it, most pressing first, then oldest first.
 * `acked === undefined` means the notice does not ask for Got it, so it is not outstanding.
 */
export function needsYou(messages: readonly ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.stanley === true && m.notice !== undefined && (m.notice.lane === 'critical' || m.notice.lane === 'important') && noticeState(m) === 'active' && m.acked === false)
    .sort((a, b) => LANE_RANK[a.notice!.lane] - LANE_RANK[b.notice!.lane] || a.at - b.at)
}

/** A link the thread may follow: an app route only (one slash, no scheme or host), so a stray value from the server can never take the guest off the site. */
export const safeNoticePath = (path: string | undefined): string | null => (path && /^\/(?!\/)[\w\-./?=&%]*$/.test(path) ? path : null)

/** The calendar day an item falls on, on this device (year-month-day), used to put a day heading above a run of messages on the same day. */
export const dayKey = (at: number): string => {
  const d = new Date(at)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** True when this item starts a new day, so the thread shows a heading above it. The first item always does. */
export const startsDay = (items: readonly { at: number }[], index: number): boolean => index === 0 || dayKey(items[index - 1].at) !== dayKey(items[index].at)
