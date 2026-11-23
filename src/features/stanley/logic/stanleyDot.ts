import type { GuideReason, GuideView } from '../../../shared/api/guideTypes'
import { urgentReason } from '../../guide/logic/view'
import type { StanleyLevel } from '../../../shared/settings/settings'

/**
 * The speech dot on Stanley's buttons: shown only when the guide has an urgent reason (payment, check-in, documents, muster, bags) and Stanley's level is
 * Helpful or Chatty. Opening Stanley clears it for that reason; a different reason brings it back. Pure, so it is tested in node.
 */
export const dotReason = (view: GuideView | null, level: StanleyLevel): GuideReason | null =>
  level === 'helpful' || level === 'chatty' ? urgentReason(view) : null

export const dotShows = (reason: GuideReason | null, seen: ReadonlySet<GuideReason>): boolean => reason !== null && !seen.has(reason)

let reason: GuideReason | null = null
const seen = new Set<GuideReason>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

/** Home publishes the current reason (or null). */
export function publishDot(next: GuideReason | null): void { if (next !== reason) { reason = next; emit() } }
/** Opening Stanley marks the current reason as seen for this visit. */
export function dismissDot(): void { if (reason && !seen.has(reason)) { seen.add(reason); emit() } }
export const dotVisible = (): boolean => dotShows(reason, seen)
export const subscribeDot = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
