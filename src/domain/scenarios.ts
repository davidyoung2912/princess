import type { ApiErrorCode } from '../api/errors'
import type { StageId } from './sailings'

/** A rule that makes some mock calls fail: the first `failTimes` matching calls, then the call recovers. */
export interface FaultRule {
  id: string
  /** "group.method", or "group.*" for every method of a group, or "*" for every call. */
  target: string
  code: ApiErrorCode
  /** How many matching calls fail before recovery; Infinity never recovers. */
  failTimes: number
  /** Extra waiting before the call answers or fails. */
  delayMs?: number
}

export type ScenarioId =
  | 'bookingLag' | 'checkinDrop' | 'dinnerReschedule' | 'orderStock' | 'planChange'
  | 'belizeTender' | 'clockChange' | 'portSkipped' | 'lateInPort' | 'phoneDead'
  | 'illness' | 'packageRise' | 'terminalChange' | 'photoFail' | 'childMissing' | 'chatSlow'

export interface Scenario {
  id: ScenarioId
  /** The requirement ids it exercises (§23.5). */
  refs: string
  /** The journey stage that shows it best; "load" jumps the demo clock here. */
  stage: StageId
  /** Who it can be steered at: everyone, or only a trip with a child on it. */
  audience: 'all' | 'family'
  faults: readonly FaultRule[]
}

/** The failure and risk scenarios from requirements §23.5. Data effects arrive with the phases that build each feature; the fault rules work now. */
export const SCENARIOS: readonly Scenario[] = [
  { id: 'bookingLag', refs: 'MNG-01, MNG-18, PERF-06', stage: 'booked', audience: 'all', faults: [{ id: 'bookingLag.get', target: 'bookings.get', code: 'notFound', failTimes: 2 }] },
  { id: 'checkinDrop', refs: 'CHK-02, CHK-13, NET-03', stage: 'checkIn', audience: 'all', faults: [{ id: 'checkinDrop.save', target: 'checkin.save', code: 'network', failTimes: 1 }, { id: 'checkinDrop.submit', target: 'checkin.submit', code: 'network', failTimes: 1 }] },
  { id: 'dinnerReschedule', refs: 'DIN-10', stage: 'seaDay', audience: 'all', faults: [{ id: 'dinnerReschedule.plan', target: 'plan.dining.move', code: 'server', failTimes: 1 }] },
  { id: 'orderStock', refs: 'DIN-11', stage: 'seaDay', audience: 'all', faults: [] },
  { id: 'planChange', refs: 'OB-08', stage: 'seaDay', audience: 'all', faults: [] },
  { id: 'belizeTender', refs: 'POR-04, POR-12', stage: 'portDay', audience: 'all', faults: [] },
  { id: 'clockChange', refs: 'POR-11, POR-02', stage: 'portDay', audience: 'all', faults: [] },
  { id: 'portSkipped', refs: 'MNG-15, SUP-06', stage: 'portDay', audience: 'all', faults: [] },
  { id: 'lateInPort', refs: 'POR-02, POR-08', stage: 'portDay', audience: 'all', faults: [] },
  { id: 'phoneDead', refs: 'CHK-14', stage: 'embarkation', audience: 'all', faults: [{ id: 'phoneDead.all', target: '*', code: 'offline', failTimes: Infinity }] },
  { id: 'terminalChange', refs: 'CHK-15', stage: 'embarkation', audience: 'all', faults: [] },
  { id: 'illness', refs: 'SAF-03', stage: 'seaDay', audience: 'all', faults: [] },
  { id: 'packageRise', refs: 'PRE-17', stage: 'preCruise', audience: 'all', faults: [] },
  { id: 'photoFail', refs: 'SHP-07', stage: 'farewell', audience: 'all', faults: [{ id: 'photoFail.download', target: 'photos.download', code: 'network', failTimes: 1 }] },
  { id: 'childMissing', refs: 'SAF-05, SUP-08', stage: 'seaDay', audience: 'family', faults: [] },
  { id: 'chatSlow', refs: 'MSG-02, SUP-08', stage: 'seaDay', audience: 'all', faults: [{ id: 'chatSlow.send', target: 'messages.send', code: 'timeout', failTimes: 1, delayMs: 6000 }, { id: 'chatSlow.service', target: 'service.send', code: 'timeout', failTimes: 1, delayMs: 6000 }] },
]

export const scenarioById = (id: unknown): Scenario | undefined => SCENARIOS.find((s) => s.id === id)

/** Whether a scenario can be steered at this trip: `party` is everyone on it. */
export const appliesTo = (s: Scenario, party: readonly { child: boolean }[]): boolean => s.audience === 'all' || party.some((p) => p.child)

/** All fault rules of the scenarios that are switched on. */
export const activeFaults = (active: readonly string[]): FaultRule[] => SCENARIOS.filter((s) => active.includes(s.id)).flatMap((s) => s.faults)

/** Whether a rule's target covers a call such as "bookings.get". */
export function targetMatches(target: string, call: string): boolean {
  if (target === '*') return true
  if (target.endsWith('.*')) return call.startsWith(target.slice(0, -1))
  return target === call
}
