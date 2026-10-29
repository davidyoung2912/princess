import { MEDICAL_HOURS } from './safety'

/**
 * Health on board (SAF-03): Medical Center hours, the fee and insurance reminder, reporting illness early, and requests
 * for seasickness help, medicine and device power. Figures and wording are authored concept values (verify before real use).
 */
export type DayType = 'sea' | 'port'

export const VISIT_FEE = { visit: 13500, afterHours: 22500 } as const

export const SYMPTOMS = ['vomiting', 'diarrhoea', 'fever', 'cough', 'other'] as const
export type Symptom = (typeof SYMPTOMS)[number]

/** The symptoms that mean staying in the stateroom and telling the Medical Center at once. */
export const GASTRO: readonly Symptom[] = ['vomiting', 'diarrhoea']

export const REQUEST_KINDS = ['seasick', 'medication', 'devicePower'] as const
export type RequestKind = (typeof REQUEST_KINDS)[number]

export const isRequestKind = (v: unknown): v is RequestKind => REQUEST_KINDS.includes(v as RequestKind)
export const isSymptom = (v: unknown): v is Symptom => SYMPTOMS.includes(v as Symptom)

/** Hours a guest stays in the stateroom after the last symptom. */
export const ISOLATE_HOURS = 24
/** How long the isolation meal arrangement lasts from the report, if nothing else is said. */
export const ISOLATION_WINDOW_HOURS = 72

/** Typical minutes before a nurse calls or a request is answered. */
export const RESPONSE_MINUTES: Record<'illness' | RequestKind, number> = { illness: 15, seasick: 20, medication: 30, devicePower: 45 }

export const isolating = (reportedAts: readonly number[], now: number): boolean => reportedAts.some((at) => at <= now && now - at < ISOLATION_WINDOW_HOURS * 3_600_000)

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

/** Whether the Medical Center is open at a ship-time "HH:MM" on a type of day. */
export const medicalOpen = (day: DayType, time: string): boolean => MEDICAL_HOURS[day].some(([a, b]) => mins(time) >= mins(a) && mins(time) < mins(b))

/** When the Medical Center next opens today, or null if it has finished for the day. */
export function nextOpening(day: DayType, time: string): string | null {
  return MEDICAL_HOURS[day].map(([a]) => a).find((a) => mins(a) > mins(time)) ?? null
}

export type ReportProblem = 'noSymptoms' | 'badSymptom' | 'badStart' | 'noGuest'

/** Checks a report; `startedHoursAgo` is how long ago the first symptom began (0 to 96). */
export function reportProblem(guests: readonly string[], symptoms: readonly unknown[], startedHoursAgo: unknown): ReportProblem | null {
  if (guests.length === 0) return 'noGuest'
  if (symptoms.length === 0) return 'noSymptoms'
  if (!symptoms.every(isSymptom)) return 'badSymptom'
  if (typeof startedHoursAgo !== 'number' || !Number.isInteger(startedHoursAgo) || startedHoursAgo < 0 || startedHoursAgo > 96) return 'badStart'
  return null
}
