import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { clampZoom, momentumStep, pinchZoom } from '../../domain/deckFilter'

/**
 * Drag to pan with momentum and two-finger pinch to zoom, on top of a normal scrolling box (so keyboard scrolling and the zoom buttons keep working).
 * Momentum is skipped when the guest prefers reduced motion.
 */
export function usePanZoom() {
  const box = useRef<HTMLDivElement>(null)
  const [zoom, setZoomState] = useState(1)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)
  const last = useRef<{ x: number; t: number } | null>(null)
  const velocity = useRef(0)
  const raf = useRef(0)
  const setZoom = useCallback((z: number) => setZoomState(clampZoom(z)), [])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const distance = () => { const [a, b] = [...pointers.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    cancelAnimationFrame(raf.current)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) pinch.current = { dist: distance(), zoom }
    last.current = { x: e.clientX, t: e.timeStamp }
    velocity.current = 0
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !box.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) { setZoomState(pinchZoom(pinch.current.zoom, pinch.current.dist, distance())); return }
    if (e.pointerType === 'touch' || !last.current) return // touch already scrolls natively
    const dx = e.clientX - last.current.x
    box.current.scrollLeft -= dx
    velocity.current = -dx
    last.current = { x: e.clientX, t: e.timeStamp }
  }
  const end = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size > 0 || e.pointerType === 'touch') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced') return
    const tick = () => {
      const s = momentumStep(velocity.current)
      if (box.current) box.current.scrollLeft += s.move
      velocity.current = s.velocity
      if (s.velocity !== 0) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }
  return { box, zoom, setZoom, handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end } }
}
