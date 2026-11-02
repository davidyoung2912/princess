/**
 * Alerts to the phone (next-level plan N3). Framework-free: what this browser can do, how to say so honestly, and the shapes the server and the service worker share.
 * The rules that decide whether to send (budget, calm mode, quiet hours) are on the server; the phone only sends its limits along with its address.
 */
import { isNudgeBudget, type NudgeBudget } from '../domain/nudges'

export const PUSH_KINDS = ['allAboard', 'backAboard', 'scheduleChange', 'disruption', 'payment'] as const
export type PushKind = (typeof PUSH_KINDS)[number]
export type HeldReason = 'channelOff' | 'calm' | 'quiet' | 'budget'
export const HELD_REASONS: readonly HeldReason[] = ['channelOff', 'calm', 'quiet', 'budget']

export interface PushLogEntry {
  key: string
  kind: PushKind
  outcome: 'sent' | 'held'
  reason: HeldReason | null
  /** A safety notice: it skips the budget, calm mode and quiet hours. */
  critical: boolean
  devices: number
  params: Record<string, string | number>
  at: number
  read: boolean
}

export interface PushStatus {
  /** The server can send alerts at all. */
  available: boolean
  /** The key the browser subscribes against; null when the server cannot send. */
  publicKey: string | null
  /** The asking phone is registered. */
  subscribed: boolean
  devices: number
  budget: NudgeBudget
  calm: boolean
  watch: string[]
  unread: number
  log: PushLogEntry[]
}

export interface PushSubscribeInput { endpoint: string; p256dh: string; auth: string; budget: NudgeBudget; calm: boolean; watch: string[] }

/** What the payload the service worker receives looks like. */
export interface PushPayload { id: string; kind: PushKind; title: string; body: string; path: string; critical: boolean }

export const MAX_WATCH = 20

/** What this browser can do about alerts, in the order a guest meets it. */
export type PushSupport =
  | 'unsupported'   // no service worker, push or notifications at all
  | 'needsInstall'  // iPhone or iPad in the browser: works only once the app is on the Home Screen
  | 'denied'        // the guest said no in the browser; only they can undo it there
  | 'ask'           // can ask now
  | 'granted'       // allowed

export interface PushEnvironment {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  permission: 'default' | 'granted' | 'denied' | null
  userAgent: string
  /** Running as an installed app (display-mode standalone, or iOS `navigator.standalone`). */
  standalone: boolean
  maxTouchPoints: number
}

export const isIos = (e: Pick<PushEnvironment, 'userAgent' | 'maxTouchPoints'>): boolean =>
  /iPhone|iPad|iPod/.test(e.userAgent) || (/Macintosh/.test(e.userAgent) && e.maxTouchPoints > 1)

export function pushSupport(e: PushEnvironment): PushSupport {
  // On iOS the push API is hidden until the app is installed, so the missing pieces mean "install first", not "never".
  if (isIos(e) && !e.standalone) return 'needsInstall'
  if (!e.hasServiceWorker || !e.hasPushManager || !e.hasNotification) return 'unsupported'
  if (e.permission === 'denied') return 'denied'
  return e.permission === 'granted' ? 'granted' : 'ask'
}

/** The browser wants the application server key as bytes. */
export function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64Url.length / 4) * 4, '=')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function bytesToKey(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  let s = ''
  for (const b of new Uint8Array(buffer)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The event ids worth a "this changed" alert: clean, unique, and no more than the server keeps. */
export const cleanWatch = (ids: readonly string[]): string[] =>
  [...new Set(ids.filter((i) => /^[A-Za-z0-9_-]{1,40}$/.test(i)))].slice(0, MAX_WATCH)

export function budgetOf(v: unknown): NudgeBudget { return isNudgeBudget(v) ? v : 3 }

/** An entry from untrusted data (the server's log). Anything unrecognised is dropped, never shown half-formed. */
export function normalizeLogEntry(raw: unknown): PushLogEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.key !== 'string' || !(PUSH_KINDS as readonly string[]).includes(o.kind as string)) return null
  if (o.outcome !== 'sent' && o.outcome !== 'held') return null
  const params: Record<string, string | number> = {}
  if (o.params && typeof o.params === 'object') for (const [k, v] of Object.entries(o.params)) if (typeof v === 'string' || typeof v === 'number') params[k] = v
  return {
    key: o.key, kind: o.kind as PushKind, outcome: o.outcome,
    reason: (HELD_REASONS as readonly unknown[]).includes(o.reason) ? (o.reason as HeldReason) : null,
    critical: o.critical === true, devices: typeof o.devices === 'number' ? o.devices : 0, params, at: typeof o.at === 'number' ? o.at : 0, read: o.read === true,
  }
}

/** What to show for the unread count on the app icon: nothing at zero. */
export const badgeCount = (unread: number): number => (Number.isFinite(unread) && unread > 0 ? Math.min(99, Math.floor(unread)) : 0)

/** Whether to check with the server now: a minute apart at most, so coming back to the app does not hammer it. */
export const DISPATCH_EVERY_MS = 60_000
export const shouldDispatch = (lastAt: number | null, now: number): boolean => lastAt === null || now - lastAt >= DISPATCH_EVERY_MS

/** The calendar feed's full address: the server returns a path under its own root, and the API address may be relative (`/api/v1`) or absolute. */
export function feedUrl(apiUrl: string, origin: string, path: string): string {
  const base = /^https?:\/\//i.test(apiUrl) ? apiUrl : `${origin}${apiUrl.startsWith('/') ? '' : '/'}${apiUrl}`
  return `${base.replace(/\/+$/, '')}${path}`
}

/** The same address for calendar apps that ask for `webcal://` (they then keep it up to date). */
export const webcalUrl = (https: string): string => https.replace(/^https?:/i, 'webcal:')
