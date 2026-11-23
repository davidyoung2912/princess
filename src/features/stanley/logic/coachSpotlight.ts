import type { CoachScreen } from './stanleyMoments'

/** Where a tour step points: the first selector that finds something in the page, and optionally the nearest ancestor of it to light up instead. */
export interface CoachTarget {
  selectors: readonly string[]
  /** A selector for an ancestor of the match to spotlight (when the match is only a part of the thing worth showing). */
  up?: string
}

const aria = (id: string) => `section[aria-labelledby="${id}"]`

/** The spotlight target of each step, in order (steps 1, 2, 3). A step with no match is shown centred without a hole, so a change to a screen never breaks the tour. */
export const COACH_TARGETS: Readonly<Record<CoachScreen, readonly CoachTarget[]>> = {
  P34: [{ selectors: ['.build-list'] }, { selectors: [aria('day-pick-h')] }, { selectors: [aria('day-plan-h')] }],
  S01: [{ selectors: [aria('deck-h')] }, { selectors: ['#map-search'], up: '.field' }, { selectors: ['#map-here'], up: '.field' }],
  H31: [{ selectors: ['.pass-list'] }, { selectors: [aria('keep-h')] }, { selectors: ['.pass-list .pass button', '.pass-list'] }],
  S37: [{ selectors: ['.clocks'], up: 'section, .card' }, { selectors: ['.clocks'] }, { selectors: [aria('tender-h'), aria('tours-h')] }],
  M10: [{ selectors: [aria('lines-h')] }, { selectors: ['.bill-table', aria('lines-h')] }, { selectors: [aria('total-h')] }],
}

/** Finds the element a step points at, or null. */
export function findCoachTarget(root: ParentNode, target: CoachTarget | undefined): HTMLElement | null {
  if (!target) return null
  for (const sel of target.selectors) {
    const el = root.querySelector<HTMLElement>(sel)
    if (!el) continue
    return (target.up ? el.parentElement?.closest<HTMLElement>(target.up) : null) ?? el
  }
  return null
}

export interface Box { top: number; left: number; width: number; height: number }

/** The lit area: the element's box, grown by `pad` and kept inside the viewport. */
export function holeBox(r: Box, pad: number, vw: number, vh: number): Box {
  const left = Math.max(0, r.left - pad)
  const top = Math.max(0, r.top - pad)
  const right = Math.min(vw, r.left + r.width + pad)
  const bottom = Math.min(vh, r.top + r.height + pad)
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

/** Which side the note goes on, so it never covers what it points at: below when there is room, else above, else it sits over the bottom of the screen. */
export function notePlacement(hole: Box | null, vh: number, noteHeight: number): 'below' | 'above' | 'bottom' {
  if (!hole) return 'bottom'
  const gap = 12
  if (hole.top + hole.height + gap + noteHeight <= vh) return 'below'
  if (hole.top - gap - noteHeight >= 0) return 'above'
  return 'bottom'
}
