/**
 * The morning brief and evening look-ahead as the server returns them (`/me/stanley/brief`, phase P7, permission row CL-04). The server decides every word and every time; the device reads the agreed
 * shape, keeps only app routes, and renders. Framework-free, so it is tested in node.
 */
export interface BriefSettings { morning: boolean; morningAt: string; evening: boolean; eveningAt: string }
export interface BriefState { settings: BriefSettings; allowed: boolean; nextMorning: number | null; nextEvening: number | null }
export interface BriefLine { text: string; route: string | null }
export interface Brief { kind: 'morning' | 'evening'; date: string; title: string; lines: BriefLine[] }
export type BriefKind = Brief['kind']

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
export const timeOk = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const ms = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The settings and state, or null when it is not the agreed shape. */
export function normalizeBriefState(raw: unknown): BriefState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const s = o.settings && typeof o.settings === 'object' ? (o.settings as Record<string, unknown>) : null
  if (!s || typeof s.morning !== 'boolean' || typeof s.evening !== 'boolean' || !timeOk(s.morningAt) || !timeOk(s.eveningAt)) return null
  return {
    settings: { morning: s.morning, morningAt: s.morningAt, evening: s.evening, eveningAt: s.eveningAt },
    allowed: o.allowed === true, nextMorning: ms(o.nextMorning), nextEvening: ms(o.nextEvening),
  }
}

/** A line's screen is kept only when it is a path inside the app. */
export function normalizeBrief(raw: unknown): Brief | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if ((o.kind !== 'morning' && o.kind !== 'evening') || !Array.isArray(o.lines)) return null
  const title = text(o.title, 80)
  if (!title) return null
  const lines = o.lines.flatMap((l): BriefLine[] => {
    if (!l || typeof l !== 'object') return []
    const r = l as Record<string, unknown>
    const t = text(r.text, 200)
    const route = text(r.route, 120)
    return t ? [{ text: t, route: /^\/[A-Za-z0-9/_-]*$/.test(route) ? route : null }] : []
  }).slice(0, 20)
  return { kind: o.kind, date: text(o.date, 10), title, lines }
}
