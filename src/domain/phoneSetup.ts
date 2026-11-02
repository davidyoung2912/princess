import type { StageId } from './sailings'
import { planById, PLANS, type WifiPlan } from './wifi'

/**
 * Phone setup and the bill-shock guard (XT-01, S3-07): what to do before sailing so the phone does not roam at sea,
 * when to remind the guest, and a coach for ship Wi-Fi data use. Guidance only: nothing here reads the phone's settings.
 */
export type PhoneStepId = 'airplane' | 'roaming' | 'wifi' | 'messages' | 'backup' | 'calls'

export interface PhoneStep { id: PhoneStepId; /** When it is best done. */ when: 'before' | 'boarding' | 'aboard' }

export const PHONE_STEPS: readonly PhoneStep[] = [
  { id: 'roaming', when: 'before' },
  { id: 'backup', when: 'before' },
  { id: 'airplane', when: 'boarding' },
  { id: 'wifi', when: 'aboard' },
  { id: 'messages', when: 'aboard' },
  { id: 'calls', when: 'aboard' },
]

/** The moments worth a reminder. */
export type RoamingMoment = 'none' | 'beforeSailing' | 'sailAway' | 'atSea' | 'inPort'

const MOMENTS: Partial<Record<StageId, RoamingMoment>> = {
  preCruise: 'beforeSailing', checkIn: 'beforeSailing', embarkation: 'sailAway', seaDay: 'atSea', seaDay2: 'atSea', farewell: 'atSea', cozumel: 'inPort', belize: 'inPort', roatan: 'inPort',
}

/** Which reminder fits the stage: before sailing, at sail-away, on sea days, and in port where a local network can connect without warning. */
export const roamingMoment = (stage: StageId): RoamingMoment => MOMENTS[stage] ?? 'none'

/** Steps done, kept as a plain list of ids. Unknown ids are dropped. */
export function normalizeDone(raw: unknown): PhoneStepId[] {
  const known = new Set(PHONE_STEPS.map((s) => s.id))
  return Array.isArray(raw) ? [...new Set(raw.filter((x): x is PhoneStepId => typeof x === 'string' && known.has(x as PhoneStepId)))] : []
}

export const toggleStep = (done: readonly PhoneStepId[], id: PhoneStepId): PhoneStepId[] => (done.includes(id) ? done.filter((x) => x !== id) : [...done, id])

export type WifiLevel = 'fine' | 'near' | 'over' | 'unlimited'
export interface WifiAdvice { level: WifiLevel; percent: number; upgradeTo: WifiPlan | null }

/** How a device is doing against its plan. Near means 80% or more; the suggestion is the next plan up, or none when there is no higher one or no cap. */
export function wifiAdvice(plan: WifiPlan, usedMb: number): WifiAdvice {
  const def = planById(plan)
  if (!def || def.capMb === null) return { level: 'unlimited', percent: 0, upgradeTo: null }
  const percent = Math.floor((usedMb / def.capMb) * 100)
  const level: WifiLevel = usedMb > def.capMb ? 'over' : percent >= 80 ? 'near' : 'fine'
  const next = PLANS.find((p) => p.rank > def.rank)
  return { level, percent, upgradeTo: level === 'fine' ? null : next?.id ?? null }
}
