import { isRecord } from '../feeds/feed'

/**
 * What Stanley did, is watching and remembers, as the server serves it (`GET /me/stanley/ledger`). Each receipt has the six fields of section 19.1 of the plan, in the server's words; the app holds no wording of its own for them.
 * Read defensively: anything not in the agreed shape is dropped.
 */
export type ReceiptStatus = 'done' | 'failed' | 'pending' | 'undone'
export interface StanleyReceipt {
  id: string
  number: string
  kind: string
  status: ReceiptStatus
  at: number
  what: string
  why: string
  facts: string
  affects: string
  undo: string
  undoUntil: number | null
  canUndo: boolean
  stop: string
}
export interface StanleyWatch { id: string; wording: string; example: string; never: string }
export interface StanleyRemembered { enabled: boolean; count: number; items: { id: string; text: string; reason: string }[] }
export interface StanleyActivity { paused: boolean; undoableNow: number; did: StanleyReceipt[]; watching: StanleyWatch[]; remembers: StanleyRemembered }

const STATUSES: readonly string[] = ['done', 'failed', 'pending', 'undone']
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() && v.length <= max ? v : null)
const time = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(n) ? n : null
}

function receipt(raw: unknown): StanleyReceipt[] {
  if (!isRecord(raw)) return []
  const id = str(raw.id, 64), number = str(raw.number, 20), kind = str(raw.kind, 30), what = str(raw.what, 200), why = str(raw.why, 300)
  const facts = str(raw.facts, 300), affects = str(raw.affects, 300), undo = str(raw.undo, 300), stop = str(raw.stop, 400), at = time(raw.at)
  if (!id || !number || !kind || !what || !why || !facts || !affects || !undo || !stop || at === null || typeof raw.status !== 'string' || !STATUSES.includes(raw.status)) return []
  return [{ id, number, kind, status: raw.status as ReceiptStatus, at, what, why, facts, affects, undo, undoUntil: time(raw.undoUntil), canUndo: raw.canUndo === true, stop }]
}

export function normalizeActivity(raw: unknown): StanleyActivity | null {
  if (!isRecord(raw) || !Array.isArray(raw.did) || !Array.isArray(raw.watching) || !isRecord(raw.remembers)) return null
  const watching = raw.watching.flatMap((w): StanleyWatch[] => {
    if (!isRecord(w)) return []
    const id = str(w.id, 12), wording = str(w.wording, 200), example = str(w.example, 300), never = str(w.never, 300)
    return id && wording && example && never ? [{ id, wording, example, never }] : []
  })
  const items = Array.isArray(raw.remembers.items)
    ? raw.remembers.items.flatMap((i): { id: string; text: string; reason: string }[] => {
        if (!isRecord(i)) return []
        const id = str(i.id, 64), text = str(i.text, 160)
        return id && text ? [{ id, text, reason: typeof i.reason === 'string' ? i.reason.slice(0, 160) : '' }] : []
      })
    : []
  const did = raw.did.flatMap(receipt).slice(0, 50)
  return {
    paused: raw.paused === true,
    undoableNow: did.filter((d) => d.canUndo).length,
    did, watching,
    remembers: { enabled: raw.remembers.enabled !== false, count: typeof raw.remembers.count === 'number' ? raw.remembers.count : items.length, items },
  }
}

/** The receipt for the thing Stanley did last, which is what "Why did you do that?" opens. */
export const lastReceipt = (a: StanleyActivity): StanleyReceipt | null => a.did.find((d) => d.status === 'done' || d.status === 'undone') ?? null

/** Whether the undo window of a receipt is still open on this device's clock, so a stale screen stops offering Undo (the server still decides). */
export const undoOpen = (r: StanleyReceipt, now: number): boolean => r.canUndo && (r.undoUntil === null || now <= r.undoUntil)
