/**
 * The port day, together (S6A-05, S6A-06, S6-12): who is leaving and who is back, the plan the group agrees on, and a meeting place.
 * Kept on the device under the booker, like the party notes. It records what people tell the app; it never reads a position.
 */
export type Presence = 'ashore' | 'leaving' | 'back'
export const PRESENCE: readonly Presence[] = ['ashore', 'leaving', 'back']
export const MAX_NOTE = 140
export const MAX_RENDEZVOUS = 6

export interface PresenceEntry { status: Presence; at: number }
export interface SharedPlan {
  /** An excursion id, or "free" for a free day. */
  outing: string
  title: string
  travelMinutes: number
  buffer: number
  by: string
  agreed: string[]
}

export type MeetState = 'waiting' | 'onway' | 'here'
export const MEET_STATES: readonly MeetState[] = ['waiting', 'onway', 'here']
export interface Rendezvous {
  id: string
  place: string
  at: number
  by: string
  members: Record<string, MeetState>
  /** Where to go if someone has no signal, agreed in advance. */
  fallback: string
  /** Minutes past the meeting time before the fallback applies. */
  fallbackAfter: number
}

export interface DayState {
  presence: Record<string, PresenceEntry>
  plan: SharedPlan | null
  planB: string | null
}
export interface PortPartyState {
  /** By port-day date. */
  days: Record<string, DayState>
  /** Minutes before all-aboard when the app nudges someone who is not back. */
  alertBefore: number
  rendezvous: Rendezvous[]
}

export const ALERT_CHOICES = [30, 45, 60, 90] as const
export const EMPTY_DAY: DayState = { presence: {}, plan: null, planB: null }
export const EMPTY_PORT_PARTY: PortPartyState = { days: {}, alertBefore: 45, rendezvous: [] }

export const dayOf = (s: PortPartyState, date: string): DayState => s.days[date] ?? EMPTY_DAY
const withDay = (s: PortPartyState, date: string, change: (d: DayState) => DayState): PortPartyState => ({ ...s, days: { ...s.days, [date]: change(dayOf(s, date)) } })

/** Records where a person says they are. */
export const setPresence = (s: PortPartyState, date: string, who: string, status: Presence, at: number): PortPartyState =>
  withDay(s, date, (d) => ({ ...d, presence: { ...d.presence, [who]: { status, at } } }))

export const presenceOf = (d: DayState, who: string): Presence | null => d.presence[who]?.status ?? null

export const setAlertBefore = (s: PortPartyState, minutes: number): PortPartyState => ({ ...s, alertBefore: ALERT_CHOICES.includes(minutes as 30) ? minutes : s.alertBefore })

export const setPlanB = (s: PortPartyState, date: string, id: string | null): PortPartyState => withDay(s, date, (d) => ({ ...d, planB: id }))

/** Proposes a plan; only the proposer has agreed to it. */
export const proposePlan = (s: PortPartyState, date: string, plan: Omit<SharedPlan, 'agreed' | 'by'>, by: string): PortPartyState =>
  withDay(s, date, (d) => ({ ...d, plan: { ...plan, title: plan.title.slice(0, 80), by, agreed: [by] } }))

export const agreePlan = (s: PortPartyState, date: string, who: string): PortPartyState =>
  withDay(s, date, (d) => (d.plan && !d.plan.agreed.includes(who) ? { ...d, plan: { ...d.plan, agreed: [...d.plan.agreed, who] } } : d))

export const clearPlan = (s: PortPartyState, date: string): PortPartyState => withDay(s, date, (d) => ({ ...d, plan: null }))

/** Everyone in the party has agreed. */
export const planAgreed = (plan: SharedPlan | null, members: readonly string[]): boolean => !!plan && members.every((m) => plan.agreed.includes(m))

export interface BackCheck {
  /** Whether the nudge is due: inside the chosen window before all-aboard, and someone is not back. */
  due: boolean
  minutesLeft: number
  /** People not yet back, with the children among them listed separately. */
  missing: string[]
  missingChildren: string[]
  /** The gangway guidance applies once under 30 minutes remain. */
  gangway: boolean
}

/** Who is not back as all-aboard nears (S6A-05). People who have not said anything are counted as not back. A child's name goes in its own list for a quiet note to the adults. */
export function backCheck(members: readonly { id: string; child: boolean }[], day: DayState, allAboardAt: number, alertBefore: number, now: number): BackCheck {
  const minutesLeft = Math.max(0, Math.ceil((allAboardAt - now) / 60_000))
  const notBack = members.filter((m) => presenceOf(day, m.id) !== 'back')
  const inWindow = now < allAboardAt && minutesLeft <= alertBefore
  return {
    due: inWindow && notBack.length > 0,
    minutesLeft,
    missing: notBack.filter((m) => !m.child).map((m) => m.id),
    missingChildren: notBack.filter((m) => m.child).map((m) => m.id),
    gangway: now < allAboardAt && minutesLeft <= 30 && notBack.length > 0,
  }
}

