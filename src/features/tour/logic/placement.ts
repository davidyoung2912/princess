/** Where a floating tip card goes beside the part of the screen it explains. Plain geometry, so it can be tested without a browser. */

export interface Box { left: number; top: number; width: number; height: number }
export type Side = 'top' | 'bottom' | 'left' | 'right'

export interface Placement {
  left: number
  top: number
  /** Which side of the target the card sits on; `over` when nothing fits beside it and the card overlaps the target's edge. */
  side: Side | 'over'
  /** How far along the card's edge the pointer sits, in px (0 when there is no pointer). */
  arrow: number
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

/** The sides to try, best first: the preferred one, its opposite, then the other two. */
export const sideOrder = (prefer: Side): Side[] => {
  const across: Side[] = prefer === 'top' || prefer === 'bottom' ? ['left', 'right'] : ['top', 'bottom']
  return [prefer, OPPOSITE[prefer], ...across]
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(n, Math.max(lo, hi)))

/**
 * Puts a card of the given size beside the target, on the first side with room for it (the preferred side first), keeping `margin` clear of the
 * screen edges and `gap` clear of the target. The card is slid along that side to line up with the target's middle but never off screen, and the
 * pointer is aimed back at the target's middle. When no side has room (a target as big as the screen) the card sits low over the target.
 */
export function placeCard(target: Box, card: { width: number; height: number }, view: { width: number; height: number }, prefer: Side = 'bottom', gap = 16, margin = 12): Placement {
  const maxLeft = view.width - margin - card.width
  const maxTop = view.height - margin - card.height
  const midX = target.left + target.width / 2
  const midY = target.top + target.height / 2
  for (const side of sideOrder(prefer)) {
    let left: number
    let top: number
    if (side === 'top' || side === 'bottom') {
      left = clamp(midX - card.width / 2, margin, maxLeft)
      top = side === 'bottom' ? target.top + target.height + gap : target.top - gap - card.height
      if (top < margin || top > maxTop) continue
      return { left, top, side, arrow: clamp(midX - left, 20, card.width - 20) }
    }
    top = clamp(midY - card.height / 2, margin, maxTop)
    left = side === 'right' ? target.left + target.width + gap : target.left - gap - card.width
    if (left < margin || left > maxLeft) continue
    return { left, top, side, arrow: clamp(midY - top, 20, card.height - 20) }
  }
  return { left: clamp(midX - card.width / 2, margin, maxLeft), top: maxTop, side: 'over', arrow: 0 }
}

/** The target grown by `pad` on every side, kept on screen: the glass has a hole this shape. */
export function spotlight(target: Box, view: { width: number; height: number }, pad = 6): Box {
  const left = Math.max(0, target.left - pad)
  const top = Math.max(0, target.top - pad)
  const right = Math.min(view.width, target.left + target.width + pad)
  const bottom = Math.min(view.height, target.top + target.height + pad)
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}
