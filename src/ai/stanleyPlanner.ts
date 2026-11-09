/**
 * Stanley's planner, group diplomat and sea-time intelligence (docs/stanley-gap-analysis-and-plan.md, phase 9), device side. The server shapes the day, finds the free hour, plans the evening, drafts the meeting
 * message and reads a group's answers; this module reads its answers defensively and builds what is sent back. No time, conflict or price is worked out here. Framework-free, so it is tested in node.
 */
export const SCENARIOS = ['relaxed', 'active', 'family', 'culture', 'food', 'mixed'] as const
export type Scenario = (typeof SCENARIOS)[number]
export const PACES = ['relaxed', 'steady', 'active'] as const
export type Pace = (typeof PACES)[number]
export const SOURCES = ['verified', 'reported', 'unknown'] as const
export type AccessSource = (typeof SOURCES)[number]
export type PlannerMobility = 'any' | 'easy' | 'wheelchair'

export interface Segment { id: string; title: string; kind: string; source: 'reserved' | 'suggested'; start: string; end: string; clock: 'port' | 'ship'; placeId: string | null; cost: 'free' | 'included' | 'paid'; cents: number }
export interface Conflict { severity: 'hard' | 'soft'; code: string; ids: string[]; text: string }
export interface Window { start: string; end: string; minutes: number }
export interface TravellerChange { id: string; severity: 'change' | 'check'; text: string }
export interface TravellerCheck { name: string; source: AccessSource; changes: TravellerChange[]; humanCheck: boolean; note: string }
export interface PlannedDay { day: number; scenario: string; segments: Segment[]; conflicts: Conflict[]; ready: boolean; backBy: string | null; windows: Window[]; notes: string[]; traveller: TravellerCheck | null }
export interface HourOption { kind: 'event' | 'place'; id: string; title: string; start: string; minutes: number; place: string | null; cost: 'free' | 'included' | 'paid'; cents: number; walk: number; meets: string[]; why: string }
export interface PlannedHour { from: string; to: string; options: HourOption[]; occupancy: string }
export interface EveningStep { kind: string; title: string; start: string; end: string; place: string | null; walkFromPrevious: number; cost: string; source: string; route: string | null }
export interface Evening { steps: EveningStep[]; notes: string[]; complete: boolean }
export interface Meeting { text: string; placeName: string; deck: number; section: string }
export interface Preview { day: number; excursion: string; problem: string | null; readyBefore: boolean; readyAfter: boolean; newConflicts: Conflict[]; lost: string[]; priceChangeCents: number; freeCancelUntil: string | null; freeCancelOpen: boolean }
export interface TourCompareRow { key: string; a: string; b: string; differs: boolean }
export interface TourCompare { nameA: string; nameB: string; rows: TourCompareRow[]; risks: string[]; missing: string[] }

export interface GroupTally { id: string; label: string; yes: number; maybe: number; no: number }
export interface GroupStatus {
  state: 'open' | 'expired' | 'closed'
  answered: number
  silent: number
  tally: GroupTally[]
  suggestion: { kind: string; optionIds: string[]; text: string }
  reminderDue: boolean
  reminderText: string | null
  remains: string[]
  controls: string[]
  note: string
}

export const NOTE_MAX = 100
export const NAME_MAX = 30

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const list = (v: unknown, count: number, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, count).map((x) => x.slice(0, max)) : [])
const oneOf = <T extends string>(v: unknown, all: readonly T[], fallback: T): T => (typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : fallback)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const COSTS = ['free', 'included', 'paid'] as const

function conflicts(v: unknown): Conflict[] {
  return arr(v).flatMap((c): Conflict[] => {
    const x = rec(c)
    return typeof x.code === 'string' ? [{ severity: x.severity === 'hard' ? 'hard' : 'soft', code: x.code.slice(0, 30), ids: list(x.ids, 4, 40), text: str(x.text, 300) }] : []
  })
}

