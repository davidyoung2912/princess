import { scrub, type DiagnosticKind } from './log'

/**
 * PERF-07 and CNT-03: error reports and usage counts that leave the log only with the guest's "Help improve the app" consent.
 * What can be sent is fixed here: an error kind with a scrubbed message, and a named event with no person, booking or typed text.
 * The sink is a stub today (an on-device queue); a real endpoint replaces it without changing what is collected.
 */
export const TELEMETRY_KEY = 'princess:telemetry'
export const MAX_QUEUE = 100

export const EVENTS = ['screen', 'install', 'offlineUse', 'dataLight'] as const
export type EventName = (typeof EVENTS)[number]

export type TelemetryItem =
  | { type: 'error'; kind: DiagnosticKind; message: string; at: string }
  | { type: 'event'; name: EventName; screen?: string; at: string }

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const SCREEN = /^[a-z0-9][a-z0-9/-]{0,39}$/

/** A route's first two path segments, with anything that looks like an id or a number dropped, or undefined when nothing safe is left. */
export function screenName(path: string): string | undefined {
  const parts = path.split(/[?#]/)[0].split('/').filter((p) => p && !/\d/.test(p) && SCREEN.test(p.toLowerCase())).slice(0, 2)
  return parts.length ? parts.join('/').toLowerCase() : undefined
}

export interface Telemetry {
  error(kind: DiagnosticKind, message: unknown): void
  event(name: EventName, screen?: string): void
  queued(): TelemetryItem[]
  /** Sends what is queued (only with consent) and forgets exactly what was accepted; a failed send keeps the queue. Returns how many were sent. */
  flush(send: (items: TelemetryItem[]) => Promise<unknown>): Promise<number>
  /** Forgets everything queued. Called when consent is withdrawn. */
  clear(): void
}

export function createTelemetry(store: Store | null, consent: () => boolean, now: () => Date = () => new Date()): Telemetry {
  const read = (): TelemetryItem[] => {
    try {
      const parsed: unknown = JSON.parse(store?.getItem(TELEMETRY_KEY) ?? '[]')
      return Array.isArray(parsed) ? (parsed as TelemetryItem[]).slice(-MAX_QUEUE) : []
    } catch { return [] }
  }
  const push = (item: TelemetryItem) => {
    if (!store || !consent()) return
    try { store.setItem(TELEMETRY_KEY, JSON.stringify([...read(), item].slice(-MAX_QUEUE))) } catch { /* full or blocked: reporting must never cause a problem */ }
  }
  return {
    error(kind, message) {
      const text = message instanceof Error ? `${message.name}: ${message.message}` : String(message)
      push({ type: 'error', kind, message: scrub(text), at: now().toISOString() })
    },
    event(name, screen) {
      if (!EVENTS.includes(name)) return
      const safe = screen ? screenName(screen) : undefined
      push({ type: 'event', name, ...(safe ? { screen: safe } : {}), at: now().toISOString() })
    },
    queued: () => (consent() ? read() : []),
    async flush(send) {
      if (!consent()) return 0
      const items = read()
      if (items.length === 0) return 0
      try { await send(items) } catch { return 0 }
      // Items queued while the send was in flight stay.
      try { store?.setItem(TELEMETRY_KEY, JSON.stringify(read().slice(items.length))) } catch { /* blocked storage */ }
      return items.length
    },
    clear() { try { store?.removeItem(TELEMETRY_KEY) } catch { /* nothing to clear */ } },
  }
}
