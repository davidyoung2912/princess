/**
 * The Remember pack as the server returns it (`GET /me/stanley/remember`, phase P9f): recap, feedback and loyalty. The server works out every word; the device keeps the agreed
 * shape and in-app routes only, and renders. Nothing here fills in or sends anything. Framework-free, so it is tested in node.
 */
export interface RememberFinding { id: string; rule: string; title: string; detail: string; route: string }
export interface Remember { hasTrip: boolean; findings: RememberFinding[]; notChecked: string[]; asOf: string | null }

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

function finding(raw: unknown): RememberFinding | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = str(o.id, 160), title = str(o.title, 160), detail = str(o.detail, 400), route = str(o.route, 120), rule = str(o.rule, 20)
  if (!id || !title || !/^\/[A-Za-z0-9/_-]*$/.test(route) || route.startsWith('//')) return null
  return { id, rule, title, detail, route }
}

/** The result, or null when it is not the agreed shape. The server's order is kept. */
export function normalizeRemember(raw: unknown): Remember | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.hasTrip !== 'boolean') return null
  return {
    hasTrip: o.hasTrip,
    findings: (Array.isArray(o.findings) ? o.findings.flatMap((x) => { const f = finding(x); return f ? [f] : [] }) : []).slice(0, 20),
    notChecked: Array.isArray(o.notChecked) ? o.notChecked.filter((x): x is string => typeof x === 'string').slice(0, 10).map((x) => x.slice(0, 200)) : [],
    asOf: str(o.asOf, 30) || null,
  }
}
