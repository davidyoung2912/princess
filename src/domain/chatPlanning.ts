/** Group planning in chat (docs/chat-features-research.md, section 11, phase 4): polls, plans with an answer, and who may post. Framework-free; mirrors `ChatPlanningRules` on the server. */
import type { ChatMessage, ChatPlannable, ChatPoll, ChatRsvp, ChatTally } from '../api/chatTypes'

export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 5
export const QUESTION_MAX = 100
export const OPTION_MAX = 40

/** A line as typed: spaces collapsed and trimmed. */
const line = (v: string): string => v.replace(/\s+/g, ' ').trim()

/**
 * The poll the form describes, cleaned the way the server cleans it: a question, and two to five different options (the same words in another case count once; an empty row is left out).
 * Null when it cannot be sent, so the Ask button can stay off.
 */
export function cleanPollDraft(question: string, options: readonly string[]): ChatPoll | null {
  const q = line(question)
  if (q.length === 0 || q.length > QUESTION_MAX) return null
  const kept: string[] = []
  for (const raw of options) {
    const o = line(raw)
    if (o.length === 0) continue
    if (o.length > OPTION_MAX) return null
    if (!kept.some((k) => k.toLowerCase() === o.toLowerCase())) kept.push(o)
  }
  return kept.length < POLL_MIN_OPTIONS || kept.length > POLL_MAX_OPTIONS ? null : { question: q, options: kept }
}

/** Whether another option row can be added to the form. */
export const canAddOption = (rows: number): boolean => rows < POLL_MAX_OPTIONS

/** Whether a poll is closed: the server says so, and a copy held on the device also stops taking votes once its 24 hours have passed. */
export const isPollClosed = (tally: Pick<ChatTally, 'closed' | 'closesAt'>, now: number): boolean => tally.closed || (tally.closesAt !== undefined && tally.closesAt <= now)

/** A share of the votes as a whole number, 0 when there are none. */
export const percentOf = (count: number, total: number): number => (total === 0 ? 0 : Math.round((count / total) * 100))

export const totalVotes = (counts: readonly number[]): number => counts.reduce((a, b) => a + b, 0)

/** The index of each option that has the most votes (several on a tie), or none when nobody voted. */
export function leaders(counts: readonly number[]): number[] {
  const top = Math.max(0, ...counts)
  return top === 0 ? [] : counts.flatMap((c, i) => (c === top ? [i] : []))
}

/** Your vote, taken before the server answers: the old one comes off its option, the new one goes on. Mirrors the server's one-vote-each rule. */
export function applyVote(tally: ChatTally, option: number): ChatTally {
  const counts = [...tally.counts]
  if (tally.mine !== undefined && counts[tally.mine] !== undefined) counts[tally.mine] = Math.max(0, counts[tally.mine]! - 1)
  if (counts[option] !== undefined) counts[option] += 1
  return { ...tally, counts, mine: option }
}

export const RSVP_CHOICES: readonly ChatRsvp[] = ['going', 'maybe', 'no']

/** The place of an answer in a plan's counts: going, maybe, no. */
export const rsvpIndex = (choice: ChatRsvp): number => RSVP_CHOICES.indexOf(choice)
export const rsvpOf = (index: number | undefined): ChatRsvp | null => (index === undefined ? null : (RSVP_CHOICES[index] ?? null))

/** Your answer to a plan, taken before the server answers. Whether the event reached your programme is the server's to say, so that part is left as it was. */
export function applyRsvp(tally: ChatTally, choice: ChatRsvp): ChatTally {
  const counts = [...tally.counts]
  if (tally.mine !== undefined && counts[tally.mine] !== undefined) counts[tally.mine] = Math.max(0, counts[tally.mine]! - 1)
  const at = rsvpIndex(choice)
  counts[at] = (counts[at] ?? 0) + 1
  return { ...tally, counts, mine: at }
}

/** The words a screen reader gets for a poll: the question, each option with its votes and share, your vote, and whether it is closed. */
export function pollResultText(poll: ChatPoll, tally: ChatTally, words: { votes: (n: number) => string; yours: (option: string) => string; closed: string; open: string }): string {
  const total = totalVotes(tally.counts)
  const parts = poll.options.map((o, i) => `${o}: ${words.votes(tally.counts[i] ?? 0)} (${percentOf(tally.counts[i] ?? 0, total)}%)`)
  if (tally.mine !== undefined && poll.options[tally.mine] !== undefined) parts.push(words.yours(poll.options[tally.mine]!))
  parts.push(tally.closed ? words.closed : words.open)
  return `${poll.question}. ${parts.join('. ')}.`
}

/** What a poll or plan is: the typed kinds this phase adds. */
export const isPoll = (m: Pick<ChatMessage, 'kind' | 'poll'>): boolean => m.kind === 'poll' && m.poll !== undefined
export const isPlan = (m: Pick<ChatMessage, 'kind' | 'card'>): boolean => m.kind === 'plan' && m.card !== undefined

/** The events of one day in time order, for the day picker in the plan chooser. */
export function eventsOnDay(events: readonly ChatPlannable[], day: number): ChatPlannable[] {
  return events.filter((e) => e.day === day).sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title))
}

/** The days that have an event, ascending. */
export const planDays = (events: readonly ChatPlannable[]): number[] => [...new Set(events.map((e) => e.day))].sort((a, b) => a - b)

/** Whether this person may write in the conversation: everyone, except in an announcement-only group where only admins do. Votes, answers and reactions are always open. */
export const canPost = (c: { announcementOnly?: boolean; admin?: boolean } | null | undefined): boolean => !c?.announcementOnly || c.admin === true

/** The second admin is named from the members who are not the creator or you; a child is never offered by the server, but the list is kept to people who can be. */
export function adminCandidates<M extends { you: boolean; creator: boolean }>(members: readonly M[]): M[] {
  return members.filter((m) => !m.you && !m.creator)
}
