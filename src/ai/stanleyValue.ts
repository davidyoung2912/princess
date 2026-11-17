import { isUrgent, normalizeFinding, type CheckFinding } from './stanleyCheckup'

/**
 * Value and bill as the server returns it (`GET /me/stanley/value`, phase P6): bill watch (CHK-04), what the guest already has and has not used (VAL-01) and a packing nudge (CHK-05).
 * The server works out every word; the device keeps the agreed shape and in-app routes only, and renders. Framework-free, so it is tested in node.
 */
export type ValueFinding = CheckFinding
export interface ValueResult { hasTrip: boolean; findings: ValueFinding[]; notChecked: string[]; clean: boolean; asOf: string | null }

export const RULE_GROUPS = ['CHK-04', 'VAL-01', 'CHK-05'] as const
export type RuleGroup = (typeof RULE_GROUPS)[number]

/** The answer, or null when it is not the agreed shape. The server's order (most serious first) is kept. */
export function normalizeValue(raw: unknown): ValueResult | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.hasTrip !== 'boolean') return null
  const findings = Array.isArray(o.findings) ? o.findings.flatMap((x) => { const f = normalizeFinding(x); return f ? [f] : [] }).slice(0, 40) : []
  return {
    hasTrip: o.hasTrip, findings,
    notChecked: Array.isArray(o.notChecked) ? o.notChecked.filter((x): x is string => typeof x === 'string').slice(0, 10).map((x) => x.slice(0, 160)) : [],
    clean: o.clean === true && findings.length === 0,
    asOf: typeof o.asOf === 'string' ? o.asOf.slice(0, 30) || null : null,
  }
}

/** Findings for one rule, in the server's order. */
export const forRule = (findings: readonly ValueFinding[], rule: RuleGroup): ValueFinding[] => findings.filter((f) => f.rule === rule)

export { isUrgent }
