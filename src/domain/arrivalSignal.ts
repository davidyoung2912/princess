import { arrivalPing } from './arrivalPing'
import type { StageId } from './sailings'

/**
 * One-time arrival signals for a travelling party (GTS-10): "departed", "arrived" or "at the meeting point". Each is one tap that sends one line,
 * once, and is never a live location. Signals can only be sent before the ship is boarded, and are no longer shown once embarkation has begun.
 */
export const SIGNAL_KINDS = ['departed', 'arrived', 'atMeetingPoint'] as const
export type SignalKind = (typeof SIGNAL_KINDS)[number]

export interface ArrivalSignal { kind: SignalKind; at: number }

export const isSignalKind = (v: unknown): v is SignalKind => SIGNAL_KINDS.some((k) => k === v)

/** Whether signals are still open: only while the trip has not reached embarkation. */
export const signalsOpen = (stage: StageId, shipAt: string | null = null): boolean => arrivalPing(stage, shipAt) === 'before'

/** Sends one signal. A kind already sent is not sent twice (the earlier one stands); nothing is added once signals have closed. */
export function sendSignal(list: readonly ArrivalSignal[], kind: SignalKind, now: number, open: boolean): ArrivalSignal[] {
  if (!open || list.some((s) => s.kind === kind)) return [...list]
  return [...list, { kind, at: now }]
}

/** The signals still shown: none once embarkation has begun. */
export const liveSignals = (list: readonly ArrivalSignal[], open: boolean): ArrivalSignal[] => (open ? [...list] : [])

export function normalizeSignals(raw: unknown): ArrivalSignal[] {
  if (!Array.isArray(raw)) return []
  const out: ArrivalSignal[] = []
  for (const x of raw) {
    const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>
    if (isSignalKind(o.kind) && typeof o.at === 'number' && Number.isFinite(o.at) && !out.some((s) => s.kind === o.kind)) out.push({ kind: o.kind, at: o.at })
  }
  return out
}
