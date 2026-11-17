/** Stanley as host for strangers and room host (docs/chat-features-research.md, phase 12). Framework-free; the server decides everything, this only picks what to offer and the words for what it said. */
import type { ChatConversation, ChatIntro, ChatMeetUp, MeetUpAnswer } from '../api/chatTypes'

export const MEETUP_TITLE_MAX = 80
export const MEETUP_PLACE_MAX = 60
export const QUESTION_MAX = 200

export const MEET_ANSWERS: readonly MeetUpAnswer[] = ['in', 'maybe', 'no']

/** Whether the host tools show at all: in a room or a made group. A channel is staff-only, and a huddle or a direct chat has no host. */
export const hasHost = (c: Pick<ChatConversation, 'kind'>): boolean => c.kind === 'room' || c.kind === 'group'

/** Introduce me is for rooms only: strangers meet in a room, and a made group already knows each other. */
export const mayIntroduce = (c: Pick<ChatConversation, 'kind'>): boolean => c.kind === 'room'

/** A meet-up title or place: spaces tidied, within the limit, and nothing that looks like a link, number or email (the server says no to these too). Null when it cannot be used. */
export function cleanMeetUpText(text: string, max: number): string | null {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t === '' || t.length > max) return null
  return /(\d[\s.-]?){7,}|https?:\/\/|www\.|\S+@\S+\.\S+/i.test(t) ? null : t
}

/** The words for "3 in, 1 maybe". A decline is never counted. */
export const countsLine = (m: Pick<ChatMeetUp, 'in' | 'maybe'>): { in: number; maybe: number } => ({ in: m.in, maybe: m.maybe })

/** The answer buttons to show: all three, with the caller's own pressed. */
export const answerPressed = (m: Pick<ChatMeetUp, 'mine'>, a: MeetUpAnswer): boolean => m.mine === a

export type HostProblem = 'supervised' | 'notAdult' | 'unknown' | 'text' | 'contactInfo' | 'closed' | 'off' | 'notRoom' | 'limit' | 'answer' | 'offline' | 'other'
const PROBLEMS: readonly HostProblem[] = ['supervised', 'notAdult', 'unknown', 'text', 'contactInfo', 'closed', 'off', 'notRoom', 'limit', 'answer']

/** The server's code and title mapped to the wording that says what to do next. Anything else is shown by the general error. */
export function hostProblem(code: string | undefined, detail: string | undefined): HostProblem {
  if (code === 'offline' || code === 'network' || code === 'timeout') return 'offline'
  return PROBLEMS.find((p) => p === detail) ?? 'other'
}

/** What to say about "introduce me": nothing yet, waiting, or an introduction. */
export const introLabel = (i: Pick<ChatIntro, 'state'>): 'none' | 'waiting' | 'introduced' => i.state

/** The question is within bounds. */
export const mayAsk = (text: string): boolean => text.trim() !== '' && text.length <= QUESTION_MAX
