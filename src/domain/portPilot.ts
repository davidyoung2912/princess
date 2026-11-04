import { LAST_TENDER_MINUTES, type PortDay } from './allaboard'
import type { StringKey } from '../i18n'
import type { PortKnowledge } from './portContent'

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

/** A plan B for each trigger, for the ports that have an authored one. Served with the port reference (`portsServed.ts`). */
export const PLAN_B: Record<string, Record<PlanBTrigger, PlanB>> = {}

/** Replaces the authored plans in place, so earlier imports see the served values. */
export function replacePlanB(next: Record<string, Record<PlanBTrigger, PlanB>>): void {
  for (const k of Object.keys(PLAN_B)) delete PLAN_B[k]
  Object.assign(PLAN_B, next)
}

/**
 * The plan B for any port. The three first ports have authored suggestions; every other port gets one built only from that port's own walks and
 * day passes (no invented places), and a plain line where the port has none. Tender wording follows the landing.
 */
export function planBFor(port: string, k: PortKnowledge | undefined, tender: boolean): Record<PlanBTrigger, PlanB> {
  const authored = PLAN_B[port]
  if (authored) return authored
  const walk = k?.walks[0]
  const pass = k?.dayPasses.find((d) => d.crowd !== 'busy') ?? k?.dayPasses[0]
  const near = walk ? `${walk.name} is about ${walk.minutes} minutes. Seating: ${walk.sit}. Restrooms: ${walk.restroom}.` : 'Stay close to the landing and ask the shore excursions desk what is near.'
  return {
    rain: { id: 'rain', title: 'Stay under cover near the ship', detail: `Keep to covered places close to the landing and ask what stays open in the rain. ${near}`, nearShip: true },
    heat: { id: 'heat', title: 'Go early, rest in the shade', detail: pass ? `Go before midday and be back aboard by early afternoon. ${pass.name} (${pass.distance}) is the quieter choice.` : 'Go before midday, carry water, rest in shade and be back aboard by early afternoon.', nearShip: false },
    tender: tender
      ? { id: 'tender', title: 'Keep it short near the landing', detail: 'If tenders run late, stay near the landing, have lunch there and take an early tender back. Use the tender planner above.', nearShip: true }
      : { id: 'tender', title: 'Stay at the pier', detail: 'If the ship has to tender instead of docking, stay near the landing and keep the plan short. Use the tender planner above.', nearShip: true },
    energy: { id: 'energy', title: 'A slow, seated outing', detail: walk ? `${walk.name}: step ${walk.step}; accessible ${walk.accessible}. Have a long lunch with a seat and go back to the ship early.` : 'Have a long lunch with a seat near the landing and go back to the ship early for the pool.', nearShip: true },
  }
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
