/**
 * The group poll and dream board (S4-05, S0-06), shared by everyone on the booking (next-level plan N4.2). Each person votes or hearts from their own phone; a
 * vote is one row per person, so two people voting at once never overwrite each other, and voting again changes only your own. Framework-free.
 */
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export interface PollOption { id: string; label: string }
/** `votes` is the voter's id to the option id: one vote each. */
export interface Poll {
  id: string
  question: string
  options: PollOption[]
  votes: Record<string, string>
  /** When the organiser closed voting (DRM-14); absent while open. A closed poll takes no more votes. */
  closedAt?: number
  /** Beyond the pick in `votes` (a yes), a person may mark other options maybe or no. No mark on an option means no answer, never a yes. */
  answers?: Record<string, Record<string, Mark>>
  /** When the poll was made, and when it stops taking answers (phase 9). Absent for a poll with no time limit. */
  createdAt?: number
  closesAt?: number
}
export type Mark = 'maybe' | 'no'
export type Answer = 'yes' | Mark
/** `hearts` holds the ids of the people who hearted it. */
export interface Idea { id: string; text: string; hearts: string[] }
/** `dates` is the person's id to the sailing ids they can do (the date finder). */
export interface BoardState { polls: Poll[]; ideas: Idea[]; dates: Record<string, string[]> }
export const EMPTY_BOARD: BoardState = { polls: [], ideas: [], dates: {} }
export const POLLS_MAX = 6, OPTIONS_MAX = 6, VOTERS_MAX = 12, IDEAS_MAX = 20, DATES_MAX = 30

export const DAY_MS = 86_400_000
export const CLOSE_CHOICES_DAYS = [1, 3, 7] as const

export function newPoll(id: string, question: string, labels: readonly string[], now?: number, closesInDays?: number): Poll | null {
  const q = clean(question, 80)
  const opts = [...new Set(labels.map((l) => clean(l, 40)).filter(Boolean))].slice(0, OPTIONS_MAX)
  if (!q || opts.length < 2) return null
  const timed = now !== undefined && closesInDays !== undefined && (CLOSE_CHOICES_DAYS as readonly number[]).includes(closesInDays)
  return { id, question: q, options: opts.map((label, i) => ({ id: `o${i + 1}`, label })), votes: {}, ...(now !== undefined ? { createdAt: now } : {}), ...(timed ? { closesAt: now + closesInDays * DAY_MS } : {}) }
}

/** Whether the closing time has passed. A poll with no closing time never expires. */
export const isExpired = (p: Poll, now: number): boolean => p.closesAt !== undefined && p.closesAt <= now

/** Whether answers are still taken: not closed by the organiser and not past the closing time. */
export const takesAnswers = (p: Poll, now?: number): boolean => p.closedAt === undefined && (now === undefined || !isExpired(p, now))

/** The organiser gives the poll another day. Only a poll that has a closing time and was not closed is extended. */
export function extendPoll(p: Poll, now: number): Poll {
  if (p.closedAt !== undefined || p.closesAt === undefined) return p
  return { ...p, closesAt: Math.max(p.closesAt, now) + DAY_MS }
}

/** What this person said about one option: their pick is a yes, a mark is maybe or no, and nothing is null (silence is not a yes). */
export function answerOf(p: Poll, voter: string, optionId: string): Answer | null {
  if (p.votes[voter] === optionId) return 'yes'
  return p.answers?.[voter]?.[optionId] ?? null
}

/** Marks an option maybe or no for one person, or clears the mark. Marking the option they picked takes the pick back. */
export function markOption(p: Poll, voter: string, optionId: string, mark: Mark | null, now?: number): Poll {
  if (!takesAnswers(p, now) || !voter || !p.options.some((o) => o.id === optionId)) return p
  const mine = { ...(p.answers?.[voter] ?? {}) }
  if (mark === null) delete mine[optionId]
  else {
    if (!(voter in p.votes) && !p.answers?.[voter] && Object.keys(p.answers ?? {}).length + Object.keys(p.votes).length >= VOTERS_MAX * 2) return p
    mine[optionId] = mark
  }
  const votes = { ...p.votes }
  if (mark !== null && votes[voter] === optionId) delete votes[voter]
  const answers = { ...(p.answers ?? {}) }
  if (Object.keys(mine).length === 0) delete answers[voter]
  else answers[voter] = mine
  return { ...p, votes, answers }
}

