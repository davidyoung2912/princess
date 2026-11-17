/**
 * The trip checklist as the server returns it (`GET /me/stanley/checklist`, phase P5): what is outstanding per traveller, a screen for each, and a remembered preference shown as a default with its source.
 * The server works out every word; the device keeps the agreed shape and in-app routes only, and renders. Nothing here applies a default. Framework-free, so it is tested in node.
 */
export interface ChecklistDefault { label: string; source: string }
export interface ChecklistItem { id: string; traveller: number; kind: string; title: string; route: string; default: ChecklistDefault | null }
export interface Checklist { hasTrip: boolean; items: ChecklistItem[]; done: number; total: number; complete: boolean; notChecked: string[]; asOf: string | null }

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const count = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(v, 1000) : 0)

function item(raw: unknown): ChecklistItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = str(o.id, 80), title = str(o.title, 160), route = str(o.route, 120)
  if (!id || !title || !/^\/[A-Za-z0-9/_-]*$/.test(route) || route.startsWith('//')) return null
  const d = o.default && typeof o.default === 'object' ? (o.default as Record<string, unknown>) : null
  const label = d ? str(d.label, 120) : '', source = d ? str(d.source, 160) : ''
  return { id, traveller: count(o.traveller), kind: str(o.kind, 20), title, route, default: label && source ? { label, source } : null }
}

/** The checklist, or null when it is not the agreed shape. The server's order is kept. */
export function normalizeChecklist(raw: unknown): Checklist | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.hasTrip !== 'boolean') return null
  const items = Array.isArray(o.items) ? o.items.flatMap((x) => { const i = item(x); return i ? [i] : [] }).slice(0, 60) : []
  const total = count(o.total)
  return {
    hasTrip: o.hasTrip, items, done: Math.min(count(o.done), total), total, complete: o.complete === true && items.length === 0,
    notChecked: Array.isArray(o.notChecked) ? o.notChecked.filter((x): x is string => typeof x === 'string').slice(0, 10).map((x) => x.slice(0, 160)) : [],
    asOf: str(o.asOf, 30) || null,
  }
}
