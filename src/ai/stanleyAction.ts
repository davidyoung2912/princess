import { UNDO_ASSISTANT_MIN, isHhmm, type Change, type PlanEntry, type PlanRow } from '../domain/planChange'

/**
 * Stanley's actions, as the server prepares and confirms them (docs/stanley-gap-analysis-and-plan.md, phase 5). The server turns a request into a typed intent and a stored preview;
 * the device only shows it, sends the guest's Confirm with an idempotency key, and shows the receipt. A day-plan change and a reminder are applied here, from the confirmed receipt, because
 * those live on the device. Framework-free, so it is tested in node.
 */
export type ActionKind = 'order_item' | 'add_excursion' | 'move_dinner' | 'draft_case' | 'plan_change' | 'remind_me'
export type ActionStatus = 'prepared' | 'executing' | 'done' | 'failed' | 'pending' | 'expired' | 'changed' | 'undone'

const KINDS: readonly ActionKind[] = ['order_item', 'add_excursion', 'move_dinner', 'draft_case', 'plan_change', 'remind_me']
const STATUSES: readonly ActionStatus[] = ['prepared', 'executing', 'done', 'failed', 'pending', 'expired', 'changed', 'undone']

/** A preview and, once confirmed, its receipt. Nothing has happened while `status` is `prepared`. */
export interface StanleyAction {
  id: string
  kind: ActionKind
  status: ActionStatus
  title: string
  /** The exact items and what happens, one line each. */
  lines: string[]
  /** Who is affected. */
  who: string[]
  /** The price, in cents, when there is one. */
  cents: number | null
  /** Cancellation terms and what is and is not charged. */
  terms: string | null
  expiresAt: number
  /** The device, not the server, makes the change. */
  onDevice: boolean
  doneAt: number | null
  undoUntil: number | null
  /** Why it failed, as the service's code (full, duplicate, overlap...). */
  reason: string | null
  params: Record<string, string>
  /** A short number to quote, once it is done. */
  receipt: string | null
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const time = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(n) ? n : null
}

/** Reads the server's action; anything that is not the agreed shape gives null. */
export function normalizeAction(raw: unknown): StanleyAction | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kind = KINDS.find((k) => k === o.kind)
  const status = STATUSES.find((s) => s === o.status)
  const expiresAt = time(o.expiresAt)
  if (typeof o.id !== 'string' || !o.id || !kind || !status || expiresAt === null) return null
  const strings = (v: unknown, n: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, n).map((x) => x.slice(0, 400)) : [])
  const params: Record<string, string> = {}
  if (o.params && typeof o.params === 'object') for (const [k, v] of Object.entries(o.params as Record<string, unknown>).slice(0, 20)) if (typeof v === 'string') params[k.slice(0, 40)] = v.slice(0, 400)
  const title = text(o.title, 200)
  if (!title) return null
  return {
    id: o.id.slice(0, 64), kind, status, title, lines: strings(o.lines, 12), who: strings(o.who, 10),
    cents: typeof o.cents === 'number' && Number.isFinite(o.cents) ? Math.round(o.cents) : null,
    terms: text(o.terms, 400) || null, expiresAt, onDevice: o.onDevice === true, doneAt: time(o.doneAt), undoUntil: time(o.undoUntil),
    reason: text(o.reason, 40) || null, params, receipt: text(o.receipt, 20) || null,
  }
}

/** The receipts list (`GET /me/stanley/receipts`): every action the server could read, newest first. */
export const normalizeReceipts = (raw: unknown): StanleyAction[] => (Array.isArray(raw) ? raw.flatMap((r) => { const a = normalizeAction(r); return a ? [a] : [] }).slice(0, 50) : [])

/** What is sent with a request so the server can name a plan item or a reminder's all-aboard time: today's plan as listed and on offer, and the all-aboard moment. */
export interface ActionPlanEntry { id: string; title: string; start: string; day: number; listed: boolean }
export interface ActionContext { plan?: ActionPlanEntry[]; allAboard?: { at: string; label: string }; sailingId?: string }

