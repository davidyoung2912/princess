/**
 * The trip check-up as the server returns it (`GET /me/stanley/checkup`, phase P3): ranked findings from the trip (CHK-01) and the plan (CHK-02), the deadline radar (CHK-08) and what could not be checked.
 * The server works out every word; the device reads the agreed shape, keeps only app routes as fixes, and renders. Framework-free, so it is tested in node.
 */
export type CheckConsequence = 'safety' | 'lostReservation' | 'conflict' | 'improvement' | 'optional'

export interface CheckFix { label: string; route: string }
export interface CheckFinding { id: string; rule: string; consequence: CheckConsequence; title: string; detail: string; day: number | null; due: string | null; fix: CheckFix }
export interface CheckDeadline { id: string; consequence: CheckConsequence; title: string; date: string; daysLeft: number; fix: CheckFix }
export interface Checkup { hasTrip: boolean; findings: CheckFinding[]; deadlines: CheckDeadline[]; notChecked: string[]; clean: boolean; asOf: string | null }

const CONSEQUENCES: readonly CheckConsequence[] = ['safety', 'lostReservation', 'conflict', 'improvement', 'optional']
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** A fix is only ever a path inside the app: anything else (a link away, a script) is dropped, and so is its finding's button. */
export function normalizeFix(raw: unknown): CheckFix | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const route = text(o.route, 120)
  const label = text(o.label, 60)
  return label && /^\/[A-Za-z0-9/_-]*$/.test(route) ? { label, route } : null
}

const consequence = (v: unknown): CheckConsequence => CONSEQUENCES.find((c) => c === v) ?? 'optional'

export function normalizeFinding(raw: unknown): CheckFinding | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const fix = normalizeFix(o.fix)
  const id = text(o.id, 120)
  const title = text(o.title, 160)
  if (!id || !title || !fix) return null
  return { id, rule: text(o.rule, 10), consequence: consequence(o.consequence), title, detail: text(o.detail, 400), day: typeof o.day === 'number' && Number.isInteger(o.day) ? o.day : null, due: text(o.due, 10) || null, fix }
}

export function normalizeDeadline(raw: unknown): CheckDeadline | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const fix = normalizeFix(o.fix)
  const id = text(o.id, 80)
  const title = text(o.title, 120)
  const date = text(o.date, 10)
  if (!id || !title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof o.daysLeft !== 'number' || !Number.isFinite(o.daysLeft) || !fix) return null
  return { id, consequence: consequence(o.consequence), title, date, daysLeft: Math.round(o.daysLeft), fix }
}

/** The answer, or null when it is not the agreed shape. The server's order (most serious first) is kept. */
export function normalizeCheckup(raw: unknown): Checkup | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.hasTrip !== 'boolean') return null
  const list = <T,>(v: unknown, read: (x: unknown) => T | null, max: number): T[] => (Array.isArray(v) ? v.flatMap((x) => { const r = read(x); return r ? [r] : [] }).slice(0, max) : [])
  const findings = list(o.findings, normalizeFinding, 40)
  return {
    hasTrip: o.hasTrip, findings, deadlines: list(o.deadlines, normalizeDeadline, 20),
    notChecked: Array.isArray(o.notChecked) ? o.notChecked.filter((x): x is string => typeof x === 'string').slice(0, 10).map((x) => x.slice(0, 160)) : [],
    clean: o.clean === true && findings.length === 0, asOf: text(o.asOf, 30) || null,
  }
}

/** How a deadline reads: "Overdue", "Today", "Tomorrow", "In 12 days". */
export function whenText(daysLeft: number): { key: 'overdue' | 'today' | 'tomorrow' | 'days'; count: number } {
  if (daysLeft < 0) return { key: 'overdue', count: -daysLeft }
  if (daysLeft === 0) return { key: 'today', count: 0 }
  return daysLeft === 1 ? { key: 'tomorrow', count: 1 } : { key: 'days', count: daysLeft }
}

/** Findings that cost money or access (lost reservation or worse) come first and are called out. */
export const isUrgent = (f: { consequence: CheckConsequence }): boolean => f.consequence === 'safety' || f.consequence === 'lostReservation'
