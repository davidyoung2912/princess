/** Rules for the chat connection screens (docs/chat-plan.md, phases 1 and 2). Framework-free. */
import type { ChatConnections, ChatPerson, ChatRelation, ChatSummary } from '../api/chatTypes'

/** The shortest name the server will search for. */
export const MIN_QUERY = 3
export const MAX_QUERY = 40

/** The search text with spaces tidied, or null when it is too short or too long to search. */
export function cleanQuery(text: string): string | null {
  const q = text.trim().replace(/\s+/g, ' ')
  return q.length >= MIN_QUERY && q.length <= MAX_QUERY ? q : null
}

/** What the button next to a found person does. */
export type PersonAction = 'ask' | 'open' | 'none'

export function personAction(relation: ChatRelation): PersonAction {
  if (relation === 'none') return 'ask'
  if (relation === 'connected') return 'open'
  return 'none'
}

/** Looks the person up by relation so the wording is never decided by colour: each relation but `none` has its own note. */
export function relationNote(relation: ChatRelation): 'asked' | 'waiting' | 'approval' | 'connected' | null {
  return relation === 'none' ? null : relation
}

/** The number on the Chat tab: things that need the guest (requests, approvals, answers, new connections) and later unread messages. */
export function chatBadge(s: ChatSummary | null): number {
  if (!s) return 0
  return Math.max(0, s.incoming) + Math.max(0, s.approvals) + Math.max(0, s.answers) + Math.max(0, s.newlyConnected) + Math.max(0, s.unread)
}

/** "2 people want to chat": the banner on the conversation list counts requests waiting for the guest and for their children. */
export function waitingCount(c: ChatConnections): number {
  return c.incoming.length + c.approvals.length
}

/** Whether there is anything to show on the People area besides the search. */
export function hasActivity(c: ChatConnections): boolean {
  return c.connected.length + c.incoming.length + c.outgoing.length + c.answers.length + c.approvals.length > 0
}

/** People already shown as connected are left out of "ask" suggestions. */
export function askable(people: readonly ChatPerson[]): ChatPerson[] {
  return people.filter((p) => personAction(p.relation) === 'ask')
}

/** The error codes a request can fail with, mapped to the wording that says what to do next. */
export type RequestProblem = 'self' | 'noGuardian' | 'notFound' | 'connected' | 'alreadyAsked' | 'cooldown' | 'tooManyOpen' | 'tooMany' | 'other'

const PROBLEMS: readonly RequestProblem[] = ['self', 'noGuardian', 'notFound', 'connected', 'alreadyAsked', 'cooldown', 'tooManyOpen', 'tooMany']

export function requestProblem(code: string | undefined, detail: string | undefined): RequestProblem {
  const found = PROBLEMS.find((p) => p === detail) ?? PROBLEMS.find((p) => p === code)
  return found ?? 'other'
}
