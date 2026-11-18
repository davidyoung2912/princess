import type { Side } from './placement'

/** One stop on the first-visit tour: a part of the screen (found by its `data-tour` mark), what it is called and what to say about it. */
export interface TourStep {
  /** Stable id, saved on the device once the guest has said Got It!. */
  id: string
  /** The `data-tour` value of the part of the screen to point at. */
  target: string
  /** Which side of the target the card would like to sit on. */
  side: Side
  /** The icon shown beside the title (a key into the tour's icon table). */
  icon: 'nav' | 'search' | 'stanley' | 'help' | 'menu' | 'date' | 'header' | 'tip'
}

/**
 * The tour, in the order it is told. Each step's words are `tour.<id>.title` and `tour.<id>.body`. A step whose part of the screen is not
 * showing at this size or on this page is passed over (and shown later if it turns up, such as the tip card on a page that has one).
 */
export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'date', target: 'date', side: 'bottom', icon: 'date' },
  { id: 'header', target: 'header', side: 'bottom', icon: 'header' },
  { id: 'tip', target: 'tip', side: 'bottom', icon: 'tip' },
  { id: 'nav', target: 'nav', side: 'right', icon: 'nav' },
  { id: 'search', target: 'search', side: 'right', icon: 'search' },
  { id: 'stanley', target: 'stanley', side: 'right', icon: 'stanley' },
  { id: 'help', target: 'help', side: 'right', icon: 'help' },
  { id: 'menu', target: 'menu', side: 'bottom', icon: 'menu' },
]

/** The first step not yet seen whose target can be shown now (`visible` says so), or null when there is none. */
export function nextStep(seen: readonly string[], visible: (target: string) => boolean): TourStep | null {
  return TOUR_STEPS.find((s) => !seen.includes(s.id) && visible(s.target)) ?? null
}
