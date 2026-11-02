import type { StringKey } from '../i18n'
import { EMBARK, DELIVERY_HOURS } from './boarding'
import type { Window } from './travel'
import { fromMinutes, toMinutes, isTime } from './journey'

/**
 * Embarkation planning (S5-01 to S5-06). Queue times come from the server (`GET /feeds/embark-queue`, a simulation, `source: 'sim'`);
 * everything else is authored guidance. Nothing here reads a position or books anything.
 */
export const EMBARK_SOURCE = 'sim' as const

export interface EmbarkNeeds {
  priority: boolean
  /** Needs step-free routes or more time. */
  mobility: boolean
  /** Wants a low-stimulation lane. */
  quiet: boolean
  /** Minutes from the guest's door (or hotel) to the terminal. */
  travelMinutes: number
  /** Earliest time the guest can be at the terminal, "HH:MM", or null when free. */
  earliest: string | null
}

export const EMPTY_NEEDS: EmbarkNeeds = { priority: false, mobility: false, quiet: false, travelMinutes: 45, earliest: null }

export type StepId = 'terminal' | 'security' | 'photo' | 'gangway'
export interface ForecastStep { id: StepId; walk: number; queue: number; /** A step-free lane is open here. */ accessibleLane: boolean; quietLane: boolean }

/** An arrival window as the server serves it for this guest's needs: its crowd, the wait through the terminal and the forecast for each step. */
export interface QueueWindow { start: string; end: string; crowd: Window['crowd']; waitMinutes: number; steps: ForecastStep[]; total: number }
export interface EmbarkQueue { windows: QueueWindow[]; recommended: string | null; source: typeof EMBARK_SOURCE }

export interface Swap { waitChange: number; aboardChange: number; sameSlot: boolean }

/** What choosing another window does: the change in waiting time and in when the guest is aboard (in minutes; positive means later or longer). */
export function swapEffect(from: Pick<QueueWindow, 'start' | 'waitMinutes'>, to: Pick<QueueWindow, 'start' | 'waitMinutes'>): Swap {
  const waitChange = to.waitMinutes - from.waitMinutes
  return { waitChange, aboardChange: toMinutes(to.start) - toMinutes(from.start) + waitChange, sameSlot: from.start === to.start }
}

// ---- First three hours (S5-03) ----

export type HourId = 'cabin' | 'lunch' | 'bags' | 'muster' | 'explore' | 'sailAway'
export interface HourItem { id: HourId; /** Minutes from midnight, ship home time. */ at: number }

/** After boarding: a short plan adapting to whether the cabin is ready. Before 13:00 the cabin is not, so lunch and the muster come first and the cabin follows. */
export function firstHours(boardedAt: string): { cabinReady: boolean; items: HourItem[]; bagsAt: number } {
  const board = toMinutes(isTime(boardedAt) ? boardedAt : EMBARK.terminalOpens)
  const ready = toMinutes(EMBARK.staterooms)
  const cabinReady = board >= ready
  const muster = toMinutes(EMBARK.muster)
  const sail = toMinutes(EMBARK.sailAway)
  const bagsAt = Math.max(board + 30 + DELIVERY_HOURS * 60, ready + 60)
  const items: HourItem[] = cabinReady
    ? [{ id: 'cabin', at: board + 10 }, { id: 'lunch', at: board + 30 }, { id: 'muster', at: Math.max(muster, board + 60) }, { id: 'bags', at: bagsAt }, { id: 'sailAway', at: sail }]
    : [{ id: 'lunch', at: board + 10 }, { id: 'muster', at: muster }, { id: 'cabin', at: ready }, { id: 'bags', at: bagsAt }, { id: 'sailAway', at: sail }]
  return { cabinReady, items: items.sort((a, b) => a.at - b.at), bagsAt }
}

export const hourClock = (m: number): string => fromMinutes(Math.min(m, 24 * 60 - 1))

// ---- Stateroom quick-start (S5-04) ----

export const QUICK_START: readonly StringKey[] = ['quick.wifi', 'quick.safe', 'quick.climate', 'quick.emergency', 'quick.steward']
export const STEWARDS = ['Maria', 'Joel', 'Anika', 'Tomas', 'Rosa'] as const
const hash = (text: string): number => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0 }
/** An authored steward name per booking (a demo value; the real one would come from the ship). */
export const stewardFor = (booker: string): string => STEWARDS[hash(booker) % STEWARDS.length]

// ---- Family boarding plan (S5-05) ----

