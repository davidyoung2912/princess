/**
 * The permanent Stanley chat (docs/chat-features-research.md, section 15, phase 0a). Framework-free: which conversation it is, how the notices the server holds and the questions the device holds
 * are shown in one time-ordered thread, and the one wording rule: nothing the guest reads says "AI" (owner decision, 2026-11-10).
 */
import type { ChatConversation, ChatMessage } from '../api/chatTypes'

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
