/** One line of the guest's own activity report: what they did, what was done for them, and what failed. Comes from the server's audit trail. */
export interface ActivityEvent {
  id: number
  /** Epoch ms. */
  at: number
  category: 'auth' | 'request' | 'domain' | 'error' | 'system'
  action: string
  outcome: 'success' | 'failure' | 'denied' | 'error'
  target: string | null
  status: number | null
  error: string | null
  /** JSON text with the reason or the change, never a secret. */
  detail: string | null
  /** The request id, to quote to Guest Services. */
  requestId: string | null
  byYou: boolean
  forYou: boolean
}

export interface ActivityFilter {
  outcome: 'all' | 'problems'
}

/** What to say about an event: a translation key (under `activity.`), its values, and the plain detail line (if any). */
export interface ActivityLine {
  key: string
  values: Record<string, string>
  note: string | null
}

const VERBS: Record<string, string> = { POST: 'made', PUT: 'changed', PATCH: 'changed', DELETE: 'removed', GET: 'read' }

/** The JSON detail of an event as an object; an empty one when it is missing or not valid. */
export function detailOf(e: ActivityEvent): Record<string, unknown> {
  if (!e.detail) return {}
  try {
    const parsed: unknown = JSON.parse(e.detail)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** The screen path a request action stands for, with the version prefix and ids tidied: "POST /api/v1/bookings/{number}/cancel" gives "bookings / cancel". */
export function readablePath(action: string): string {
  const path = action.replace(/^[A-Z]+\s+/, '').replace(/^\/?api\/v1\//, '').replace(/^\//, '')
  return path.split('/').filter((s) => s && !s.startsWith('{')).join(' / ')
}

/** Picks the wording for an event. Known actions have their own sentence; any other request falls back to a verb and the path. */
export function describeEvent(e: ActivityEvent): ActivityLine {
  const detail = detailOf(e)
  const failed = e.outcome !== 'success'
  if (e.category === 'error') return { key: 'error', values: {}, note: e.requestId }
  if (e.action.startsWith('auth.')) {
    const known = ['login', 'logout', 'register', 'lockout', 'viewAs', 'password.reset', 'refresh.reuse', 'reset.request', 'magic.request', 'reset.redeem', 'magic.redeem']
    const name = e.action.slice(5)
    const which = known.includes(name) ? name : 'other'
    return { key: `auth.${which}${failed ? '.failed' : ''}`, values: {}, note: typeof detail.reason === 'string' ? detail.reason : null }
  }
  if (e.action.startsWith('history.')) return { key: 'change', values: { what: e.action.slice(8), change: typeof detail.change === 'string' ? detail.change : '' }, note: null }
  if (e.action.startsWith('access.')) return { key: 'access', values: { what: e.action.slice(7) }, note: typeof detail.by === 'string' ? detail.by : null }
  const verb = VERBS[e.action.split(' ')[0]] ?? 'made'
  return { key: `request.${verb}${failed ? '.failed' : ''}`, values: { path: readablePath(e.action) }, note: e.target }
}

/** True when the event is a problem the guest may want to look at: something failed, was refused or broke. */
export const isProblem = (e: ActivityEvent): boolean => e.outcome !== 'success'

export function applyFilter(events: readonly ActivityEvent[], f: ActivityFilter): ActivityEvent[] {
  return f.outcome === 'problems' ? events.filter(isProblem) : [...events]
}

/** Newest first, as the report lists them (ties broken by id so the order never flickers). */
export const newestFirst = (events: readonly ActivityEvent[]): ActivityEvent[] => [...events].sort((a, b) => b.at - a.at || b.id - a.id)

/** The events grouped into calendar days (by the given day-of-event function), newest day first, each day's events newest first. */
export function groupByActivityDay(events: readonly ActivityEvent[], dayOf: (at: number) => string): { day: string; events: ActivityEvent[] }[] {
  const days: { day: string; events: ActivityEvent[] }[] = []
  for (const e of newestFirst(events)) {
    const day = dayOf(e.at)
    const last = days[days.length - 1]
    if (last && last.day === day) last.events.push(e)
    else days.push({ day, events: [e] })
  }
  return days
}

/** The id to ask the server for the next older page with, or null when the last page was short (nothing older). */
export function nextCursor(page: readonly ActivityEvent[], pageSize: number): number | null {
  return page.length < pageSize ? null : Math.min(...page.map((e) => e.id))
}
