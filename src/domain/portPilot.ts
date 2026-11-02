import { LAST_TENDER_MINUTES, type PortDay } from './allaboard'
import type { StringKey } from '../i18n'

/**
 * The Port Day Pilot (S6A-01, S6A-04, S6A-15): one plan for the port day, worked backward from the all-aboard time in ship time.
 * Walks, queues and buffers are authored concept values (verify before real use). Nothing here reads a position.
 */
export const BUFFER_CHOICES = [30, 45, 60] as const
export type BufferChoice = (typeof BUFFER_CHOICES)[number]
export const DEFAULT_BUFFER: BufferChoice = 45

/** Minutes from the pier gate to the gangway, and from the first tender landing to stepping ashore. */
export const GATE_WALK_MINUTES = 15
export const TENDER_RIDE_MINUTES = 20
/** After the ship ties up, the first guests step ashore about this long later. */
export const PIER_OPEN_MINUTES = 30

export type CrowdLevel = 'quiet' | 'moderate' | 'busy'
/** Queue to get back in, by crowd; a tender queue is longer. */
export const RETURN_QUEUE: Record<CrowdLevel, { pier: number; tender: number }> = {
  quiet: { pier: 5, tender: 10 },
  moderate: { pier: 15, tender: 25 },
  busy: { pier: 30, tender: 45 },
}

export interface PilotInput {
  day: Pick<PortDay, 'allAboardAt' | 'arriveAt' | 'tender'>
  /** Minutes one way from the landing to where the guest is going; 0 for a walk on the pier. */
  travelMinutes: number
  /** Minutes the guest wants at the destination, or null for "as long as there is". */
  outingMinutes: number | null
  buffer: number
  crowd: CrowdLevel
  /** When the guest's tender group is called (tender days). */
  tenderCallAt?: number | null
  /** Minutes the whole tender operation is late. */
  tenderDelayMinutes?: number
}

export type PilotStepId = 'ashore' | 'start' | 'leave' | 'landing' | 'lastTender' | 'aboard'
export interface PilotStep { id: PilotStepId; at: number }

export interface PilotPlan {
  /** When the guest should be setting off from the destination: the number to remember. */
  leaveBy: number
  /** When the guest should be at the landing (pier gate or tender queue). */
  landingBy: number
  /** The earliest the guest can be on shore. */
  ashoreAt: number
  /** When the guest can reach the destination. */
  startAt: number
  /** Minutes at the destination between arriving and having to leave. May be negative. */
  minutesThere: number
  /** Whether the outing fits; always true with no outing length given. */
  fits: boolean
  /** Minutes the outing is short by, zero when it fits. */
  shortBy: number
  steps: PilotStep[]
  allAboardAt: number
  lastTenderAt: number | null
}

/** The leave-by time worked backward: all-aboard, the safety buffer, the walk to the gangway, the return queue (and the last tender), and the trip back. */
export function planPortDay(i: PilotInput): PilotPlan {
  const tender = i.day.tender
  const queue = tender ? RETURN_QUEUE[i.crowd].tender : RETURN_QUEUE[i.crowd].pier
  const buffer = Math.max(0, i.buffer)
  const travel = Math.max(0, i.travelMinutes)
  const lastTenderAt = tender ? i.day.allAboardAt - LAST_TENDER_MINUTES * 60_000 : null
  const delay = Math.max(0, i.tenderDelayMinutes ?? 0)
  const landingBy = tender
    ? lastTenderAt! - (queue + buffer) * 60_000
    : i.day.allAboardAt - (GATE_WALK_MINUTES + queue + buffer) * 60_000
  const leaveBy = landingBy - travel * 60_000
  const ashoreAt = tender
    ? (i.tenderCallAt ?? i.day.arriveAt + PIER_OPEN_MINUTES * 60_000) + (delay > 0 && i.tenderCallAt == null ? delay * 60_000 : 0) + TENDER_RIDE_MINUTES * 60_000
    : i.day.arriveAt + PIER_OPEN_MINUTES * 60_000
  const startAt = ashoreAt + travel * 60_000
  const minutesThere = Math.round((leaveBy - startAt) / 60_000)
  const needed = i.outingMinutes ?? 0
  const fits = minutesThere >= needed && minutesThere > 0
  const steps: PilotStep[] = [
    { id: 'ashore', at: ashoreAt },
    ...(travel > 0 ? [{ id: 'start' as const, at: startAt }] : []),
    { id: 'leave', at: leaveBy },
    { id: 'landing', at: landingBy },
    ...(lastTenderAt !== null ? [{ id: 'lastTender' as const, at: lastTenderAt }] : []),
    { id: 'aboard', at: i.day.allAboardAt },
  ]
  return { leaveBy, landingBy, ashoreAt, startAt, minutesThere, fits, shortBy: fits ? 0 : Math.max(0, needed - minutesThere), steps, allAboardAt: i.day.allAboardAt, lastTenderAt }
}