export type FamilyRole = 'ahead' | 'park' | 'together'
export const FAMILY_ROLES: readonly FamilyRole[] = ['together', 'ahead', 'park']
export const MAX_MEET_NOTE = 80
export interface FamilyBoarding { roles: Record<string, FamilyRole>; meetNote: string; ready: Record<string, boolean> }
export const EMPTY_FAMILY: FamilyBoarding = { roles: {}, meetNote: '', ready: {} }

export const setRole = (s: FamilyBoarding, id: string, role: FamilyRole): FamilyBoarding => ({ ...s, roles: { ...s.roles, [id]: role } })
export const setReady = (s: FamilyBoarding, id: string, on: boolean): FamilyBoarding => ({ ...s, ready: { ...s.ready, [id]: on } })
export const setMeetNote = (s: FamilyBoarding, text: string): FamilyBoarding => ({ ...s, meetNote: text.slice(0, MAX_MEET_NOTE) })

export type FamilyProblem = 'childAlone' | 'parkerWithChild'

/** Plain checks on the plan: children going ahead need an adult going with them, and a child is not left to park the car. */
export function familyProblems(people: readonly { id: string; child: boolean }[], s: FamilyBoarding): FamilyProblem[] {
  const role = (id: string): FamilyRole => s.roles[id] ?? 'together'
  const ahead = people.filter((p) => role(p.id) === 'ahead')
  const problems: FamilyProblem[] = []
  const parkers = people.filter((p) => role(p.id) === 'park')
  if (ahead.length > 0 && ahead.every((p) => p.child)) problems.push('childAlone')
  if (parkers.some((p) => p.child)) problems.push('parkerWithChild')
  return problems
}

// ---- Welcome aboard (S5-06) ----

export const WELCOME_FIELDS = ['occasion', 'pronunciation', 'dietary'] as const
export type WelcomeField = (typeof WELCOME_FIELDS)[number]
export const MAX_WELCOME = 40
export interface Welcome { share: WelcomeField[]; occasion: string; pronunciation: string; dietary: string }
export const EMPTY_WELCOME: Welcome = { share: [], occasion: '', pronunciation: '', dietary: '' }

/** Only fields the guest chose to share, and only if they have text. Nothing is shared until a field is ticked. */
export const sharedWelcome = (w: Welcome): { field: WelcomeField; text: string }[] => WELCOME_FIELDS.flatMap((f) => (w.share.includes(f) && w[f].trim() ? [{ field: f, text: w[f].trim() }] : []))

export interface EmbarkState { needs: EmbarkNeeds; window: string | null; boardedAt: string; family: FamilyBoarding; welcome: Welcome }
export const EMPTY_EMBARK: EmbarkState = { needs: EMPTY_NEEDS, window: null, boardedAt: '12:00', family: EMPTY_FAMILY, welcome: EMPTY_WELCOME }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const flag = (v: unknown): boolean => v === true

export function normalizeEmbark(raw: unknown): EmbarkState {
  if (!isObj(raw)) return EMPTY_EMBARK
  const n = isObj(raw.needs) ? raw.needs : {}
  const f = isObj(raw.family) ? raw.family : {}
  const w = isObj(raw.welcome) ? raw.welcome : {}
  const entries = <T,>(v: unknown, ok: (x: unknown) => x is T): Record<string, T> =>
    isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => ok(x)).slice(0, 12)) as Record<string, T> : {}
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
  return {
    needs: {
      priority: flag(n.priority), mobility: flag(n.mobility), quiet: flag(n.quiet),
      travelMinutes: typeof n.travelMinutes === 'number' && n.travelMinutes >= 5 && n.travelMinutes <= 900 ? Math.round(n.travelMinutes) : EMPTY_NEEDS.travelMinutes,
      earliest: isTime(n.earliest) ? n.earliest : null,
    },
    window: isTime(raw.window) ? raw.window : null,
    boardedAt: isTime(raw.boardedAt) ? raw.boardedAt : EMPTY_EMBARK.boardedAt,
    family: {
      roles: entries(f.roles, (x): x is FamilyRole => FAMILY_ROLES.includes(x as FamilyRole)),
      meetNote: text(f.meetNote, MAX_MEET_NOTE),
      ready: entries(f.ready, (x): x is boolean => typeof x === 'boolean'),
    },
    welcome: {
      share: (Array.isArray(w.share) ? WELCOME_FIELDS.filter((x) => (w.share as unknown[]).includes(x)) : []),
      occasion: text(w.occasion, MAX_WELCOME), pronunciation: text(w.pronunciation, MAX_WELCOME), dietary: text(w.dietary, MAX_WELCOME),
    },
  }
}
