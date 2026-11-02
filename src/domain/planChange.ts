
/**
 * Changes to the day plan, shared by Autopilot (S6-02) and the assistant (XA-02).
 * One rule: a change starts as a proposal with a preview; only an explicit accept applies it; an accepted change can be undone for a stated period;
 * and every decision stays in the log. Nothing here ever changes the plan by itself.
 */
export type PlanKind = 'tour' | 'event' | 'dinner' | 'added'

export interface PlanEntry {
  id: string
  title: string
  /** "HH:MM" (a tour is in port time, the rest in ship time). */
  start: string
  minutes: number
  kind: PlanKind
  placeId?: string
  outdoor: boolean
  path: string
}

export type Edit =
  | { op: 'move'; id: string; to: string }
  | { op: 'drop'; id: string }
  | { op: 'add'; entry: PlanEntry }

export type ChangeSource = 'autopilot' | 'assistant'
export type ChangeStatus = 'proposed' | 'accepted' | 'declined' | 'undone'

export interface Change {
  id: string
  /** The day of the cruise (1 to 8) it is about. */
  day: number
  source: ChangeSource
  /** Why it came up, as a short phrase. */
  cause: string
  title: string
  why: string
  edits: Edit[]
  /** Something the guest should know before accepting. */
  warning?: string
  status: ChangeStatus
  proposedAt: number
  decidedAt?: number
  /** An accepted change can be undone until this moment. */
  undoUntil: number
}

export const minutesOf = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
export const hhmmOf = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const isHhmm = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

export const UNDO_ASSISTANT_MIN = 120

export type RowState = 'planned' | 'moved' | 'dropped' | 'added'
export interface PlanRow { entry: PlanEntry; state: RowState; /** The start before a move. */ was?: string; changeId?: string }

function applyEdits(rows: PlanRow[], edits: readonly Edit[], changeId: string): PlanRow[] {
  let out = rows.map((r) => ({ ...r }))
  for (const e of edits) {
    if (e.op === 'add') {
      if (!out.some((r) => r.entry.id === e.entry.id)) out.push({ entry: e.entry, state: 'added', changeId })
    } else {
      out = out.map((r) => {
        if (r.entry.id !== e.id) return r
        if (e.op === 'drop') return { ...r, state: 'dropped' as const, changeId }
        return { entry: { ...r.entry, start: e.to }, state: 'moved' as const, was: r.was ?? r.entry.start, changeId }
      })
    }
  }
  return out
}

/** The plan with every accepted change applied, in time order. A dropped item stays in the list (struck through) so the day does not seem to lose it silently. */
export function applyChanges(base: readonly PlanEntry[], changes: readonly Change[]): PlanRow[] {
  let rows: PlanRow[] = base.map((entry) => ({ entry, state: 'planned' }))
  for (const c of changes) if (c.status === 'accepted') rows = applyEdits(rows, c.edits, c.id)
  return rows.sort((a, b) => minutesOf(a.entry.start) - minutesOf(b.entry.start) || a.entry.id.localeCompare(b.entry.id))
}

const live = (rows: readonly PlanRow[]): PlanRow[] => rows.filter((r) => r.state !== 'dropped')
const endOf = (e: PlanEntry): number => minutesOf(e.start) + e.minutes
const clash = (a: PlanEntry, b: PlanEntry): boolean => minutesOf(a.start) < endOf(b) && minutesOf(b.start) < endOf(a)

/** Pairs of kept items whose times cross. */
export function conflicts(rows: readonly PlanRow[]): [PlanEntry, PlanEntry][] {
  const l = live(rows)
  const out: [PlanEntry, PlanEntry][] = []
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (clash(l[i].entry, l[j].entry)) out.push([l[i].entry, l[j].entry])
  return out
}

/** Rows to show: a dropped item stays visible until the day ends (S6-02). */
export const visibleRows = (rows: readonly PlanRow[], now: number, dayEndAt: number): PlanRow[] => (now >= dayEndAt ? rows.filter((r) => r.state !== 'dropped') : [...rows])

export type Cause =
  | { kind: 'moved'; id: string; to: string; reason?: string }
  | { kind: 'cancelled'; id: string; reason?: string }
  | { kind: 'rain'; from: string; to: string }
  | { kind: 'tender'; delayMinutes: number; allAboard: string }

export interface ReflowContext { now: number; day: number; /** When the guest's day ends: the last moment to undo an Autopilot change. */ dayEndAt: number }

