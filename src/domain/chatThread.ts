/** Rules for conversations and messages (docs/chat-plan.md, phase 4 and section 4.8). Framework-free. */
import type { ChatConversation, ChatMessage } from '../api/chatTypes'

/** How many messages a thread loads at first; older ones come on request. Matches the server's page. */
export const PAGE_SIZE = 30
export const MAX_TEXT = 2000
/** Inside this many pixels of the bottom, a thread follows new messages; further up it shows a "New messages" chip instead. */
export const NEAR_BOTTOM_PX = 80

/** An id made on the device for one send, so a retry never doubles the message (the server returns the stored one). */
export function newClientId(random: () => number = Math.random): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(random() * 4)).toString(16)}${hex(3)}-${hex(12)}`
}

/** Messages in arrival order with no repeats: a message seen twice (a refetch, a retry that landed) keeps its first place. */
export function mergeMessages(...lists: readonly (readonly ChatMessage[])[]): ChatMessage[] {
  const seen = new Set<string>()
  const out: ChatMessage[] = []
  for (const list of lists) for (const m of list) if (!seen.has(m.id)) { seen.add(m.id); out.push(m) }
  return out
}

/** Older messages go in front of what is on screen. A refetch of the latest page replaces what it covers and keeps older ones already loaded. */
export function withLatest(current: readonly ChatMessage[], latest: readonly ChatMessage[]): ChatMessage[] {
  if (latest.length === 0) return [...current]
  const first = current.findIndex((m) => m.id === latest[0].id)
  if (first === -1) return mergeMessages(current, latest)
  return [...current.slice(0, first), ...latest]
}

export const withOlder = (current: readonly ChatMessage[], older: readonly ChatMessage[]): ChatMessage[] => mergeMessages(older, current)

/** True when the guest is close enough to the bottom that new messages should simply appear and be followed. */
export const isNearBottom = (scrollTop: number, clientHeight: number, scrollHeight: number, slack = NEAR_BOTTOM_PX): boolean =>
  scrollHeight - (scrollTop + clientHeight) <= slack

/** Whether the newest message changed to one from someone else: the case that deserves an announcement and maybe a chip. */
export function incomingSince(previousLastId: string | null, messages: readonly ChatMessage[], me: string): ChatMessage | null {
  const last = messages[messages.length - 1]
  if (!last || last.id === previousLastId || last.from === me) return null
  return last
}

/** Where one of your own messages stands. `sending` is in flight, `waiting` is held until there is signal, `read` needs both sides to have receipts on. */
export type Delivery = 'sending' | 'waiting' | 'sent' | 'read'

export const deliveryOf = (m: Pick<ChatMessage, 'seenBy'>): Exclude<Delivery, 'sending' | 'waiting'> => (m.seenBy && m.seenBy.length > 0 ? 'read' : 'sent')

/** What the list shows under a conversation's name: "Sam: lunch at one?", "You: On my way", "Photo", or nothing to say yet. */
export function lastLine(c: Pick<ChatConversation, 'last'>, you: string, photo: string): string {
  const l = c.last
  if (!l) return ''
  const body = l.text || (l.photo ? photo : '')
  const who = l.mine ? you : l.fromName
  return who && body ? `${who}: ${body}` : body
}

export const totalUnread = (list: readonly Pick<ChatConversation, 'unread'>[]): number => list.reduce((n, c) => n + Math.max(0, c.unread), 0)

/** "Sam R." gives "SR", "My group" gives "MG": the letters in the round avatar. Two at most, never empty. */
export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const letters = parts.length === 1 ? [...parts[0]].slice(0, 2) : [[...parts[0]][0], [...parts[parts.length - 1]][0]]
  return letters.join('').toUpperCase()
}

export type SendProblem = 'blocked' | 'closed' | 'contact' | 'text' | 'age' | 'gone' | 'other'

/** What a failed send means for the guest, from the server's code and title. `blocked` keeps the text in the box and asks them to reword it. */
export function sendProblem(code: string, title?: string): SendProblem {
  if (code === 'invalid') return title === 'blocked' ? 'blocked' : title === 'contactInfo' ? 'contact' : 'text'
  if (code === 'conflict') return 'closed'
  if (code === 'forbidden') return 'age'
  if (code === 'notFound') return 'gone'
  return 'other'
}

/** A message waiting in the outbox for this conversation, as a bubble: it is `waiting` for signal (never a spinner that blocks typing). */
export interface PendingMessage { id: string; text: string; state: 'sending' | 'waiting' }

export function pendingFor(conversationId: string, items: readonly { id: string; payload: Record<string, string> }[]): PendingMessage[] {
  return items.filter((x) => x.payload.conversation === conversationId && typeof x.payload.text === 'string').map((x) => ({ id: x.payload.clientId ?? x.id, text: x.payload.text, state: 'waiting' as const }))
}

/** A conversation id from a link (`/chat?c=…`), only if it looks like one. */
export function conversationFromSearch(search: string): string | null {
  const v = new URLSearchParams(search).get('c')
  return v && /^[0-9a-fA-F-]{32,36}$/.test(v) ? v : null
}
