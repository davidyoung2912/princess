import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

/** The picture on screen: card width in pixels, and where the top left of the board sits (zero or negative when zoomed in). */
export interface View { cw: number; x: number; y: number }

interface Options {
  /** The board's width and height in card widths, so everything scales with one number. */
  kx: number
  ky: number
  /** The most the view's height can be, in pixels. */
  maxHeight: number
  /** A comfortable card width to open at on a small screen. */
  startCw: number
  maxCw: number
}

/**
 * Pinch to zoom and drag to pan for a board bigger than the screen: two fingers zoom about their midpoint, one finger drags, the mouse wheel zooms about the pointer, and the
 * buttons (`zoomBy`, `fit`) do the same for people who cannot pinch. A tap that does not move still reaches the card under it.
 */
export function usePanZoom({ kx, ky, maxHeight, startCw, maxCw }: Options): {
  ref: RefObject<HTMLDivElement | null>
  view: View
  height: number
  glide: boolean
  fitCw: number
  handlers: { onPointerDown: (e: ReactPointerEvent) => void; onPointerMove: (e: ReactPointerEvent) => void; onPointerUp: (e: ReactPointerEvent) => void; onPointerCancel: (e: ReactPointerEvent) => void }
  zoomBy: (factor: number) => void
  fit: () => void
  /** Slides so the box (in card widths from the board's top left) is in view, centring it if it is not. */
  reveal: (x: number, y: number, w: number, h: number) => void
  /** True just after a drag or pinch, so the click that follows it is not taken as a tap. */
  dragged: () => boolean
} {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [view, setView] = useState<View>({ cw: startCw, x: 0, y: 0 })
  const [glide, setGlide] = useState(false)
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])
  const fitCw = width > 0 ? width / kx : startCw
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const g = useRef<{ mode: 'none' | 'pan' | 'pinch'; sx: number; sy: number; vx: number; vy: number; moved: boolean; d0: number; cw0: number; mx: number; my: number }>({ mode: 'none', sx: 0, sy: 0, vx: 0, vy: 0, moved: false, d0: 1, cw0: 1, mx: 0, my: 0 })
  const lastDrag = useRef(0)

  const heightFor = useCallback((cw: number) => Math.min(ky * cw, maxHeight), [ky, maxHeight])

  /** Keeps the board where it can be seen: centred when it is smaller than the view, never dragged past an edge when it is bigger. */
  const clamp = useCallback((v: View, w = width): View => {
    const cw = Math.min(maxCw, Math.max(w > 0 ? w / kx : 1, v.cw))
    const cx = kx * cw, cy = ky * cw
    const h = heightFor(cw)
    const x = cx <= w ? (w - cx) / 2 : Math.min(0, Math.max(w - cx, v.x))
    const y = cy <= h ? (h - cy) / 2 : Math.min(0, Math.max(h - cy, v.y))
    return { cw, x, y }
  }, [width, kx, ky, maxCw, heightFor])

  /* Measure the width, and open at a readable size: the whole board if it fits, else the starting size. */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      setWidth(w)
      setView((v) => {
        const first = v.cw === startCw && v.x === 0 && v.y === 0
        const cw = first ? Math.min(maxCw, Math.max(w / kx, startCw)) : v.cw
        return clampTo({ cw, x: first ? 0 : v.x, y: first ? 0 : v.y }, w)
      })
    }
    const clampTo = (v: View, w: number) => {
      const cw = Math.min(maxCw, Math.max(w / kx, v.cw))
      const cx = kx * cw, cy = ky * cw, h = Math.min(ky * cw, maxHeight)
      return { cw, x: cx <= w ? (w - cx) / 2 : Math.min(0, Math.max(w - cx, v.x)), y: cy <= h ? (h - cy) / 2 : Math.min(0, Math.max(h - cy, v.y)) }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [kx, ky, maxCw, maxHeight, startCw])

  const zoomAbout = useCallback((px: number, py: number, factor: number) => {
    const v = viewRef.current
    const cw = Math.min(maxCw, Math.max(fitCw, v.cw * factor))
    const r = cw / v.cw
    setView(clamp({ cw, x: px - (px - v.x) * r, y: py - (py - v.y) * r }))
  }, [clamp, fitCw, maxCw])

  /* The wheel zooms about the pointer. It needs a listener that may stop the page scrolling, so it is added by hand. */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setGlide(false)
      const r = el.getBoundingClientRect()
      zoomAbout(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAbout])

  const rel = (e: { clientX: number; clientY: number }) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const beginPinch = () => {
    const [a, b] = [...pts.current.values()]
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const v = viewRef.current
    g.current = { mode: 'pinch', sx: 0, sy: 0, vx: v.x, vy: v.y, moved: true, d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), cw0: v.cw, mx: mid.x, my: mid.y }
    for (const id of pts.current.keys()) { try { ref.current?.setPointerCapture(id) } catch { /* the pointer has gone */ } }
  }
  const beginPan = (p: { x: number; y: number }, moved: boolean) => {
    const v = viewRef.current
    g.current = { mode: 'pan', sx: p.x, sy: p.y, vx: v.x, vy: v.y, moved, d0: 1, cw0: v.cw, mx: 0, my: 0 }
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    setGlide(false)
    pts.current.set(e.pointerId, rel(e))
    if (pts.current.size === 1) beginPan(rel(e), false)
    else if (pts.current.size === 2) beginPinch()
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pts.current.has(e.pointerId)) return
    pts.current.set(e.pointerId, rel(e))
    const s = g.current
    if (s.mode === 'pan' && pts.current.size === 1) {
      const p = rel(e)
      const dx = p.x - s.sx, dy = p.y - s.sy
      if (!s.moved) {
        if (Math.hypot(dx, dy) < 8) return
        s.moved = true
        try { ref.current?.setPointerCapture(e.pointerId) } catch { /* the pointer has gone */ }
      }
      setView(clamp({ ...viewRef.current, x: s.vx + dx, y: s.vy + dy }))
    } else if (s.mode === 'pinch' && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const cw = Math.min(maxCw, Math.max(fitCw, s.cw0 * (d / s.d0)))
      const r = cw / s.cw0
      setView(clamp({ cw, x: mid.x - (s.mx - s.vx) * r, y: mid.y - (s.my - s.vy) * r }))
    }
  }
  const end = (e: ReactPointerEvent) => {
    if (!pts.current.has(e.pointerId)) return
    pts.current.delete(e.pointerId)
    if (g.current.moved) lastDrag.current = performance.now()
    if (pts.current.size === 1) beginPan([...pts.current.values()][0], true)
    else if (pts.current.size === 0) g.current.mode = 'none'
  }

  return {
    ref, view, height: heightFor(view.cw), glide, fitCw,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
    zoomBy: (factor) => { setGlide(true); zoomAbout(width / 2, heightFor(viewRef.current.cw) / 2, factor) },
    fit: () => { setGlide(true); setView(clamp({ cw: fitCw, x: 0, y: 0 })) },
    reveal: (x, y, w, h) => {
      const v = viewRef.current
      const H = heightFor(v.cw)
      const left = x * v.cw + v.x, top = y * v.cw + v.y
      if (left >= 0 && top >= 0 && left + w * v.cw <= width && top + h * v.cw <= H) return
      setGlide(true)
      setView(clamp({ ...v, x: width / 2 - (x + w / 2) * v.cw, y: H / 2 - (y + h / 2) * v.cw }))
    },
    dragged: () => performance.now() - lastDrag.current < 350,
  }
}
