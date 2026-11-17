import type { StanleyReminder } from './stanleyReminders'

/**
 * Stanley with no signal (docs/stanley-actions-and-proactive-plan.md section 21, phase P3c). The server stays the source of truth; the phone keeps a copy of the next day of reminders with the moment it was
 * last checked, shows what came due while it was offline with its true times, and keeps a confirm tap as "waiting to send" until it can go. A queued confirm is never applied here: on reconnect it goes back to the
 * server, which checks it again, and the guest is shown what happened in one card. Framework-free, so it is tested in node.
 */
const MIN = 60_000
const HOUR = 60 * MIN
/** How far ahead the phone keeps reminders, and how long after they were due it still shows them. */
export const CACHE_AHEAD_MS = 24 * HOUR
export const CACHE_BEHIND_MS = 6 * HOUR
/** Under this, a firing is on time; over it, it is "late" and says why. */
export const LATE_AFTER_MS = 2 * MIN
/** A confirm waits at most this long before it is dropped, and never past the preview's own expiry. */
export const QUEUE_HOLD_MS = 30 * MIN
export const QUEUE_MAX = 10

export interface ReminderCache { cachedAt: number; items: StanleyReminder[] }

/** What to keep from a fresh list: scheduled reminders from a little before now to a day ahead, private text included only because it is the guest's own device. */
export function buildCache(list: readonly StanleyReminder[], now: number): ReminderCache {
  return { cachedAt: now, items: list.filter((r) => r.state === 'scheduled' && r.dueAt >= now - CACHE_BEHIND_MS && r.dueAt <= now + CACHE_AHEAD_MS).slice(0, 50) }
}

/** The copy read back from storage: anything that is not the agreed shape is dropped. */
export function readCache(raw: unknown): ReminderCache | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { cachedAt?: unknown; items?: unknown }
  if (typeof o.cachedAt !== 'number' || !Number.isFinite(o.cachedAt) || !Array.isArray(o.items)) return null
  const items = o.items.filter((x): x is StanleyReminder => !!x && typeof x === 'object' && typeof (x as StanleyReminder).id === 'string' && Number.isFinite((x as StanleyReminder).dueAt) && typeof (x as StanleyReminder).text === 'string')
  return { cachedAt: o.cachedAt, items: items.slice(0, 50) }
}

export interface OfflineFiring {
  id: string
  text: string
  dueAt: number
  /** When this phone is showing it. */
  shownAt: number
  /** It came due before it could be shown (over two minutes ago). */
  late: boolean
  /** It follows a plan item or all aboard, and the copy cannot know whether that moved since `checkedAt`. */
  mayHaveMoved: boolean
  /** When the copy was last checked against the server. */
  checkedAt: number
}

/** Reminders from the copy that are due now and were not yet shown, soonest first. `shownIds` is what this phone has already shown. */
export function offlineFirings(cache: ReminderCache | null, now: number, shownIds: readonly string[]): OfflineFiring[] {
  if (!cache) return []
  return cache.items
    .filter((r) => r.state === 'scheduled' && r.dueAt <= now && now - r.dueAt <= CACHE_BEHIND_MS && !shownIds.includes(r.id))
    .map((r) => ({ id: r.id, text: r.text, dueAt: r.dueAt, shownAt: now, late: now - r.dueAt > LATE_AFTER_MS, mayHaveMoved: r.kind === 'anchored', checkedAt: cache.cachedAt }))
    .sort((a, b) => a.dueAt - b.dueAt)
}

/** The reminders still to come, from the copy, with the same flag for ones that may have moved. */
export const upcomingFromCache = (cache: ReminderCache | null, now: number): Array<StanleyReminder & { mayHaveMoved: boolean }> =>
  (cache?.items ?? []).filter((r) => r.state === 'scheduled' && r.dueAt > now).sort((a, b) => a.dueAt - b.dueAt).map((r) => ({ ...r, mayHaveMoved: r.kind === 'anchored' }))

export interface QueuedConfirm {
  /** The preview's id and the key made once for its card, so a retry cannot do it twice. */
  actionId: string
  key: string
  title: string
  queuedAt: number
  expiresAt: number
}

/** Keeps a confirm for later. The same preview twice keeps one; it waits for the shorter of the hold and the preview's own expiry. */
export function enqueue(queue: readonly QueuedConfirm[], item: { actionId: string; key: string; title: string }, previewExpiresAt: number, now: number): QueuedConfirm[] {
  const next: QueuedConfirm = { ...item, title: item.title.slice(0, 120), queuedAt: now, expiresAt: Math.min(now + QUEUE_HOLD_MS, previewExpiresAt) }
  return [...queue.filter((q) => q.actionId !== item.actionId), next].slice(-QUEUE_MAX)
}

/** What is still waiting, and what ran out of time. */
export function splitQueue(queue: readonly QueuedConfirm[], now: number): { waiting: QueuedConfirm[]; expired: QueuedConfirm[] } {
  return { waiting: queue.filter((q) => now <= q.expiresAt), expired: queue.filter((q) => now > q.expiresAt) }
}

export const readQueue = (raw: unknown): QueuedConfirm[] =>
  (Array.isArray(raw) ? raw : []).filter((x): x is QueuedConfirm => !!x && typeof x === 'object' && typeof (x as QueuedConfirm).actionId === 'string' && typeof (x as QueuedConfirm).key === 'string' && Number.isFinite((x as QueuedConfirm).expiresAt)).slice(-QUEUE_MAX)

export type CatchUpOutcome = 'done' | 'expired' | 'changed' | 'refused'
export interface CatchUpLine { actionId: string; title: string; outcome: CatchUpOutcome }

/** One card for everything that happened on reconnect, ranked: what the guest must look at again first, then what went through. */
export function catchUpCard(lines: readonly CatchUpLine[]): CatchUpLine[] {
  const rank: Record<CatchUpOutcome, number> = { changed: 0, refused: 1, expired: 2, done: 3 }
  return [...lines].sort((a, b) => rank[a.outcome] - rank[b.outcome])
}

/** How a refusal from the server on reconnect is told to the guest: "changed" shows the new preview, an old preview is just expired. */
export const outcomeOf = (problem: 'expired' | 'changed' | 'off' | 'forbidden' | 'tooLate' | 'other'): CatchUpOutcome =>
  problem === 'expired' || problem === 'tooLate' ? 'expired' : problem === 'changed' ? 'changed' : 'refused'