/** One vote per person: voting again changes it. */
export function castVote(p: Poll, voter: string, optionId: string, now?: number): Poll {
  if (!takesAnswers(p, now) || !voter || !p.options.some((o) => o.id === optionId)) return p
  if (!(voter in p.votes) && Object.keys(p.votes).length >= VOTERS_MAX) return p
  const mine = p.answers?.[voter]
  if (mine?.[optionId] === undefined) return { ...p, votes: { ...p.votes, [voter]: optionId } }
  // Picking an option takes back an earlier maybe or no on it.
  const rest = Object.fromEntries(Object.entries(mine).filter(([id]) => id !== optionId))
  const answers = { ...(p.answers ?? {}) }
  if (Object.keys(rest).length === 0) delete answers[voter]
  else answers[voter] = rest
  return { ...p, votes: { ...p.votes, [voter]: optionId }, answers }
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
    const answers: Record<string, Record<string, Mark>> = {}
    for (const [who, m] of Object.entries(rec(o.answers))) {
      if (!who || Object.keys(answers).length >= VOTERS_MAX) continue
      const marks: Record<string, Mark> = {}
      for (const [opt, v] of Object.entries(rec(m))) if ((v === 'maybe' || v === 'no') && options.some((p) => p.id === opt) && votes[who] !== opt) marks[opt] = v
      if (Object.keys(marks).length > 0) answers[who] = marks
    }
    const time = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
    return [{
      id: o.id, question: clean(o.question, 80), options, votes, ...(typeof o.closedAt === 'number' ? { closedAt: o.closedAt } : {}),
      ...(Object.keys(answers).length > 0 ? { answers } : {}), ...(time(o.createdAt) !== undefined ? { createdAt: time(o.createdAt) } : {}), ...(time(o.closesAt) !== undefined ? { closesAt: time(o.closesAt) } : {}),
    }]
  }).slice(0, POLLS_MAX)
  const ideas = arr(r.ideas).flatMap((x): Idea[] => {
    const o = rec(x)
    return typeof o.id === 'string' && clean(o.text, 80) ? [{ id: o.id, text: clean(o.text, 80), hearts: arr(o.hearts).filter((h): h is string => typeof h === 'string' && h !== '').slice(0, VOTERS_MAX) }] : []
  }).slice(0, IDEAS_MAX)
  const dates: Record<string, string[]> = {}
  for (const [who, v] of Object.entries(rec(r.dates))) {
    const ids = [...new Set(arr(v).filter((x): x is string => typeof x === 'string' && x !== ''))].slice(0, DATES_MAX)
    if (who && ids.length > 0 && Object.keys(dates).length < VOTERS_MAX) dates[who] = ids
  }
  return { polls, ideas, dates }
}

/** Ticks or unticks a sailing for one person. A person with no sailings ticked is dropped. */
export function toggleDate(dates: Record<string, string[]>, who: string, sailingId: string): Record<string, string[]> {
  if (!who || !sailingId) return dates
  const mine = dates[who] ?? []
  if (!mine.includes(sailingId) && (mine.length >= DATES_MAX || (!(who in dates) && Object.keys(dates).length >= VOTERS_MAX))) return dates
  const next = mine.includes(sailingId) ? mine.filter((x) => x !== sailingId) : [...mine, sailingId]
  const rest = Object.fromEntries(Object.entries(dates).filter(([k]) => k !== who))
  return next.length === 0 ? rest : { ...rest, [who]: next }
}

export interface DateFinding {
  /** How many people have ticked at least one sailing. */
  people: number
  /** Sailings every one of them can do, cheapest first (no price last, then the given order). */
  everyone: string[]
  /** The cheapest of those, or null. */
  cheapest: string | null
  /** When nobody agrees on one: the sailing the most people can do, with how many. */
  best: { id: string; count: number } | null
}

/** The dates everyone can make (the date finder). With fewer than two people there is nothing to agree on yet. */
export function findDates(dates: Record<string, string[]>, priceOf: (sailingId: string) => number | null): DateFinding {
  const lists = Object.values(dates)
  const people = lists.length
  const counts = new Map<string, number>()
  for (const l of lists) for (const id of l) counts.set(id, (counts.get(id) ?? 0) + 1)
  const price = (id: string): number => priceOf(id) ?? Number.POSITIVE_INFINITY
  const everyone = people < 2 ? [] : [...counts].filter(([, n]) => n === people).map(([id]) => id).sort((a, b) => price(a) - price(b))
  const top = [...counts].sort((a, b) => b[1] - a[1] || price(a[0]) - price(b[0]))[0]
  return { people, everyone, cheapest: everyone[0] ?? null, best: people >= 2 && everyone.length === 0 && top ? { id: top[0], count: top[1] } : null }
}

/** Closes voting. The result stays; nobody can vote or change a vote after this. */
export const closePoll = (p: Poll, now: number): Poll => (p.closedAt === undefined ? { ...p, closedAt: now } : p)

/** The result of a poll as plain text for sharing: the question, each option with its votes, and the winner. Names of voters are not included. */
export function pollResultText(p: Poll, labels: { winner: string; tie: string; none: string; votes: (n: number) => string }): string {
  const win = leader(p)
  const lines = [p.question, ...tally(p).map(({ option, votes }) => `- ${option.label}: ${labels.votes(votes)}`)]
  lines.push(win ? labels.winner.replace('{label}', win.label) : Object.keys(p.votes).length === 0 ? labels.none : labels.tie)
  return lines.join('\n')
}