function traveller(v: unknown): TravellerCheck | null {
  if (!v || typeof v !== 'object') return null
  const o = rec(v)
  const changes = arr(o.changes).flatMap((c): TravellerChange[] => { const x = rec(c); return typeof x.text === 'string' ? [{ id: str(x.id, 40), severity: x.severity === 'change' ? 'change' : 'check', text: x.text.slice(0, 300) }] : [] }).slice(0, 20)
  return { name: str(o.name, NAME_MAX), source: oneOf(o.source, SOURCES, 'unknown'), changes, humanCheck: o.humanCheck === true, note: str(o.note, 300) }
}

export function normalizeDay(raw: unknown): PlannedDay | null {
  const o = rec(raw)
  if (!Array.isArray(o.segments)) return null
  const segments = o.segments.flatMap((s): Segment[] => {
    const x = rec(s)
    if (typeof x.id !== 'string' || typeof x.title !== 'string') return []
    return [{
      id: x.id.slice(0, 40), title: x.title.slice(0, 120), kind: str(x.kind, 12), source: x.source === 'reserved' ? 'reserved' : 'suggested', start: str(x.start, 5), end: str(x.end, 5),
      clock: x.clock === 'port' ? 'port' : 'ship', placeId: typeof x.placeId === 'string' ? x.placeId.slice(0, 40) : null, cost: oneOf(x.cost, COSTS, 'included'), cents: num(x.cents),
    }]
  })
  const windows = arr(o.windows).flatMap((w): Window[] => { const x = rec(w); return typeof x.start === 'string' && typeof x.end === 'string' ? [{ start: x.start.slice(0, 5), end: x.end.slice(0, 5), minutes: num(x.minutes) }] : [] })
  return {
    day: num(o.day), scenario: str(o.scenario, 12), segments, conflicts: conflicts(o.conflicts), ready: o.ready === true, backBy: typeof o.backBy === 'string' ? o.backBy.slice(0, 5) : null,
    windows, notes: list(o.notes, 10, 200), traveller: traveller(o.traveller),
  }
}

/** The day is ready only when the server says so and no hard conflict is listed, even if the answer were odd. */
export const isReady = (d: PlannedDay): boolean => d.ready && d.conflicts.every((c) => c.severity !== 'hard')

export const hardConflicts = (d: PlannedDay): Conflict[] => d.conflicts.filter((c) => c.severity === 'hard')

export function normalizeHour(raw: unknown): PlannedHour | null {
  const o = rec(raw)
  if (!Array.isArray(o.options)) return null
  const options = o.options.flatMap((p): HourOption[] => {
    const x = rec(p)
    if (typeof x.id !== 'string' || typeof x.title !== 'string') return []
    return [{
      kind: x.kind === 'event' ? 'event' : 'place', id: x.id.slice(0, 40), title: x.title.slice(0, 120), start: str(x.start, 5), minutes: num(x.minutes), place: typeof x.place === 'string' ? x.place.slice(0, 80) : null,
      cost: oneOf(x.cost, COSTS, 'included'), cents: num(x.cents), walk: num(x.walk), meets: list(x.meets, 4, 20), why: str(x.why, 200),
    }]
  }).slice(0, 3)
  return { from: str(o.from, 5), to: str(o.to, 5), options, occupancy: str(o.occupancy, 300) }
}

export function normalizeEvening(raw: unknown): Evening | null {
  const o = rec(raw)
  if (!Array.isArray(o.steps)) return null
  const steps = o.steps.flatMap((s): EveningStep[] => {
    const x = rec(s)
    return typeof x.kind === 'string' && typeof x.title === 'string'
      ? [{ kind: x.kind.slice(0, 10), title: x.title.slice(0, 120), start: str(x.start, 5), end: str(x.end, 5), place: typeof x.place === 'string' ? x.place.slice(0, 80) : null, walkFromPrevious: num(x.walkFromPrevious), cost: str(x.cost, 10), source: str(x.source, 10), route: typeof x.route === 'string' && x.route.startsWith('/') ? x.route.slice(0, 60) : null }]
      : []
  }).slice(0, 5)
  return { steps, notes: list(o.notes, 6, 300), complete: o.complete === true }
}

