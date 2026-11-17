/**
 * Stanley's trip so far and level suggestions as the server returns them (`GET /me/stanley/trip-so-far`, phase P9a). The server works out every word and count; the device keeps the agreed shape and in-app routes only.
 * A suggestion is a sentence and a screen to open: nothing here changes a level or switches anything on. Framework-free, so it is tested in node.
 */
export interface LevelSuggestion { id: string; direction: 'more' | 'ask-first'; text: string; route: string }
export interface TripSoFar { enabled: boolean; done: number; confirmed: number; undone: number; suggestions: LevelSuggestion[]; notMeasured: string[]; asOf: string | null }

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), 100000) : 0)

function suggestion(raw: unknown): LevelSuggestion | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = str(o.id, 80), text = str(o.text, 300), route = str(o.route, 120)
  const direction = o.direction === 'more' || o.direction === 'ask-first' ? o.direction : null
  if (!id || !text || !direction || !/^\/[A-Za-z0-9/_-]*$/.test(route) || route.startsWith('//')) return null
  return { id, direction, text, route }
}

/** The result, or null when it is not the agreed shape. */
export function normalizeTripSoFar(raw: unknown): TripSoFar | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.enabled !== 'boolean') return null
  return {
    enabled: o.enabled, done: count(o.done), confirmed: count(o.confirmed), undone: count(o.undone),
    suggestions: (Array.isArray(o.suggestions) ? o.suggestions.flatMap((x) => { const s = suggestion(x); return s ? [s] : [] }) : []).slice(0, 10),
    notMeasured: Array.isArray(o.notMeasured) ? o.notMeasured.filter((x): x is string => typeof x === 'string').slice(0, 6).map((x) => x.slice(0, 200)) : [],
    asOf: str(o.asOf, 30) || null,
  }
}
