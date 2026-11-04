import type { JourneyStage } from '../routes/hubs'
import { urgentStep, type HomeFacts, type UrgentReason } from '../routes/stageHome'
import type { StanleyLevel } from '../settings/settings'

/**
 * The speech dot on Stanley's buttons: shown only when there is an urgent reason (payment, check-in, documents, muster, bags) and Stanley's level is
 * Helpful or Chatty. Opening Stanley clears it for that reason; a different reason brings it back. Pure, so it is tested in node.
 */
export const dotReason = (stage: JourneyStage, facts: HomeFacts, level: StanleyLevel): UrgentReason | null =>
  level === 'helpful' || level === 'chatty' ? urgentStep(stage, facts) : null

export const dotShows = (reason: UrgentReason | null, seen: ReadonlySet<UrgentReason>): boolean => reason !== null && !seen.has(reason)

let reason: UrgentReason | null = null
const seen = new Set<UrgentReason>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

/** Home publishes the current reason (or null). */
export function publishDot(next: UrgentReason | null): void { if (next !== reason) { reason = next; emit() } }
/** Opening Stanley marks the current reason as seen for this visit. */
export function dismissDot(): void { if (reason && !seen.has(reason)) { seen.add(reason); emit() } }
export const dotVisible = (): boolean => dotShows(reason, seen)
export const subscribeDot = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
