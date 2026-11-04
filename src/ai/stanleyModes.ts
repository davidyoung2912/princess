import type { JourneyStage } from '../routes/hubs'
import { planPortDay, DEFAULT_BUFFER } from '../domain/portPilot'
import type { StanleyLevel } from '../settings/settings'

/**
 * The four journey modes Stanley leads (docs/experience-extension-ideas.md N-G1, N-E1, N-O1, N-L1). Each is a short, time-ordered list of steps with one big
 * next step on top. Pure data and rules, so they are tested in node; the words are `stanley.mode.<mode>.<step>.title` and `.line`.
 */
export const MODE_IDS = ['boardingDay', 'firstFour', 'portDay', 'lastMorning'] as const
export type ModeId = (typeof MODE_IDS)[number]

export interface ModeStep {
  id: string
  /** When the step happens (epoch ms), or null for a step with no clock time. */
  at: number | null
  /** The screen that helps with it. */
  to: string
  /** The data already shows it is done (muster done, say), so the guest need not tick it. */
  done?: boolean
}

/** Everything the steps are made from; each mode reads only its own part. All times are epoch milliseconds. */
export interface ModeFacts {
  boardingDay?: { checkinDone: boolean }
  firstFour?: { musterAt: number; musterDone: boolean; sailAwayAt: number | null }
  portDay?: { allAboardAt: number; arriveAt: number; tender: boolean; skipped: boolean }
  lastMorning?: { tipBy: number; bagsOutAt: number; arrivalAt: number; vacateAt: number }
}

/** The mode that suits a stage, or null (Dream to Prebook, at sea and Remember have none; at sea only the last evening does, see {@link modeFor}). */
export const MODE_OF_STAGE: Partial<Record<JourneyStage, ModeId>> = { getToShip: 'boardingDay', embark: 'firstFour', port: 'portDay', disembark: 'lastMorning' }

/** From this hour on the last full day, the Last Morning mode starts (bag night is coming). */
export const LAST_EVENING_HOUR = 18

export interface ModePosition {
  stage: JourneyStage
  /** Days to departure for a guest with a trip; 0 on the day of sailing. */
  daysToDeparture?: number
  /** It is the last full day of the cruise or later. */
  lastFullDay?: boolean
  /** The ship's hour of day, 0 to 23. */
  hour: number
  /** The guest is aboard. */
  aboard: boolean
}

/** Which mode, if any, is on now. Boarding Day only on the day of sailing; Port Day only aboard; Last Morning from the evening of the last full day. */
export function modeFor(p: ModePosition): ModeId | null {
  if (p.stage === 'getToShip') return p.daysToDeparture === 0 ? 'boardingDay' : null
  if (p.stage === 'embark') return p.aboard ? 'firstFour' : null
  if (p.stage === 'port') return p.aboard ? 'portDay' : null
  if (p.stage === 'disembark') return 'lastMorning'
  if (p.stage === 'sea' && p.aboard && p.lastFullDay && p.hour >= LAST_EVENING_HOUR) return 'lastMorning'
  return null
}

/** The modes start by themselves at Chatty and Helpful only, and can always be opened by hand unless Stanley is Off. */
export const modeAutoShows = (level: StanleyLevel): boolean => level === 'chatty' || level === 'helpful'
export const modeCanOpen = (level: StanleyLevel): boolean => level !== 'off'

const min = 60_000

