/**
 * AUT-02, deadline reminders, as the server returns it (`POST /me/stanley/auto/deadlines`, phase P10a). The server decides whether anything may be set and works out every word; the device keeps the agreed
 * shape and renders. Framework-free, so it is tested in node.
 */
export interface AutoMade { key: string; text: string; dueAt: string; receipt: string }
export interface AutoRun { on: boolean; made: AutoMade[]; waiting: string[]; notChecked: string[]; asOf: string | null }

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const list = (v: unknown, count: number, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, count).map((x) => x.slice(0, max)) : [])

function made(raw: unknown): AutoMade | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const key = str(o.key, 64), text = str(o.text, 120), dueAt = str(o.dueAt, 40), receipt = str(o.receipt, 20)
  return key && text && !Number.isNaN(Date.parse(dueAt)) ? { key, text, dueAt, receipt } : null
}

/** The result, or null when it is not the agreed shape. */
export function normalizeAutoRun(raw: unknown): AutoRun | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.on !== 'boolean') return null
  return {
    on: o.on,
    made: (Array.isArray(o.made) ? o.made.flatMap((x) => { const m = made(x); return m ? [m] : [] }) : []).slice(0, 30),
    waiting: list(o.waiting, 30, 200),
    notChecked: list(o.notChecked, 10, 200),
    asOf: str(o.asOf, 30) || null,
  }
}

/** AUT-05, lists kept current (`POST /me/stanley/auto/lists`): what the packing suggestions added or dropped since the last run. */
export interface AutoListChange { list: string; added: string[]; removed: string[] }
export interface AutoLists { on: boolean; firstLook: boolean; changes: AutoListChange[]; notChecked: string[]; asOf: string | null }

export function normalizeAutoLists(raw: unknown): AutoLists | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.on !== 'boolean') return null
  const changes = (Array.isArray(o.changes) ? o.changes : []).slice(0, 5).flatMap((c): AutoListChange[] => {
    if (!c || typeof c !== 'object') return []
    const x = c as Record<string, unknown>
    const name = str(x.list, 30)
    return name ? [{ list: name, added: list(x.added, 60, 120), removed: list(x.removed, 60, 120) }] : []
  })
  return { on: o.on, firstLook: o.firstLook === true, changes, notChecked: list(o.notChecked, 10, 200), asOf: str(o.asOf, 30) || null }
}

/** AUT-03, my plan topped up (`POST` and `GET /me/stanley/auto/plan`): the free things Stanley added to the guest's own plan. */
export interface AutoPick { id: string; day: number; title: string; start: string; minutes: number; place: string }
export interface AutoPlan { on: boolean; picks: AutoPick[]; added: string[]; removed: string[]; notChecked: string[]; asOf: string | null }

export function normalizeAutoPlan(raw: unknown): AutoPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.on !== 'boolean') return null
  const picks = (Array.isArray(o.picks) ? o.picks : []).slice(0, 80).flatMap((p): AutoPick[] => {
    if (!p || typeof p !== 'object') return []
    const x = p as Record<string, unknown>
    const id = str(x.id, 64), title = str(x.title, 120), start = str(x.start, 5)
    return id && title && /^\d\d:\d\d$/.test(start) && typeof x.day === 'number' && Number.isInteger(x.day) && x.day >= 1
      ? [{ id, day: x.day, title, start, minutes: typeof x.minutes === 'number' ? Math.max(0, Math.min(1440, Math.round(x.minutes))) : 0, place: str(x.place, 40) }]
      : []
  })
  return { on: o.on, picks, added: list(o.added, 40, 160), removed: list(o.removed, 40, 160), notChecked: list(o.notChecked, 10, 300), asOf: str(o.asOf, 30) || null }
}

/** AUT-06, drafts saved (`POST` and `GET /me/stanley/auto/drafts`): notes kept for the guest to read, change and send themselves. */
export interface AutoDraft { kind: 'party-plan' | 'late-note'; text: string; savedAt: string }
export interface AutoDrafts { on: boolean; drafts: AutoDraft[]; saved: string[]; notChecked: string[]; asOf: string | null }

export function normalizeAutoDrafts(raw: unknown): AutoDrafts | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.on !== 'boolean') return null
  const drafts = (Array.isArray(o.drafts) ? o.drafts : []).slice(0, 4).flatMap((d): AutoDraft[] => {
    if (!d || typeof d !== 'object') return []
    const x = d as Record<string, unknown>
    const text = str(x.text, 1000)
    return (x.kind === 'party-plan' || x.kind === 'late-note') && text ? [{ kind: x.kind, text, savedAt: str(x.savedAt, 30) }] : []
  })
  return { on: o.on, drafts, saved: list(o.saved, 4, 120), notChecked: list(o.notChecked, 10, 300), asOf: str(o.asOf, 30) || null }
}

/** AUT-04, AUT-08 and AUT-09 (`POST /me/stanley/auto/dinners`, `timings`, `orders`): what Stanley booked, moved or sent, each with a receipt that can be undone for two hours. */
export interface AutoAct { key: string; text: string; receipt: string }
export interface AutoActs { on: boolean; made: AutoAct[]; waiting: string[]; notChecked: string[]; asOf: string | null }

export function normalizeAutoActs(raw: unknown): AutoActs | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.on !== 'boolean') return null
  const made = (Array.isArray(o.made) ? o.made : []).slice(0, 10).flatMap((m): AutoAct[] => {
    if (!m || typeof m !== 'object') return []
    const x = m as Record<string, unknown>
    const key = str(x.key, 80), text = str(x.text, 160)
    return key && text ? [{ key, text, receipt: str(x.receipt, 20) }] : []
  })
  return { on: o.on, made, waiting: list(o.waiting, 20, 240), notChecked: list(o.notChecked, 10, 400), asOf: str(o.asOf, 30) || null }
}

/** The guest's usual main-dining time and standing stateroom order (`GET` and `PUT /me/stanley/auto/standing`). */
export interface AutoStanding { usualDinner: string; orderItem: string; orderTime: string; dinnerTimes: string[]; orderItems: string[]; notChecked: string[] }

export function normalizeAutoStanding(raw: unknown): AutoStanding | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.usualDinner !== 'string' || typeof o.orderItem !== 'string') return null
  const clock = /^\d\d:\d\d$/
  const time = str(o.orderTime, 5)
  return {
    usualDinner: clock.test(o.usualDinner) ? o.usualDinner : '',
    orderItem: ['ice', 'towels', 'pillows'].includes(o.orderItem) ? o.orderItem : '',
    orderTime: clock.test(time) ? time : '',
    dinnerTimes: list(o.dinnerTimes, 12, 5).filter((x) => clock.test(x)),
    orderItems: list(o.orderItems, 3, 20).filter((x) => ['ice', 'towels', 'pillows'].includes(x)),
    notChecked: list(o.notChecked, 10, 400),
  }
}
