import { TOUR_STEPS } from '../../features/tour/logic/steps'
import { markTourIn, resetTourIn } from './hintsState'
import { getHints, hintsLoaded, subscribeHints, updateHints } from './hints'

/** The tour steps the signed-in guest has already been shown. These are kept on their account, so they follow them to every device. */
export const loadTourSeen = (): readonly string[] => getHints().tour

/** Whether the guest has asked for the guided tour. It is on unless it has been turned off. */
export const loadTourOn = (): boolean => getHints().tourOn

/** True once the account's copy has arrived, so a step dismissed on another device is known before the tour starts. */
export const tourReady = hintsLoaded

export const subscribeTour = subscribeHints

/** Remembers that a step has been dismissed. */
export function markTourStep(id: string): void { updateHints((h) => markTourIn(h, [id])) }

/** Skips the rest of the tour: every step counts as seen. */
export function skipTour(): void { updateHints((h) => markTourIn(h, TOUR_STEPS.map((s) => s.id))) }

/** Brings the whole tour back. */
export function resetTour(): void { updateHints(resetTourIn) }