export function normalizeMeeting(raw: unknown): Meeting | null {
  const o = rec(raw)
  return typeof o.text === 'string' && o.text ? { text: o.text.slice(0, 400), placeName: str(o.placeName, 80), deck: num(o.deck), section: str(o.section, 20) } : null
}

export function normalizePreview(raw: unknown): Preview | null {
  const o = rec(raw)
  if (typeof o.excursion !== 'string') return null
  return {
    day: num(o.day), excursion: o.excursion.slice(0, 120), problem: typeof o.problem === 'string' ? o.problem.slice(0, 20) : null, readyBefore: o.readyBefore === true, readyAfter: o.readyAfter === true,
    newConflicts: conflicts(o.newConflicts), lost: list(o.lost, 6, 120), priceChangeCents: num(o.priceChangeCents), freeCancelUntil: typeof o.freeCancelUntil === 'string' ? o.freeCancelUntil.slice(0, 10) : null, freeCancelOpen: o.freeCancelOpen === true,
  }
}

export function normalizeTourCompare(raw: unknown): TourCompare | null {
  const o = rec(raw)
  if (!Array.isArray(o.rows)) return null
  const rows = o.rows.flatMap((r): TourCompareRow[] => { const x = rec(r); return typeof x.key === 'string' ? [{ key: x.key.slice(0, 20), a: str(x.a, 200), b: str(x.b, 200), differs: x.differs === true }] : [] })
  return { nameA: str(o.nameA, 120), nameB: str(o.nameB, 120), rows, risks: list(o.risks, 12, 300), missing: list(o.missing, 6, 300) }
}

export function normalizeGroupStatus(raw: unknown): GroupStatus | null {
  const o = rec(raw)
  if (!Array.isArray(o.tally)) return null
  const tally = o.tally.flatMap((t): GroupTally[] => { const x = rec(t); return typeof x.id === 'string' ? [{ id: x.id.slice(0, 40), label: str(x.label, 40), yes: num(x.yes), maybe: num(x.maybe), no: num(x.no) }] : [] })
  const s = rec(o.suggestion)
  return {
    state: o.state === 'closed' || o.state === 'expired' ? o.state : 'open', answered: num(o.answered), silent: num(o.silent), tally,
    suggestion: { kind: str(s.kind, 12) || 'none', optionIds: list(s.optionIds, 6, 40), text: str(s.text, 300) },
    reminderDue: o.reminderDue === true, reminderText: typeof o.reminderText === 'string' ? o.reminderText.slice(0, 300) : null, remains: list(o.remains, 6, 200), controls: list(o.controls, 4, 12), note: str(o.note, 200),
  }
}

/** A poll with single votes becomes the server's request: a vote is a yes for that option, and no vote is an empty answer, never a yes. No reason is ever sent. */
export function groupRequest(
  poll: { question: string; options: { id: string; label: string }[]; votes: Record<string, string>; closedAt?: number },
  members: readonly { id: string; name: string }[],
  organiser: boolean,
): { question: string; options: { id: string; label: string }[]; members: { name: string; answers: Record<string, string> }[]; closed: boolean; organiser: boolean } {
  const ids = new Set(poll.options.map((o) => o.id))
  return {
    question: poll.question,
    options: poll.options,
    members: members.slice(0, 20).map((m) => {
      const v = poll.votes[m.id]
      return { name: m.name.slice(0, NAME_MAX) || '?', answers: v !== undefined && ids.has(v) ? { [v]: 'yes' } : {} }
    }),
    closed: poll.closedAt !== undefined,
    organiser,
  }
}

/** The meeting note cut to the limit, so the request is never refused for length. */
export const cleanNote = (s: string): string => s.trim().slice(0, NOTE_MAX)