/** Whether anyone has said they are out in the port today; with nobody out, no nudge is due. */
export const anyoneOut = (day: DayState): boolean => Object.values(day.presence).some((p) => p.status !== 'back')

// ---- Rendezvous (S6-12) ----

export function addRendezvous(s: PortPartyState, input: { place: string; at: number; fallback: string; fallbackAfter?: number; members: readonly string[] }, by: string, id: string): PortPartyState {
  const place = input.place.trim().slice(0, 80)
  if (!place) return s
  const members = Object.fromEntries(input.members.map((m): [string, MeetState] => [m, m === by ? 'onway' : 'waiting']))
  const r: Rendezvous = { id, place, at: input.at, by, members, fallback: input.fallback.trim().slice(0, 80) || 'the ship’s gangway', fallbackAfter: input.fallbackAfter ?? 15 }
  return { ...s, rendezvous: [...s.rendezvous, r].slice(-MAX_RENDEZVOUS) }
}

export const setMeetState = (s: PortPartyState, id: string, who: string, state: MeetState): PortPartyState =>
  ({ ...s, rendezvous: s.rendezvous.map((r) => (r.id === id && who in r.members ? { ...r, members: { ...r.members, [who]: state } } : r)) })

export const removeRendezvous = (s: PortPartyState, id: string, by: string): PortPartyState => ({ ...s, rendezvous: s.rendezvous.filter((r) => !(r.id === id && r.by === by)) })

export interface MeetView {
  here: string[]
  onway: string[]
  waiting: string[]
  /** Past the meeting time with someone not here. */
  late: boolean
  /** Past the fallback point: use the fallback place. */
  useFallback: boolean
  /** Children not there yet, for a quiet note to the adults only. */
  childLate: string[]
}

export function meetView(r: Rendezvous, children: ReadonlySet<string>, now: number): MeetView {
  const ids = Object.keys(r.members)
  const pick = (s: MeetState) => ids.filter((i) => r.members[i] === s)
  const notHere = ids.filter((i) => r.members[i] !== 'here')
  const late = now >= r.at && notHere.length > 0
  return {
    here: pick('here'), onway: pick('onway'), waiting: pick('waiting'),
    late,
    useFallback: now >= r.at + r.fallbackAfter * 60_000 && notHere.length > 0,
    childLate: late ? notHere.filter((i) => children.has(i)) : [],
  }
}

// ---- Reading a saved record ----

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '')

function normPlan(raw: unknown): SharedPlan | null {
  if (!isObj(raw) || typeof raw.outing !== 'string') return null
  return {
    outing: raw.outing.slice(0, 40), title: str(raw.title, 80), travelMinutes: typeof raw.travelMinutes === 'number' ? Math.max(0, Math.min(240, raw.travelMinutes)) : 0,
    buffer: typeof raw.buffer === 'number' ? raw.buffer : 45, by: str(raw.by, 40), agreed: (Array.isArray(raw.agreed) ? raw.agreed : []).filter((x): x is string => typeof x === 'string').slice(0, 12),
  }
}

function normDay(raw: unknown): DayState {
  if (!isObj(raw)) return EMPTY_DAY
  const presence: Record<string, PresenceEntry> = {}
  if (isObj(raw.presence)) for (const [k, v] of Object.entries(raw.presence)) if (isObj(v) && PRESENCE.includes(v.status as Presence) && typeof v.at === 'number') presence[k.slice(0, 40)] = { status: v.status as Presence, at: v.at }
  return { presence, plan: normPlan(raw.plan), planB: typeof raw.planB === 'string' ? raw.planB.slice(0, 20) : null }
}

function normRendezvous(raw: unknown): Rendezvous | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.place !== 'string' || !raw.place.trim() || typeof raw.at !== 'number' || !isObj(raw.members)) return null
  const members: Record<string, MeetState> = {}
  for (const [k, v] of Object.entries(raw.members)) if (MEET_STATES.includes(v as MeetState)) members[k.slice(0, 40)] = v as MeetState
  return { id: raw.id, place: raw.place.slice(0, 80), at: raw.at, by: str(raw.by, 40), members, fallback: str(raw.fallback, 80) || 'the ship’s gangway', fallbackAfter: typeof raw.fallbackAfter === 'number' ? Math.max(5, Math.min(120, raw.fallbackAfter)) : 15 }
}

export function normalizePortParty(raw: unknown): PortPartyState {
  if (!isObj(raw)) return EMPTY_PORT_PARTY
  const days: Record<string, DayState> = {}
  if (isObj(raw.days)) for (const [k, v] of Object.entries(raw.days)) if (/^\d{4}-\d{2}-\d{2}$/.test(k)) days[k] = normDay(v)
  return {
    days,
    alertBefore: ALERT_CHOICES.includes(raw.alertBefore as 45) ? (raw.alertBefore as number) : EMPTY_PORT_PARTY.alertBefore,
    rendezvous: (Array.isArray(raw.rendezvous) ? raw.rendezvous : []).flatMap((x) => normRendezvous(x) ?? []).slice(-MAX_RENDEZVOUS),
  }
}
