import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { t } from '../../i18n'
import { FitAll, FitWidth, ZoomIn, ZoomOut } from '../icons'
import { clamp, fitAll, initial, panBy, percent, pinch, zoomAt, type Size, type Transform } from '../../deckPlans/viewport'

const STEP = 1.4
const KEY_PAN = 80

/**
 * A deck plan image the guest can drag to pan, pinch or scroll to zoom, double-tap to zoom in, and drive from the keyboard or the buttons.
 * Every gesture has a button or key equivalent (WCAG 2.5.1, 2.1.1); movement is never animated, so reduced-motion needs no special case.
 */
export function DeckPlanViewer({ src, label }: { src: string; label: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<Size>({ width: 0, height: 0 })
  const [image, setImage] = useState<Size | null>(null)
  const [tf, setTf] = useState<Transform>({ scale: 1, x: 0, y: 0 })
  const [loadFailed, setLoadFailed] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ distance: number } | null>(null)
  const lastTap = useRef(0)
  const travel = useRef(0)
  const ready = image !== null && view.width > 0

  // Track the frame's size so a rotation or window resize keeps the plan on screen.
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => setView({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The first measure starts at full width, top of the plan; later resizes only keep it on screen. The screen remounts this component (by key) for each plan.
  const started = useRef(false)
  useEffect(() => {
    if (!ready) return
    if (!started.current) {
      started.current = true
      setTf(initial(view, image))
    } else {
      setTf((cur) => clamp(cur, view, image))
    }
  }, [ready, view, image])

  // A non-passive wheel listener is needed to stop the page scrolling under the plan. Ctrl or Cmd with the wheel, and a trackpad pinch, zoom; the plain wheel pans.
  const wheel = useCallback((e: WheelEvent) => {
    if (!ready) return
    e.preventDefault()
    const rect = frame.current!.getBoundingClientRect()
    setTf((cur) => e.ctrlKey || e.metaKey
      ? zoomAt(cur, Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top, view, image)
      : panBy(cur, -e.deltaX, -e.deltaY, view, image))
  }, [ready, view, image])
  useEffect(() => {
    const el = frame.current
    if (!el) return
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [wheel])

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = frame.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const down = (e: ReactPointerEvent) => {
    if (!ready) return
    frame.current!.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, local(e))
    travel.current = 0
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { distance: pinch(a, b).distance }
    }
  }
  const move = (e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev || !ready) return
    const now = local(e)
    pointers.current.set(e.pointerId, now)
    travel.current += Math.abs(now.x - prev.x) + Math.abs(now.y - prev.y)
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()]
      const p = pinch(a, b)
      const factor = p.distance / gesture.current.distance
      gesture.current = { distance: p.distance }
      setTf((cur) => zoomAt(cur, factor, p.x, p.y, view, image))
    } else if (pointers.current.size === 1) {
      setTf((cur) => panBy(cur, now.x - prev.x, now.y - prev.y, view, image))
    }
  }
  const up = (e: ReactPointerEvent) => {
    const wasTap = pointers.current.size === 1 && travel.current < 8 && e.type === 'pointerup' && e.pointerType !== 'mouse'
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current = null
    // Double tap zooms in at that point; a mouse uses double click.
    if (!wasTap || !ready) return
    const at = Date.now()
    if (at - lastTap.current < 300) {
      const p = local(e)
      setTf((cur) => zoomAt(cur, 2, p.x, p.y, view, image))
      lastTap.current = 0
    } else lastTap.current = at
  }
  const doubleClick = (e: ReactMouseEvent) => {
    if (!ready) return
    const p = local(e)
    setTf((cur) => zoomAt(cur, 2, p.x, p.y, view, image))
  }

  const zoomBy = (factor: number) => ready && setTf((cur) => zoomAt(cur, factor, view.width / 2, view.height / 2, view, image))
  const key = (e: KeyboardEvent) => {
    if (!ready) return
    const act = (fn: (cur: Transform) => Transform) => { e.preventDefault(); setTf(fn) }
    switch (e.key) {
      case 'ArrowUp': return act((c) => panBy(c, 0, KEY_PAN, view, image))
      case 'ArrowDown': return act((c) => panBy(c, 0, -KEY_PAN, view, image))
      case 'ArrowLeft': return act((c) => panBy(c, KEY_PAN, 0, view, image))
      case 'ArrowRight': return act((c) => panBy(c, -KEY_PAN, 0, view, image))
      case 'PageUp': return act((c) => panBy(c, 0, view.height * 0.9, view, image))
      case 'PageDown': return act((c) => panBy(c, 0, -view.height * 0.9, view, image))
      case 'Home': return act((c) => panBy(c, 0, 1e9, view, image))
      case 'End': return act((c) => panBy(c, 0, -1e9, view, image))
      case '+': case '=': return act((c) => zoomAt(c, STEP, view.width / 2, view.height / 2, view, image))
      case '-': case '_': return act((c) => zoomAt(c, 1 / STEP, view.width / 2, view.height / 2, view, image))
      case '0': return act(() => initial(view, image))
    }
  }

  return (
    <div className="deckview">
      <div className="deckview__bar" role="group" aria-label={t('dv.controls')}>
        <button type="button" className="btn btn--secondary deckview__btn" onClick={() => zoomBy(STEP)} disabled={!ready} aria-label={t('dv.zoomIn')}><ZoomIn aria-hidden size={20} /></button>
        <button type="button" className="btn btn--secondary deckview__btn" onClick={() => zoomBy(1 / STEP)} disabled={!ready} aria-label={t('dv.zoomOut')}><ZoomOut aria-hidden size={20} /></button>
        <button type="button" className="btn btn--secondary deckview__btn" onClick={() => ready && setTf(initial(view, image))} disabled={!ready} aria-label={t('dv.fitWidth')}><FitWidth aria-hidden size={20} /></button>
        <button type="button" className="btn btn--secondary deckview__btn" onClick={() => ready && setTf(fitAll(view, image))} disabled={!ready} aria-label={t('dv.fitAll')}><FitAll aria-hidden size={20} /></button>
        <span className="deckview__zoom" role="status" aria-label={t('dv.zoomLevel')}>{ready ? `${percent(tf)}%` : ''}</span>
      </div>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- a pan and zoom widget takes focus, keys and pointer input; the buttons above do the same without a pointer */}
      <div
        ref={frame}
        className="deckview__frame"
        role="application"
        aria-roledescription={t('dv.role')}
        aria-label={label}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- see above
        tabIndex={0}
        onKeyDown={key}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={doubleClick}
      >
        {loadFailed ? <p className="deckview__note" role="alert">{t('dv.failed')}</p> : (
          <img
            src={src}
            alt={label}
            draggable={false}
            className="deckview__img"
            style={ready ? { width: image.width, height: image.height, transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.scale})` } : { visibility: 'hidden' }}
            onLoad={(e) => setImage({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            onError={() => setLoadFailed(true)}
          />
        )}
        {!ready && !loadFailed && <p className="deckview__note" role="status">{t('dv.loading')}</p>}
      </div>
      <p className="muted deckview__hint">{t('dv.hint')}</p>
    </div>
  )
}
