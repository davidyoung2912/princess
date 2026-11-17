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
