import type { CountdownId } from './countdowns'

/**
 * The history of a deadline (MNG-15). When a deadline moves, the old date is kept as superseded and a new event starts; nothing is overwritten.
 */
export interface DeadlineEvent {
  id: CountdownId
  /** The deadline date, "YYYY-MM-DD", in the zone the countdown names. */
  date: string
  seenAt: number
  /** Set when a later date replaced this one. */
  supersededAt: number | null
}

export const DEADLINE_LOG_MAX = 30

export interface DeadlineDate { id: CountdownId; date: string }

/** Notes the current dates. A new date for a kind closes the open event and starts another; an unchanged date adds nothing. */
export function noteDeadlines(log: readonly DeadlineEvent[], current: readonly DeadlineDate[], now: number): DeadlineEvent[] {
  let next = [...log]
  for (const c of current) {
    const open = next.find((e) => e.id === c.id && e.supersededAt === null)
    if (open?.date === c.date) continue
    if (open) next = next.map((e) => (e === open ? { ...e, supersededAt: now } : e))
    next.push({ id: c.id, date: c.date, seenAt: now, supersededAt: null })
  }
  return next.slice(-DEADLINE_LOG_MAX)
}

/** The earlier dates of one kind, newest first. */
export const earlierDates = (log: readonly DeadlineEvent[], id: CountdownId): DeadlineEvent[] =>
  log.filter((e) => e.id === id && e.supersededAt !== null).sort((a, b) => b.seenAt - a.seenAt)

const IDS: readonly string[] = ['boarding', 'pay', 'checkin']

export function normalizeDeadlineLog(raw: unknown): DeadlineEvent[] {
  if (!Array.isArray(raw)) return []
  const out: DeadlineEvent[] = []
  for (const x of raw) {
    const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>
    if (typeof o.id === 'string' && IDS.includes(o.id) && typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && typeof o.seenAt === 'number') {
      out.push({ id: o.id as CountdownId, date: o.date, seenAt: o.seenAt, supersededAt: typeof o.supersededAt === 'number' ? o.supersededAt : null })
    }
  }
  return out.slice(-DEADLINE_LOG_MAX)
}
