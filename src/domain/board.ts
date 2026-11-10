/**
 * The dream board and date finder (S4-05, S0-06), shared by everyone on the booking (next-level plan N4.2). Each person hearts or ticks from their own phone; a
 * heart is one row per person, so two people acting at once never overwrite each other. Group polls live on the server (`src/ai/stanleyPolls.ts`). Framework-free.
 */
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** `hearts` holds the ids of the people who hearted it. */
export interface Idea { id: string; text: string; hearts: string[] }
/** `dates` is the person's id to the sailing ids they can do (the date finder). */
export interface BoardState { ideas: Idea[]; dates: Record<string, string[]> }
export const EMPTY_BOARD: BoardState = { ideas: [], dates: {} }
export const VOTERS_MAX = 12, IDEAS_MAX = 20, DATES_MAX = 30

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
  const ideas = arr(r.ideas).flatMap((x): Idea[] => {
    const o = rec(x)
    return typeof o.id === 'string' && clean(o.text, 80) ? [{ id: o.id, text: clean(o.text, 80), hearts: arr(o.hearts).filter((h): h is string => typeof h === 'string' && h !== '').slice(0, VOTERS_MAX) }] : []
  }).slice(0, IDEAS_MAX)
  const dates: Record<string, string[]> = {}
  for (const [who, v] of Object.entries(rec(r.dates))) {
    const ids = [...new Set(arr(v).filter((x): x is string => typeof x === 'string' && x !== ''))].slice(0, DATES_MAX)
    if (who && ids.length > 0 && Object.keys(dates).length < VOTERS_MAX) dates[who] = ids
  }
  return { ideas, dates }
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