const LATEST_END = 23 * 60 + 30
const fits = (e: PlanEntry, rows: readonly PlanRow[]): boolean => endOf(e) <= LATEST_END && !live(rows).some((r) => clash(e, r.entry))

/** The ship's own mid-day changes (the server's list for the day) that touch the plan, as causes. */
export function shipChangesFor(served: readonly { id: string; kind: 'moved' | 'cancelled'; start: string | null; reason: string | null }[], rows: readonly PlanRow[]): Cause[] {
  const ids = new Set(rows.map((r) => r.entry.id))
  return served.flatMap((c): Cause[] => {
    if (!ids.has(c.id)) return []
    if (c.kind === 'moved' && c.start) return [{ kind: 'moved', id: c.id, to: c.start, reason: c.reason ?? undefined }]
    if (c.kind === 'cancelled') return [{ kind: 'cancelled', id: c.id, reason: c.reason ?? undefined }]
    return []
  })
}

const nameOf = (rows: readonly PlanRow[], id: string): string => rows.find((r) => r.entry.id === id)?.entry.title ?? id

/** A proposed reflow for a cause, or null when the plan needs nothing. The result is only ever a proposal. */
export function proposeReflow(rows: readonly PlanRow[], cause: Cause, alternatives: readonly PlanEntry[], ctx: ReflowContext): Change | null {
  const key = cause.kind === 'tender' ? String(cause.delayMinutes) : cause.kind === 'rain' ? cause.from : cause.id
  const base = { id: `autopilot:${ctx.day}:${cause.kind}:${key}`, day: ctx.day, source: 'autopilot' as const, status: 'proposed' as const, proposedAt: ctx.now, undoUntil: ctx.dayEndAt }
  const kept = live(rows)

  if (cause.kind === 'moved') {
    const row = kept.find((r) => r.entry.id === cause.id)
    if (!row || row.entry.start === cause.to) return null
    const moved: PlanEntry = { ...row.entry, start: cause.to }
    const others = kept.filter((r) => r.entry.id !== cause.id)
    const hard = others.find((r) => (r.entry.kind === 'dinner' || r.entry.kind === 'tour') && clash(moved, r.entry))
    if (hard || endOf(moved) > LATEST_END) {
      return { ...base, cause: cause.reason ?? 'The time changed', title: `Drop ${row.entry.title}`, why: `${row.entry.title} moves to ${cause.to}, which crosses ${hard ? hard.entry.title : 'the end of the evening'}. Dropping it keeps the rest of your day as it is.`, edits: [{ op: 'drop', id: cause.id }] }
    }
    const edits: Edit[] = [{ op: 'move', id: cause.id, to: cause.to }]
    for (const o of others.filter((r) => clash(moved, r.entry))) {
      const start = endOf(moved) + 15
      const shifted: PlanEntry = { ...o.entry, start: hhmmOf(start) }
      if (endOf(shifted) <= LATEST_END && !others.some((x) => x !== o && clash(shifted, x.entry))) edits.push({ op: 'move', id: o.entry.id, to: shifted.start })
      else edits.push({ op: 'drop', id: o.entry.id })
    }
    return { ...base, cause: cause.reason ?? 'The time changed', title: `Move ${row.entry.title} to ${cause.to}`, why: edits.length > 1 ? `${row.entry.title} now starts at ${cause.to}. That crosses ${edits.length - 1} other item${edits.length > 2 ? 's' : ''}, so they are moved too.` : `${row.entry.title} now starts at ${cause.to}. Nothing else in your day is affected.`, edits }
  }

  if (cause.kind === 'cancelled') {
    const row = kept.find((r) => r.entry.id === cause.id)
    if (!row) return null
    const edits: Edit[] = [{ op: 'drop', id: cause.id }]
    const after = rows.map((r) => (r.entry.id === cause.id ? { ...r, state: 'dropped' as const } : r))
    const swap = alternatives.find((a) => fits(a, after))
    if (swap) edits.push({ op: 'add', entry: { ...swap, kind: 'added' } })
    return { ...base, cause: cause.reason ?? 'It was cancelled', title: swap ? `Swap ${row.entry.title} for ${swap.title}` : `Drop ${row.entry.title}`, why: swap ? `${row.entry.title} is cancelled. ${swap.title} at ${swap.start} fits the gap.` : `${row.entry.title} is cancelled and nothing else fits the gap, so your day has a free hour.`, edits }
  }

  if (cause.kind === 'rain') {
    const from = minutesOf(cause.from)
    const to = minutesOf(cause.to)
    const wet = kept.filter((r) => r.entry.outdoor && r.entry.kind !== 'tour' && minutesOf(r.entry.start) < to && endOf(r.entry) > from)
    if (wet.length === 0) return null
    const edits: Edit[] = []
    let working: PlanRow[] = rows.map((r) => (wet.some((w) => w.entry.id === r.entry.id) ? { ...r, state: 'dropped' as const } : r))
    for (const w of wet) {
      edits.push({ op: 'drop', id: w.entry.id })
      const indoor = alternatives.find((a) => !a.outdoor && fits(a, working))
      if (indoor) { edits.push({ op: 'add', entry: { ...indoor, kind: 'added' } }); working = [...working, { entry: { ...indoor, kind: 'added' }, state: 'added' }] }
    }
    const tour = kept.some((r) => r.entry.kind === 'tour')
    return { ...base, cause: `Rain is forecast ${cause.from} to ${cause.to}`, title: 'Move outdoor plans indoors', why: `${wet.map((w) => w.entry.title).join(', ')} ${wet.length > 1 ? 'are' : 'is'} outdoors.${tour ? ' Your shore excursion is left as it is; the operator decides about rain.' : ''}`, edits }
  }

  const tours = kept.filter((r) => r.entry.kind === 'tour')
  if (tours.length === 0 || cause.delayMinutes <= 0) return null
  const edits: Edit[] = tours.map((r) => ({ op: 'move' as const, id: r.entry.id, to: hhmmOf(minutesOf(r.entry.start) + cause.delayMinutes) }))
  const worst = tours.some((r) => minutesOf(r.entry.start) + cause.delayMinutes + r.entry.minutes + 45 > minutesOf(cause.allAboard))
  return { ...base, cause: `Tenders are running ${cause.delayMinutes} minutes late`, title: `Start ${nameOf(rows, tours[0].entry.id)} ${cause.delayMinutes} minutes later`, why: 'Getting ashore takes longer, so the tour start moves with it. The all-aboard time does not move.', warning: worst ? `With the delay you may have under 45 minutes to spare before ${cause.allAboard}. You can leave this tour out instead.` : undefined, edits }
}