/** The day plan for the server: what is in it now (not dropped), and what could be added. Titles and times only. */
export function planSnapshot(rows: readonly PlanRow[], alternatives: readonly PlanEntry[], day: number): ActionPlanEntry[] {
  const listed = rows.filter((r) => r.state !== 'dropped').map((r) => ({ id: r.entry.id, title: r.entry.title, start: r.entry.start, day, listed: true }))
  const offered = alternatives.map((a) => ({ id: a.id, title: a.title, start: a.start, day, listed: false }))
  return [...listed, ...offered].slice(0, 60)
}

/** An instant as "HH:MM" on the clock of a time zone (the ship's, say), for the server to name in a preview. */
export function clockHhmm(at: number, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }).formatToParts(new Date(at))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('hour')}:${get('minute')}`
}

/** A key for one Confirm press: the same key and preview always give the same receipt, so a double tap or a retry is safe. */
export function newKey(random: () => number = Math.random, now: () => number = Date.now): string {
  return `k${now().toString(36)}${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`
}

/** The error codes a confirm can give, as the words to show (the server's English is not shown). */
export type ConfirmProblem = 'expired' | 'changed' | 'off' | 'forbidden' | 'tooLate' | 'other'
export function problemOf(code: unknown): ConfirmProblem {
  return code === 'expired' || code === 'changed' || code === 'off' || code === 'forbidden' || code === 'tooLate' ? code : 'other'
}

/** Whether a preview can still be confirmed at this moment. A prepared one past its expiry is asked for again. */
export const canConfirm = (a: StanleyAction, now: number): boolean => a.status === 'prepared' && now <= a.expiresAt
/** Whether a done action can still be undone. */
export const canUndo = (a: StanleyAction, now: number): boolean => a.status === 'done' && a.undoUntil !== null && now < a.undoUntil

/** The id a plan change made from an action carries, so the same action is never applied twice and its undo can find it. */
export const changeIdFor = (a: StanleyAction): string => `stanley:${a.id}`

/** A confirmed day-plan action as a change in the plan's own change log, or null when it names something the plan no longer has. It is accepted at once because the guest has just confirmed it. */
export function changeForAction(a: StanleyAction, rows: readonly PlanRow[], alternatives: readonly PlanEntry[], now: number): Change | null {
  if (a.kind !== 'plan_change') return null
  const op = a.params.op
  const id = a.params.itemId
  const day = Number(a.params.day)
  if (!id || !Number.isInteger(day) || day < 1) return null
  const base = { id: changeIdFor(a), day, source: 'assistant' as const, cause: 'You asked', title: a.title, why: a.lines[0] ?? '', status: 'proposed' as const, proposedAt: now, undoUntil: now + UNDO_ASSISTANT_MIN * 60_000 }
  const there = rows.find((r) => r.entry.id === id && r.state !== 'dropped')
  if (op === 'move') return there && isHhmm(a.params.to) ? { ...base, edits: [{ op: 'move', id, to: a.params.to }] } : null
  if (op === 'drop') return there ? { ...base, edits: [{ op: 'drop', id }] } : null
  const offered = alternatives.find((e) => e.id === id)
  return op === 'add' && offered ? { ...base, edits: [{ op: 'add', entry: { ...offered, kind: 'added' } }] } : null
}

/** A confirmed reminder, as the device keeps it: when it is due (epoch ms) and what it says. */
export interface CustomReminder { id: string; at: number; text: string }

/** The reminder a confirmed `remind_me` action asks for. `dueAt` is the epoch time of its HH:MM on the guest's day, worked out by the caller in the ship's zone. */
export function reminderForAction(a: StanleyAction, dueAt: number | null): CustomReminder | null {
  if (a.kind !== 'remind_me' || dueAt === null || !isHhmm(a.params.at)) return null
  return { id: a.id, at: dueAt, text: (a.params.text || 'Reminder').slice(0, 80) }
}
