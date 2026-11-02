import type { Interest } from './excursions'
import type { EventInterest } from './program'

/**
 * What a guest wants from a day (PRE-12, "Build my day"). The day itself is built by the server (`POST /me/day-plan`, `feeds/dayPlan.ts`); the same wishes
 * always give the same day.
 */
export type Mobility = 'any' | 'easy' | 'wheelchair'

export interface DayWish {
  tours: readonly Interest[]
  events: readonly EventInterest[]
  mobility: Mobility
  /** Children are in the party: suggest family events and tours, not adults-only ones. */
  withKids: boolean
  /** Most to spend on a tour per adult in whole dollars, or null for no limit. */
  maxTour: number | null
}

export const NO_WISH: DayWish = { tours: [], events: [], mobility: 'any', withKids: false, maxTour: null }