/** An event a change puts into, or takes out of, the guest's own plan on the account (the programme they see on every device). */
export interface ProgrammeEffect { eventId: string; on: boolean }

/**
 * What an accepted change does to the guest's programme plan, or, with `undo`, what undoing it does. Only programme events count (an entry the server served as an event; the client holds no programme table to check against): a tour or dinner is a booking
 * that the guest changes themselves, a move has no place in the programme (events start when they start), and a line the guest pasted is not an event.
 */
export function programmeEffects(c: Change, base: readonly PlanEntry[], undo = false): ProgrammeEffect[] {
  const last = new Map<string, boolean>()
  for (const e of c.edits) {
    if (e.op === 'drop' && base.find((x) => x.id === e.id)?.kind === 'event') last.set(e.id, false)
    else if (e.op === 'add' && e.entry.kind === 'event') last.set(e.entry.id, true)
  }
  return [...last].map(([eventId, on]) => ({ eventId, on: undo ? !on : on }))
}

/** What moving from `before` to `after` does to the programme: the effects of each change that was newly accepted, or newly undone, by day. */
export function programmeDiff(before: readonly Change[], after: readonly Change[], baseFor: (day: number) => readonly PlanEntry[]): { day: number; effects: ProgrammeEffect[] }[] {
  const out = new Map<number, ProgrammeEffect[]>()
  for (const c of after) {
    const was = before.find((x) => x.id === c.id)?.status
    const undo = c.status === 'undone' && was === 'accepted'
    if (!undo && !(c.status === 'accepted' && was !== 'accepted')) continue
    const effects = programmeEffects(c, baseFor(c.day), undo)
    if (effects.length > 0) out.set(c.day, [...(out.get(c.day) ?? []), ...effects])
  }
  return [...out].map(([day, effects]) => ({ day, effects }))
}

export type Decision = { ok: true; changes: Change[] } | { ok: false; reason: 'missing' | 'conflict' | 'closed' }

