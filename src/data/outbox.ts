/** Actions that could not be sent (no signal, a slow link) wait here and are retried with growing gaps (PERF-04, NET-03). */
export interface OutboxItem {
  id: string
  /** What to send: the screen that queued it knows how. */
  kind: 'chat' | 'service'
  payload: Record<string, string>
  queuedAt: number
  attempts: number
  nextAt: number
}

export const BASE_DELAY_MS = 2_000
export const MAX_DELAY_MS = 60_000
export const MAX_ATTEMPTS = 8
export const MAX_QUEUED = 20

/** Wait before retry number `attempt` (0 first): doubles each time up to a minute, with up to half taken off so many phones do not retry together. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const full = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempt))
  return Math.round(full * (0.5 + random() * 0.5))
}

/** Failures worth retrying: no signal, a flaky link, a slow answer or a server fault. Anything else is a real answer. */
export const isRetryable = (code: string): boolean => code === 'offline' || code === 'network' || code === 'timeout' || code === 'server'

export class TimeoutError extends Error {
  readonly code = 'timeout'
  constructor() { super('timeout') }
}

/** Gives up waiting after `ms`. The underlying call may still finish; the caller must treat a timeout as "not known to have arrived". */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms)
    work.then((v) => { clearTimeout(timer); resolve(v) }, (e) => { clearTimeout(timer); reject(e) })
  })
}

export function enqueue(list: readonly OutboxItem[], item: Pick<OutboxItem, 'id' | 'kind' | 'payload'>, now: number): OutboxItem[] {
  if (list.some((x) => x.id === item.id)) return [...list]
  return [...list, { ...item, queuedAt: now, attempts: 0, nextAt: now }].slice(-MAX_QUEUED)
}

export const due = (list: readonly OutboxItem[], now: number): OutboxItem[] => list.filter((x) => x.nextAt <= now && x.attempts < MAX_ATTEMPTS)

/** After a failed try: count it and schedule the next. */
export function failed(list: readonly OutboxItem[], id: string, now: number, random?: () => number): OutboxItem[] {
  return list.map((x) => (x.id === id ? { ...x, attempts: x.attempts + 1, nextAt: now + backoffMs(x.attempts, random) } : x))
}

export const sent = (list: readonly OutboxItem[], id: string): OutboxItem[] => list.filter((x) => x.id !== id)

export const gaveUp = (list: readonly OutboxItem[]): OutboxItem[] => list.filter((x) => x.attempts >= MAX_ATTEMPTS)

/** The next time anything is due, or null. */
export function nextWake(list: readonly OutboxItem[]): number | null {
  const waiting = list.filter((x) => x.attempts < MAX_ATTEMPTS)
  return waiting.length === 0 ? null : Math.min(...waiting.map((x) => x.nextAt))
}

const isItem = (v: unknown): v is OutboxItem => {
  const o = v as OutboxItem
  return !!o && typeof o.id === 'string' && (o.kind === 'chat' || o.kind === 'service') && !!o.payload && typeof o.payload === 'object' && typeof o.queuedAt === 'number' && typeof o.attempts === 'number' && typeof o.nextAt === 'number'
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const outboxKey = (persona: string): string => `princess:outbox:${persona}`

export function loadOutbox(store: Store | null, persona: string): OutboxItem[] {
  try {
    const raw = store?.getItem(outboxKey(persona))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isItem).slice(-MAX_QUEUED) : []
  } catch {
    return []
  }
}

export function saveOutbox(store: Store | null, persona: string, list: readonly OutboxItem[]): void {
  try {
    if (list.length === 0) store?.removeItem(outboxKey(persona))
    else store?.setItem(outboxKey(persona), JSON.stringify(list))
  } catch {
    // Storage full or blocked: the screen still shows the message as waiting for this visit.
  }
}
