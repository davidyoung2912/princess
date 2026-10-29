import { addDays } from './timezones'
import { daysBetween } from './trip'
import type { NeedId } from './account'

/** Special assistance and accessibility requests (MNG-12) with the notice each one needs (the deadline tracker). Notice periods are authored (verify before real use). */
export type AssistId =
  | 'wheelchair' | 'tender' | 'accessibleEquipment'
  | 'assistiveListening' | 'largePrint'
  | 'cpap' | 'oxygen'
  | 'dietary' | 'serviceAnimal'

export interface AssistKind {
  id: AssistId
  group: 'mobility' | 'hearing' | 'vision' | 'medical' | 'dietary'
  /** The profile need this kind records when requested, if any. */
  need?: NeedId
  /** Days before sailing by which the request must be in. */
  noticeDays: number
  /** Whether a note is needed to make the request useful. */
  noteRequired: boolean
}

export const ASSIST_KINDS: readonly AssistKind[] = [
  { id: 'wheelchair', group: 'mobility', need: 'mobility', noticeDays: 30, noteRequired: false },
  { id: 'accessibleEquipment', group: 'mobility', need: 'mobility', noticeDays: 30, noteRequired: true },
  { id: 'tender', group: 'mobility', need: 'mobility', noticeDays: 7, noteRequired: false },
  { id: 'assistiveListening', group: 'hearing', need: 'hearing', noticeDays: 14, noteRequired: false },
  { id: 'largePrint', group: 'vision', need: 'vision', noticeDays: 14, noteRequired: false },
  { id: 'cpap', group: 'medical', need: 'cpap', noticeDays: 14, noteRequired: false },
  { id: 'oxygen', group: 'medical', need: 'oxygen', noticeDays: 30, noteRequired: true },
  { id: 'dietary', group: 'dietary', noticeDays: 14, noteRequired: true },
  { id: 'serviceAnimal', group: 'medical', need: 'serviceAnimal', noticeDays: 30, noteRequired: true },
]

export const assistKind = (id: unknown): AssistKind | undefined => ASSIST_KINDS.find((k) => k.id === id)

export type DeadlineState = 'open' | 'soon' | 'late'
/** "Request now" shows in the two weeks before the cut-off. */
export const SOON_DAYS = 14

export interface Deadline {
  /** Last day to ask, "YYYY-MM-DD". */
  by: string
  /** Days left; negative once past. */
  daysLeft: number
  state: DeadlineState
}

export function deadline(kind: AssistKind, departure: string, today: string): Deadline {
  const by = addDays(departure, -kind.noticeDays)
  const left = daysBetween(today, by)
  return { by, daysLeft: left, state: left < 0 ? 'late' : left <= SOON_DAYS ? 'soon' : 'open' }
}

export type RequestStatus = 'received' | 'confirmed' | 'late'
/** Guest Services confirms a request a day after it comes in (a pretend process). */
export const CONFIRM_AFTER_MS = 24 * 3_600_000

/** A request made after its cut-off is passed on, but cannot be promised. */
export function requestStatus(kind: AssistKind, departure: string, madeOn: string, at: number, now: number): RequestStatus {
  if (deadline(kind, departure, madeOn).state === 'late') return 'late'
  return now - at >= CONFIRM_AFTER_MS ? 'confirmed' : 'received'
}
