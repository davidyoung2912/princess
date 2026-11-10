/** When and what the in-app chat notice shows (docs/chat-plan.md, phase 8). Framework-free. */
import type { ChatConnection, ChatConnections, ChatConversation, ChatSummary } from '../api/chatTypes'

/** How long a notice stays before it goes away by itself. */
export const NOTICE_MS = 6000

export interface ChatNotice {
  /** One notice replaces another with the same key; a new arrival in the same conversation updates it. */
  key: string
  kind: 'request' | 'message'
  name: string
  /** For a message: how many are unread in that conversation. */
  count: number
  /** A request the guest can accept from the notice (never a guardian approval). */
  requestId: string | null
  conversationId: string | null
  /** An unacknowledged urgent message: it stays until "Got it", ignores calm mode and the pop-ups setting, and is announced at once. */
  urgent?: boolean
}

export interface Arrivals { requests: number; messages: number }

/** What is new since the last numbers. The first numbers after launch are never "new": the badge already says so. */
export function arrivals(prev: ChatSummary | null, next: ChatSummary): Arrivals {
  if (!prev) return { requests: 0, messages: 0 }
  return {
    requests: Math.max(0, next.incoming + next.approvals - (prev.incoming + prev.approvals)),
    messages: Math.max(0, next.unread - prev.unread),
  }
}

/** Whether a notice may show: switched on, not in calm mode or do not disturb, and the guest is not already in Chat (where the list and banner say it). */
export function mayNotify(o: { popups: boolean; calm: boolean; path: string; dnd?: boolean }): boolean {
  return o.popups && !o.calm && !o.dnd && o.path !== '/chat' && !o.path.startsWith('/chat/')
}

/** An urgent notice shows unless the guest is already in Chat, where the pinned row and the message itself say it. Calm mode and the pop-ups setting do not apply. */
export const mayNotifyUrgent = (path: string): boolean => path !== '/chat' && !path.startsWith('/chat/')

const newest = <T extends { at: number }>(rows: readonly T[]): T | null => rows.reduce<T | null>((best, r) => (!best || r.at > best.at ? r : best), null)

/** The notice for what arrived: a request wins over a message because it needs an answer. Null when nothing visible matches (a muted chat, a closed one, text sent by me). */
export function chooseNotice(a: Arrivals, connections: ChatConnections | null, conversations: readonly ChatConversation[] | null): ChatNotice | null {
  if (a.requests > 0 && connections) {
    const mine = newest(connections.incoming)
    if (mine) return request(mine, true)
    const child = newest(connections.approvals)
    if (child) return request(child, false)
  }
  if (a.messages > 0 && conversations) {
    const c = newest(conversations.filter((x) => x.unread > 0 && !x.muted && !x.closed && x.last && !x.last.mine).map((x) => ({ ...x, at: x.last!.at })))
    if (c) return { key: `message:${c.id}`, kind: 'message', name: c.kind === 'direct' ? c.name : (c.last?.fromName || c.name), count: c.unread, requestId: null, conversationId: c.id }
  }
  return null
}

/** The notice for the newest conversation with an unacknowledged urgent message (muted or closed does not matter), or null when the list does not have it. */
export function chooseUrgentNotice(urgentIds: readonly string[], conversations: readonly ChatConversation[] | null): ChatNotice | null {
  if (!conversations || urgentIds.length === 0) return null
  const c = newest(conversations.filter((x) => urgentIds.includes(x.id)).map((x) => ({ ...x, at: x.last?.at ?? x.at })))
  if (!c) return null
  return { key: `urgent:${c.id}`, kind: 'message', name: c.last?.fromName || c.name, count: Math.max(1, urgentIds.length), requestId: null, conversationId: c.id, urgent: true }
}

const request = (c: ChatConnection, canAccept: boolean): ChatNotice =>
  ({ key: `request:${c.id}`, kind: 'request', name: c.name, count: 1, requestId: canAccept ? c.id : null, conversationId: null })

/** Where tapping the notice goes. */
export const noticePath = (n: ChatNotice): string =>
  n.kind === 'message' && n.conversationId ? `/chat?c=${encodeURIComponent(n.conversationId)}` : '/chat?mode=people'

/** Requests waiting for the guest, for the "needs you" row on Home. */
export const requestsWaiting = (s: ChatSummary | null): number => (s ? Math.max(0, s.incoming) + Math.max(0, s.approvals) : 0)
