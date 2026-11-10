import { normalizeGroupStatus, type GroupStatus } from './stanleyPlanner'

/**
 * Group polls kept by the server for a booking (docs/stanley-gap-analysis-and-plan.md, phase 9). The adults on the booking answer yes, maybe or no to each choice from their own phone; only the person who
 * made a poll may close, extend or remove it. This reads the server's answer defensively. No count, state or suggestion is worked out here. Framework-free, so it is tested in node.
 */
export const POLL_ANSWERS = ['yes', 'maybe', 'no'] as const
export type PollAnswer = (typeof POLL_ANSWERS)[number]
export const POLL_DAYS = [1, 3, 7] as const

export interface ServerPoll {
  id: string
  question: string
  options: { id: string; label: string }[]
  createdAt: number
  closesAt: number | null
  closed: boolean
  mine: boolean
  owner: string
  myAnswers: Record<string, PollAnswer>
  status: GroupStatus
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const isAnswer = (v: unknown): v is PollAnswer => (POLL_ANSWERS as readonly unknown[]).includes(v)

export function normalizePoll(raw: unknown): ServerPoll | null {
  const o = rec(raw)
  const status = normalizeGroupStatus(o.status)
  if (typeof o.id !== 'string' || typeof o.question !== 'string' || !Array.isArray(o.options) || !status) return null
  const options = o.options.flatMap((x): { id: string; label: string }[] => { const r = rec(x); return typeof r.id === 'string' && typeof r.label === 'string' ? [{ id: r.id.slice(0, 40), label: r.label.slice(0, 40) }] : [] })
  const myAnswers: Record<string, PollAnswer> = {}
  for (const [k, v] of Object.entries(rec(o.myAnswers))) if (isAnswer(v) && options.some((x) => x.id === k)) myAnswers[k] = v
  return {
    id: o.id, question: o.question.slice(0, 120), options, createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0,
    closesAt: typeof o.closesAt === 'number' ? o.closesAt : null, closed: o.closed === true, mine: o.mine === true,
    owner: typeof o.owner === 'string' ? o.owner.slice(0, 40) : '', myAnswers, status,
  }
}

export const normalizePolls = (raw: unknown): ServerPoll[] => (Array.isArray(raw) ? raw.flatMap((p) => normalizePoll(p) ?? []) : [])

/** The choices for a new poll, from one line separated by commas or vertical bars. The server checks the count, length and repeats. */
export const splitChoices = (text: string): string[] => text.split(/[|,]/).map((s) => s.trim()).filter((s) => s !== '')

/** Whether a poll still takes answers. The server's own state wins; an expiry the device has not heard of yet is read from the clock only to disable buttons. */
export const takesAnswers = (p: ServerPoll, nowMs: number): boolean => !p.closed && p.status.state === 'open' && (p.closesAt === null || p.closesAt > nowMs)

/** The result of a poll as plain text for sharing: the question, each choice with its totals, and Stanley's read. No names; the server only ever sends totals. */
export function pollResultText(p: ServerPoll, line: (label: string, yes: number, maybe: number, no: number) => string): string {
  const rows = p.options.map((o) => { const x = p.status.tally.find((y) => y.id === o.id); return `- ${line(o.label, x?.yes ?? 0, x?.maybe ?? 0, x?.no ?? 0)}` })
  return [p.question, ...rows, p.status.suggestion.text].filter((l) => l !== '').join('\n')
}
