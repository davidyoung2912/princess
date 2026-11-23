/**
 * Guardian copies, as the server returns them (`POST /me/stanley/group/guardian`, phase P11). A child's all-aboard time becomes a reminder on the guardian's own list, labelled with the child's first name; the child is sent nothing.
 * The server works out every word; the device keeps the agreed shape and renders. Framework-free, so it is tested in node.
 */
export interface GuardianCopy { key: string; child: string; text: string; dueAt: string }
export interface GuardianCopies { hasChildren: boolean; children: string[]; made: GuardianCopy[]; waiting: string[]; notChecked: string[]; asOf: string | null }

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const list = (v: unknown, count: number, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, count).map((x) => x.slice(0, max)) : [])

/** The result, or null when it is not the agreed shape. */
export function normalizeGuardianCopies(raw: unknown): GuardianCopies | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.hasChildren !== 'boolean') return null
  const made = (Array.isArray(o.made) ? o.made : []).slice(0, 30).flatMap((m): GuardianCopy[] => {
    if (!m || typeof m !== 'object') return []
    const x = m as Record<string, unknown>
    const key = str(x.key, 80), text = str(x.text, 160), dueAt = str(x.dueAt, 40)
    return key && text && !Number.isNaN(Date.parse(dueAt)) ? [{ key, child: str(x.child, 40), text, dueAt }] : []
  })
  return { hasChildren: o.hasChildren, children: list(o.children, 10, 40), made, waiting: list(o.waiting, 30, 200), notChecked: list(o.notChecked, 10, 300), asOf: str(o.asOf, 30) || null }
}

/** The guest's choice to let a helper be sent copies (`GET` and `PUT /me/stanley/group/helper-copies`, REM-D04). */
export interface HelperCopies { on: boolean; since: string | null; notChecked: string[] }

export function normalizeHelperCopies(raw: unknown): HelperCopies | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.on !== 'boolean') return null
  return { on: o.on, since: str(o.since, 30) || null, notChecked: list(o.notChecked, 10, 300) }
}

/** What a failed meeting reminder was, from the server's code. */
export type MeetingProblem = 'already' | 'past' | 'time' | 'notGoing' | 'tooMany' | 'other'
export function meetingProblem(code: string): MeetingProblem {
  return code === 'already' || code === 'past' || code === 'time' || code === 'notGoing' || code === 'tooMany' ? code : 'other'
}