/** Accepts a proposal. Refused if it is not waiting, or if it would make the day cross itself where it did not before. */
export function acceptChange(base: readonly PlanEntry[], changes: readonly Change[], id: string, now: number): Decision {
  const c = changes.find((x) => x.id === id)
  if (!c || c.status !== 'proposed') return { ok: false, reason: 'missing' }
  const accepted: Change = { ...c, status: 'accepted', decidedAt: now }
  if (now >= c.undoUntil) return { ok: false, reason: 'closed' }
  const before = conflicts(applyChanges(base, changes)).length
  const after = conflicts(applyChanges(base, changes.map((x) => (x.id === id ? accepted : x)))).length
  if (after > before) return { ok: false, reason: 'conflict' }
  return { ok: true, changes: changes.map((x) => (x.id === id ? accepted : x)) }
}

export function declineChange(changes: readonly Change[], id: string, now: number): Change[] {
  return changes.map((c) => (c.id === id && c.status === 'proposed' ? { ...c, status: 'declined' as const, decidedAt: now } : c))
}

export const canUndo = (c: Change, now: number): boolean => c.status === 'accepted' && now < c.undoUntil

/** Undo puts the plan back as it was. Only inside the stated period; after that the change stays. */
export function undoChange(changes: readonly Change[], id: string, now: number): Change[] {
  return changes.map((c) => (c.id === id && canUndo(c, now) ? { ...c, status: 'undone' as const, decidedAt: now } : c))
}

/** The log, newest first: what was proposed, accepted, declined or undone. */
export const changeLog = (changes: readonly Change[]): Change[] => [...changes].sort((a, b) => (b.decidedAt ?? b.proposedAt) - (a.decidedAt ?? a.proposedAt))

/** Adds a proposal unless one for the same cause and item is already waiting or accepted (so a change is offered once). */
export function addProposal(changes: readonly Change[], c: Change): Change[] {
  return changes.some((x) => x.id === c.id) ? [...changes] : [...changes, c]
}

/** An assistant request typed in plain words ("move dinner to 8", "skip bingo", "add trivia") as a proposal, or why it could not be. */
export type Request = { ok: true; change: Change } | { ok: false; reason: 'unclear' | 'nothing' }

export function parseTime(text: string): string | null {
  const m = /\b(\d{1,2})(?::(\d\d))?\s*(am|pm)?\b/i.exec(text.replace(/\bto\b/i, ' '))
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? '0')
  const ap = m[3]?.toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  // A bare small number in the evening context reads as pm ("dinner at 8").
  if (!ap && h >= 1 && h <= 9) h += 12
  return h > 23 || min > 59 ? null : hhmmOf(h * 60 + min)
}

export function requestChange(text: string, rows: readonly PlanRow[], alternatives: readonly PlanEntry[], now: number, day: number): Request {
  const q = text.toLowerCase()
  const base = { day, source: 'assistant' as const, status: 'proposed' as const, proposedAt: now, undoUntil: now + UNDO_ASSISTANT_MIN * 60_000, cause: 'You asked' }
  const named = (list: readonly PlanEntry[]): PlanEntry | undefined => list.find((e) => q.includes(e.title.toLowerCase()) || e.id.split('-').every((w) => q.includes(w)) || (e.kind === 'dinner' && /dinner/.test(q)))
  const kept = live(rows).map((r) => r.entry)
  const move = /\b(move|change|shift|push)\b/.test(q)
  if (move) {
    const item = named(kept)
    const to = parseTime(q.slice(q.search(/\b(to|at)\b/) >= 0 ? q.search(/\b(to|at)\b/) : 0))
    if (!item || !to) return { ok: false, reason: 'unclear' }
    return { ok: true, change: { ...base, id: `assistant:move:${item.id}:${now}`, title: `Move ${item.title} to ${to}`, why: `${item.title} is at ${item.start} now.`, edits: [{ op: 'move', id: item.id, to }] } }
  }
  if (/\b(skip|drop|cancel|remove)\b/.test(q)) {
    const item = named(kept)
    return item ? { ok: true, change: { ...base, id: `assistant:drop:${item.id}:${now}`, title: `Drop ${item.title}`, why: 'It stays in your list, struck through, until the day ends.', edits: [{ op: 'drop', id: item.id }] } } : { ok: false, reason: 'unclear' }
  }
  if (/\badd\b/.test(q)) {
    const item = named(alternatives)
    return item ? { ok: true, change: { ...base, id: `assistant:add:${item.id}:${now}`, title: `Add ${item.title} at ${item.start}`, why: 'It is included in your fare.', edits: [{ op: 'add', entry: { ...item, kind: 'added' } }] } } : { ok: false, reason: 'nothing' }
  }
  return { ok: false, reason: 'unclear' }
}

