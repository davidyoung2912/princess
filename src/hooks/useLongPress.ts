import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'

/** How long a finger must stay down, and how far it may drift, for a press to count as a long press. */
export const LONG_PRESS_MS = 500
export const LONG_PRESS_SLOP_PX = 10

/**
 * A long press with a finger (touch pointers only: a mouse keeps normal text selection, and a keyboard has its own button). Moving, lifting or a scroll starting cancels it.
 * Returns handlers to spread onto the pressed element; `onLong` is called once per press.
 */
export function useLongPress(onLong: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const latest = useRef(onLong)
  useEffect(() => { latest.current = onLong })
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    start.current = null
  }, [])
  useEffect(() => cancel, [cancel])
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      cancel()
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(() => { timer.current = null; start.current = null; latest.current() }, LONG_PRESS_MS)
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > LONG_PRESS_SLOP_PX) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
  }
}
