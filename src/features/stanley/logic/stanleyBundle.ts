/**
 * A bundle and a draft note as the server returns them (`GET /me/stanley/bundle` and `/draft`, phase P4). The server works out every step and word; the device keeps the agreed shape and in-app routes
 * only, and renders. Nothing here books, holds, pays or sends. Framework-free, so it is tested in node.
 */
export const SCOPES = ['evening', 'day'] as const
export const PACES = ['relaxed', 'balanced', 'packed'] as const
export const DRAFT_KINDS = ['party-plan', 'late-note'] as const
export type Scope = (typeof SCOPES)[number]
export type Pace = (typeof PACES)[number]
export type DraftKind = (typeof DRAFT_KINDS)[number]

export interface BundleStep { id: string; start: string; minutes: number; kind: string; title: string; status: 'booked' | 'suggested'; why: string; route: string }
export interface Bundle { hasPlan: boolean; scope: Scope; pace: Pace; day: number; port: string | null; backBy: string | null; steps: BundleStep[]; clashes: string[]; notChecked: string[] }
export interface DraftNote { kind: DraftKind; text: string; inputs: string[] }

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const strings = (v: unknown, n: number, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, n).map((x) => x.slice(0, max)) : [])
const inApp = (r: string) => /^\/[A-Za-z0-9/_-]*$/.test(r) && !r.startsWith('//')

function step(raw: unknown): BundleStep | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = str(o.id, 120), title = str(o.title, 160), route = str(o.route, 120), start = str(o.start, 5)
  if (!id || !title || !inApp(route) || !/^\d\d:\d\d$/.test(start)) return null
  return { id, start, minutes: typeof o.minutes === 'number' && o.minutes > 0 ? Math.min(Math.round(o.minutes), 1440) : 0, kind: str(o.kind, 20), title, status: o.status === 'booked' ? 'booked' : 'suggested', why: str(o.why, 200), route }
}

/** The bundle, or null when it is not the agreed shape. The server's time order is kept. */
export function normalizeBundle(raw: unknown): Bundle | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.hasPlan !== 'boolean' || !SCOPES.includes(o.scope as Scope) || !PACES.includes(o.pace as Pace)) return null
  const steps = Array.isArray(o.steps) ? o.steps.flatMap((x) => { const s = step(x); return s ? [s] : [] }).slice(0, 12) : []
  return {
    hasPlan: o.hasPlan && steps.length > 0, scope: o.scope as Scope, pace: o.pace as Pace, day: typeof o.day === 'number' ? o.day : 0, port: str(o.port, 60) || null,
    backBy: /^\d\d:\d\d$/.test(str(o.backBy, 5)) ? str(o.backBy, 5) : null, steps, clashes: strings(o.clashes, 10, 200), notChecked: strings(o.notChecked, 10, 160),
  }
}

/** The draft, or null (no plan, or not the agreed shape). */
export function normalizeDraft(raw: unknown): DraftNote | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!DRAFT_KINDS.includes(o.kind as DraftKind)) return null
  const text = str(o.text, 1000)
  return text ? { kind: o.kind as DraftKind, text, inputs: strings(o.inputs, 6, 80) } : null
}

/** "18:30" as "6:30 pm", for reading. */
export function clock12(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2)), m = hhmm.slice(3, 5)
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`
}