/** The steps of a mode, in order. A mode whose facts are missing has none. */
export function modeSteps(mode: ModeId, f: ModeFacts): ModeStep[] {
  switch (mode) {
    case 'boardingDay': {
      const b = f.boardingDay
      if (!b) return []
      return [
        { id: 'checkin', at: null, to: '/home/check-in', done: b.checkinDone },
        { id: 'pass', at: null, to: '/home/boarding-pass' },
        { id: 'leave', at: null, to: '/plan/getting-there' },
        { id: 'bags', at: null, to: '/home/luggage' },
        { id: 'papers', at: null, to: '/home/clearance' },
        { id: 'photo', at: null, to: '/home/embarkation/steps' },
        { id: 'gangway', at: null, to: '/home/embarkation' },
      ]
    }
    case 'firstFour': {
      const e = f.firstFour
      if (!e) return []
      return [
        { id: 'cabin', at: null, to: '/home/meeting-point' },
        { id: 'lunch', at: null, to: '/ship/venues' },
        { id: 'muster', at: e.musterAt, to: '/ship/muster', done: e.musterDone },
        { id: 'walk', at: null, to: '/ship/map' },
        ...(e.sailAwayAt !== null ? [{ id: 'sailAway', at: e.sailAwayAt, to: '/plan/day' }] : []),
        { id: 'dinner', at: null, to: '/plan/dining' },
      ]
    }
    case 'portDay': {
      const p = f.portDay
      if (!p || p.skipped) return []
      const plan = planPortDay({ day: { allAboardAt: p.allAboardAt, arriveAt: p.arriveAt, tender: p.tender }, travelMinutes: 0, outingMinutes: null, buffer: DEFAULT_BUFFER, crowd: 'moderate' })
      return plan.steps.filter((s) => s.id !== 'start').map((s) => ({ id: s.id, at: s.at, to: '/ship/port' }))
    }
    case 'lastMorning': {
      const l = f.lastMorning
      if (!l) return []
      return [
        { id: 'tips', at: l.tipBy, to: '/me/bill' },
        { id: 'bags', at: l.bagsOutAt, to: '/home/disembark/bags' },
        { id: 'sweep', at: null, to: '/home/disembark/sweep' },
        { id: 'arrive', at: l.arrivalAt, to: '/home/disembark' },
        { id: 'customs', at: null, to: '/home/disembark/customs' },
        { id: 'vacate', at: l.vacateAt, to: '/home/disembark' },
      ]
    }
  }
}

export interface ModeView {
  steps: ModeStep[]
  /** The step to do now: the first not done. Null when every step is done. */
  current: ModeStep | null
  /** Steps after the current one. */
  later: ModeStep[]
  /** Steps already done. */
  finished: ModeStep[]
  /** Whole minutes to the current step's time, negative once it has passed; null when it has no time. */
  minutesTo: number | null
}

/** The mode now: what is done (by the data or the guest's own tick), the one thing to do, and what comes after. */
export function modeView(steps: readonly ModeStep[], ticked: ReadonlySet<string>, now: number): ModeView {
  const isDone = (s: ModeStep) => s.done === true || ticked.has(s.id)
  const finished = steps.filter(isDone)
  const open = steps.filter((s) => !isDone(s))
  const current = open[0] ?? null
  return { steps: [...steps], current, later: open.slice(1), finished, minutesTo: current?.at != null ? Math.round((current.at - now) / min) : null }
}

/** How a time-bound step reads against the clock: still ahead, in the last few minutes, or already past. */
export type StepTiming = 'none' | 'ahead' | 'soon' | 'past'
export const SOON_MINUTES = 15
export function timingOf(minutesTo: number | null): StepTiming {
  if (minutesTo === null) return 'none'
  return minutesTo < 0 ? 'past' : minutesTo <= SOON_MINUTES ? 'soon' : 'ahead'
}

/** The key of the sentence Stanley says for the current step: the "late" wording when its time has passed (every step with a time has one), otherwise the plain one. */
export function lineKey(mode: ModeId, step: ModeStep, timing: StepTiming): string {
  return timing === 'past' ? `stanley.mode.${mode}.${step.id}.late` : `stanley.mode.${mode}.${step.id}.line`
}
export const titleKey = (mode: ModeId, step: ModeStep): string => `stanley.mode.${mode}.${step.id}.title`

// The daily line (docs 13.4, H22 Briefing).
export type DailyKind = 'firstDay' | 'port' | 'tender' | 'sea' | 'lastDay'
export interface DailyInput { day: number; of: number; port: string; allAboard?: string | null; tender?: boolean }

/** One line for the top of the briefing: where the ship is and the one time that matters. */
export function dailyKind(i: DailyInput): DailyKind {
  if (i.day <= 1) return 'firstDay'
  if (i.day >= i.of) return 'lastDay'
  if (i.port === 'sea') return 'sea'
  return i.tender ? 'tender' : 'port'
}
export const dailyKey = (kind: DailyKind): string => `stanley.daily.${kind}`
