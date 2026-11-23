import type { GuideTask, GuideView } from '../../../shared/api/guideTypes'

/**
 * What the guest has put aside in their plan: tasks that are "not for me" (kept hidden, and brought back from Me) and tasks to do "later" (back on a day).
 * One small document on the server (`guideChoices`), so a choice follows the guest across devices. A task with a real deadline (`hard`) can be put off, never hidden.
 * Framework-free so it is tested in node.
 */
export interface GuideChoices {
  skipped: Record<string, number>
  later: Record<string, string>
}

export const EMPTY_CHOICES: GuideChoices = { skipped: {}, later: {} }

/** Mirrors the server's limits (StateRules.GuideChoicesMaxEntries and GuideChoicesMaxId). */
export const MAX_CHOICES = 60
const MAX_ID = 40
const ID = /^[A-Za-z0-9.]+$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

const idOk = (id: string): boolean => id.length > 0 && id.length <= MAX_ID && ID.test(id)

function limit<T>(rows: Record<string, T>, order: (v: T) => number | string): Record<string, T> {
  const entries = Object.entries(rows)
  if (entries.length <= MAX_CHOICES) return rows
  return Object.fromEntries(entries.sort((a, b) => (order(a[1]) < order(b[1]) ? 1 : -1)).slice(0, MAX_CHOICES))
}

const isEmpty = (c: GuideChoices): boolean => Object.keys(c.skipped).length === 0 && Object.keys(c.later).length === 0

/** Reads a stored or server document safely: odd ids, non-numbers and bad days are dropped. */
export function normalizeChoices(raw: unknown): GuideChoices {
  const o = raw && typeof raw === 'object' ? (raw as { skipped?: unknown; later?: unknown }) : {}
  const skipped: Record<string, number> = {}
  const later: Record<string, string> = {}
  if (o.skipped && typeof o.skipped === 'object') for (const [id, at] of Object.entries(o.skipped)) if (idOk(id) && typeof at === 'number' && Number.isFinite(at)) skipped[id] = at
  if (o.later && typeof o.later === 'object') for (const [id, day] of Object.entries(o.later)) if (idOk(id) && typeof day === 'string' && DAY.test(day)) later[id] = day
  const out = { skipped: limit(skipped, (v) => v), later: limit(later, (v) => v) }
  return isEmpty(out) ? EMPTY_CHOICES : out
}

/** Both devices made choices: keep every skip; for a task put off on both, the later day wins; a skip beats a later. */
export function mergeChoices(remote: unknown, local: unknown): GuideChoices {
  const a = normalizeChoices(remote)
  const b = normalizeChoices(local)
  const skipped = { ...a.skipped, ...b.skipped }
  const later: Record<string, string> = { ...a.later }
  for (const [id, day] of Object.entries(b.later)) later[id] = id in later && later[id]! > day ? later[id]! : day
  for (const id of Object.keys(skipped)) delete later[id]
  const out = normalizeChoices({ skipped, later })
  return out
}

/** "Not for me". Ignored for a task with a real deadline. */
export function skipTask(c: GuideChoices, task: Pick<GuideTask, 'id' | 'hard'>, now: number): GuideChoices {
  if (task.hard || !idOk(task.id) || task.id in c.skipped) return c
  const later = { ...c.later }
  delete later[task.id]
  return normalizeChoices({ skipped: { ...c.skipped, [task.id]: now }, later })
}

/** "Later": the task comes back on `day` ("yyyy-MM-dd"). */
export function putOff(c: GuideChoices, task: Pick<GuideTask, 'id'>, day: string): GuideChoices {
  if (!idOk(task.id) || !DAY.test(day) || c.later[task.id] === day) return c
  return normalizeChoices({ skipped: c.skipped, later: { ...c.later, [task.id]: day } })
}

/** Brings a task back, whether it was skipped or put off. */
export function restoreTask(c: GuideChoices, id: string): GuideChoices {
  if (!(id in c.skipped) && !(id in c.later)) return c
  const skipped = { ...c.skipped }
  const later = { ...c.later }
  delete skipped[id]
  delete later[id]
  return normalizeChoices({ skipped, later })
}

const RANK = { todo: 0, blocked: 1, waiting: 2, done: 3 } as const

/**
 * The guide with the guest's choices laid over it, for a choice made since the guide was last fetched (the server applies the saved ones itself and lists them in `hidden` and
 * `deferred`). Tasks with a real deadline and done tasks stay. The primary, counts and the lists of what is put aside follow.
 */
export function applyChoices(view: GuideView, choices: GuideChoices, today: string): GuideView {
  const hidden = new Set(view.hidden)
  const deferred = new Map(view.deferred.map((d) => [d.id, d.until]))
  const kept: GuideTask[] = []
  for (const x of view.tasks) {
    if (x.hard || x.state === 'done') { kept.push(x); continue }
    if (x.id in choices.skipped) { hidden.add(x.id); continue }
    const until = choices.later[x.id]
    if (until !== undefined && until > today) { deferred.set(x.id, until); continue }
    kept.push(x)
  }
  // A choice undone since the last read leaves the lists at once; the task itself returns when the guide is read again.
  const known = !isEmpty(choices)
  const stillHidden = known ? [...hidden].filter((id) => id in choices.skipped) : [...hidden]
  const stillDeferred = [...deferred].filter(([id, until]) => !known || (choices.later[id] === until && until > today))
  const own = kept.filter((x) => x.carriedFrom === null)
  const tasks = kept.map((x, i) => ({ x, i })).sort((a, b) => RANK[a.x.state] - RANK[b.x.state] || a.i - b.i).map((p) => p.x)
  return {
    ...view,
    tasks,
    primaryId: tasks.find((x) => x.state === 'todo')?.id ?? null,
    counts: { done: own.filter((x) => x.state === 'done').length, total: own.length, open: tasks.filter((x) => x.state !== 'done').length },
    hidden: stillHidden,
    deferred: stillDeferred.map(([id, until]) => ({ id, until })),
  }
}
