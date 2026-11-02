/**
 * The group poll and dream board (S4-05, S0-06), shared by everyone on the booking (next-level plan N4.2). Each person votes or hearts from their own phone; a
 * vote is one row per person, so two people voting at once never overwrite each other, and voting again changes only your own. Framework-free.
 */
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export interface PollOption { id: string; label: string }
/** `votes` is the voter's id to the option id: one vote each. */
export interface Poll { id: string; question: string; options: PollOption[]; votes: Record<string, string> }
/** `hearts` holds the ids of the people who hearted it. */
export interface Idea { id: string; text: string; hearts: string[] }
export interface BoardState { polls: Poll[]; ideas: Idea[] }
export const EMPTY_BOARD: BoardState = { polls: [], ideas: [] }
export const POLLS_MAX = 6, OPTIONS_MAX = 6, VOTERS_MAX = 12, IDEAS_MAX = 20

export function newPoll(id: string, question: string, labels: readonly string[]): Poll | null {
  const q = clean(question, 80)
  const opts = [...new Set(labels.map((l) => clean(l, 40)).filter(Boolean))].slice(0, OPTIONS_MAX)
  if (!q || opts.length < 2) return null
  return { id, question: q, options: opts.map((label, i) => ({ id: `o${i + 1}`, label })), votes: {} }
}

/** One vote per person: voting again changes it. */
export function castVote(p: Poll, voter: string, optionId: string): Poll {
  if (!voter || !p.options.some((o) => o.id === optionId)) return p
  if (!(voter in p.votes) && Object.keys(p.votes).length >= VOTERS_MAX) return p
  return { ...p, votes: { ...p.votes, [voter]: optionId } }
}

export const tally = (p: Poll): { option: PollOption; votes: number }[] => p.options.map((option) => ({ option, votes: Object.values(p.votes).filter((o) => o === option.id).length }))

/** The winner, or null while nobody has voted or the top is tied. */
export function leader(p: Poll): PollOption | null {
  const t = tally(p).sort((a, b) => b.votes - a.votes)
  return t[0] && t[0].votes > 0 && t[0].votes > (t[1]?.votes ?? 0) ? t[0].option : null
}

/** The option this person chose, or null. */
export const voteOf = (p: Poll, voter: string): PollOption | null => p.options.find((o) => o.id === p.votes[voter]) ?? null

export const addIdea = (list: readonly Idea[], id: string, text: string): Idea[] => {
  const x = clean(text, 80)
  return x && list.length < IDEAS_MAX ? [...list, { id, text: x, hearts: [] }] : [...list]
}

export const heartIdea = (list: readonly Idea[], id: string, who: string): Idea[] =>
  list.map((i) => (i.id !== id || !who ? i : { ...i, hearts: i.hearts.includes(who) ? i.hearts.filter((h) => h !== who) : [...i.hearts, who].slice(0, VOTERS_MAX) }))

/** Ideas with the most hearts first; a tie keeps the order they were added in. */
export const rankIdeas = (list: readonly Idea[]): Idea[] => [...list].sort((a, b) => b.hearts.length - a.hearts.length)

export function normalizeBoard(raw: unknown): BoardState {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})
  const polls = arr(r.polls).flatMap((x): Poll[] => {
    const o = rec(x)
    const options = arr(o.options).flatMap((y): PollOption[] => { const p = rec(y); return typeof p.id === 'string' && clean(p.label, 40) ? [{ id: p.id, label: clean(p.label, 40) }] : [] }).slice(0, OPTIONS_MAX)
    if (typeof o.id !== 'string' || !clean(o.question, 80) || options.length < 2) return []
    const votes: Record<string, string> = {}
    for (const [k, v] of Object.entries(rec(o.votes))) if (typeof v === 'string' && options.some((p) => p.id === v) && k && Object.keys(votes).length < VOTERS_MAX) votes[k] = v
    return [{ id: o.id, question: clean(o.question, 80), options, votes }]
  }).slice(0, POLLS_MAX)
  const ideas = arr(r.ideas).flatMap((x): Idea[] => {
    const o = rec(x)
    return typeof o.id === 'string' && clean(o.text, 80) ? [{ id: o.id, text: clean(o.text, 80), hearts: arr(o.hearts).filter((h): h is string => typeof h === 'string' && h !== '').slice(0, VOTERS_MAX) }] : []
  }).slice(0, IDEAS_MAX)
  return { polls, ideas }
}