/** The latest a guest can start out for the destination and still do `outingMinutes` there and be back safely. Null when it cannot be done. */
export function latestStart(i: PilotInput): number | null {
  if (i.outingMinutes === null) return null
  const p = planPortDay(i)
  const latest = p.leaveBy - i.outingMinutes * 60_000 - i.travelMinutes * 60_000
  return latest >= p.ashoreAt ? latest : null
}

// ---- Plan B (S6A-04) ----

export type PlanBTrigger = 'rain' | 'heat' | 'tender' | 'energy'
export const PLAN_B_TRIGGERS: readonly PlanBTrigger[] = ['rain', 'heat', 'tender', 'energy']

export interface PlanB { id: PlanBTrigger; title: string; detail: string; /** Whether it keeps everyone close to the ship. */ nearShip: boolean }

/** A plan B for each trigger, per port. Authored sample suggestions. */
export const PLAN_B: Record<'cozumel' | 'belize' | 'roatan', Record<PlanBTrigger, PlanB>> = {
  cozumel: {
    rain: { id: 'rain', title: 'Covered shops and a museum', detail: 'The pier shops are under cover. The island museum is a short taxi ride and takes about 90 minutes.', nearShip: true },
    heat: { id: 'heat', title: 'A beach club with shade', detail: 'Pick a club with a shaded area and a pool. Go before midday and be back at the pier by early afternoon.', nearShip: false },
    tender: { id: 'tender', title: 'Stay at the pier', detail: 'Cozumel has a pier, so a tender change is unlikely. If it happens, shop and eat near the landing and keep the plan short.', nearShip: true },
    energy: { id: 'energy', title: 'A slow morning ashore', detail: 'Walk the pier shops, have a long lunch with a seat, and go back to the ship early for the pool.', nearShip: true },
  },
  belize: {
    rain: { id: 'rain', title: 'Indoor museum and market', detail: 'The Tourism Village at the landing has covered shops and cafes. A short taxi ride reaches the Museum of Belize.', nearShip: true },
    heat: { id: 'heat', title: 'Morning tour, afternoon aboard', detail: 'Do a morning tour that is back by noon, then use the ship’s pool when the sun is highest.', nearShip: true },
    tender: { id: 'tender', title: 'Keep it inside the village', detail: 'If tenders run late, stay at the Tourism Village near the landing and take the first tender back after your lunch.', nearShip: true },
    energy: { id: 'energy', title: 'A short, seated outing', detail: 'A river or harbour boat ride with seats, or lunch at the village, then back on an early tender.', nearShip: true },
  },
  roatan: {
    rain: { id: 'rain', title: 'The pier shops and a cafe', detail: 'The pier area has covered shops and cafes. Wildlife parks may stay open in light rain; ask before you go.', nearShip: true },
    heat: { id: 'heat', title: 'Shaded wildlife park or a beach', detail: 'The wildlife park is mostly in shade. At the beach, hire a shaded chair and drink water often.', nearShip: false },
    tender: { id: 'tender', title: 'Weather switch to a tender', detail: 'In rough weather the ship may tender instead of docking. Stay near the landing, and use the tender planner above.', nearShip: true },
    energy: { id: 'energy', title: 'Beach by the pier', detail: 'Walk to the beach by the pier, rent a chair and stay close. Nothing to book.', nearShip: true },
  },
}

/** The plan B worth showing first: a late tender or a weather switch points at the tender plan, otherwise none is pushed. */
export function recommendedPlanB(i: { tenderDelayMinutes: number; tenderInstead: boolean; tender: boolean }): PlanBTrigger | null {
  if (i.tenderInstead || (i.tender && i.tenderDelayMinutes > 0)) return 'tender'
  return null
}

// ---- Tender day card (S6A-15) ----

/** What to do at the landing if a guest cannot manage steps; the tender crew cannot lift a wheelchair. */
export const ACCESSIBLE_TENDER_STEPS: readonly StringKey[] = ['pilot.accessible.ask', 'pilot.accessible.priority', 'pilot.accessible.crew', 'pilot.accessible.stay']

const STEP_LABEL: Record<PilotStepId, StringKey> = {
  ashore: 'pilot.step.ashore', start: 'pilot.step.start', leave: 'pilot.step.leave', landing: 'pilot.step.landing', lastTender: 'pilot.step.lastTender', aboard: 'pilot.step.aboard',
}
export const pilotStepLabel = (id: PilotStepId): StringKey => STEP_LABEL[id]
