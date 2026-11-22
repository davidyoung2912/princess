import { useCallback, useEffect, useId, useLayoutEffect, useState, useSyncExternalStore, type ComponentType, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n'
import type { StringKey } from '../i18n'
import { startVisibleInterval } from '../hooks/visibleInterval'
import { useDialog } from '../hooks/useDialog'
import { loadTourOn, loadTourSeen, markTourStep, skipTour, subscribeTour, tourReady } from '../settings/tour'
import { GENERAL_STEPS, nextStep, TOUR_STEPS, type TourStep } from '../tour/steps'
import { placeCard, spotlight, type Box, type Side } from '../tour/placement'
import { Anchor, Bookmark, CalendarClock, Clock, CloudSun, Ship, Thermometer, Ticket, Wallet, Waves, Compass, Help, Home, Info, Lightbulb, MapPin, Menu, MessagesSquare, Plan, RouteMap, Search, Sparkles } from './icons'
import { Button } from './Button'

const ICONS: Record<TourStep['icon'], ComponentType<{ 'aria-hidden'?: boolean | 'true' | 'false'; className?: string }>> = {
  pin: Bookmark, pass: Ticket, bill: Wallet, clock: Clock, ship: Ship, anchor: Anchor, waves: Waves, pack: Thermometer,
  nav: Home, search: Search, stanley: Sparkles, help: Help, menu: Menu, date: CalendarClock, header: Info, tip: Lightbulb,
  chat: MessagesSquare, today: Plan, explorers: MapPin, weather: CloudSun, navigation: Compass, itinerary: RouteMap,
}

/** Every part of the screen marked `data-tour="<name>"` that is showing. */
const targetsOf = (name: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].filter((el) => getComputedStyle(el).visibility !== 'hidden')

/** The box around the parts marked `<name>`: where they are on screen, and for several (a row of buttons) the box around them all, cut to the carousel they scroll in. Null when none is showing. */
function targetBox(name: string): Box | null {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const el of targetsOf(name)) {
    const r = el.getBoundingClientRect()
    const clip = el.closest('.testbar__at')?.getBoundingClientRect()
    const l = Math.max(r.left, clip?.left ?? -Infinity), rt = Math.min(r.right, clip?.right ?? Infinity)
    if (r.width <= 0 || r.height <= 0 || rt - l < 1) continue
    left = Math.min(left, l); right = Math.max(right, rt); top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom)
  }
  return right > left ? { left, top, width: right - left, height: bottom - top } : null
}

const view = () => ({ width: document.documentElement.clientWidth, height: window.innerHeight })

/**
 * The first-visit tour: a floating tip card beside one part of the screen at a time, with the rest of the screen under frosted glass and out of
 * reach. Got It! saves the step on this device and moves on; Skip (or Escape) ends the tour. Me → Settings brings it back.
 * `paused` holds it back while something else (a welcome page, a sheet) has the screen.
 */
export function Tour({ paused = false }: { paused?: boolean }) {
  const seen = useSyncExternalStore(subscribeTour, loadTourSeen, loadTourSeen)
  // Nothing starts until the account's own copy has arrived, so a guest who finished the tour on another device is not shown it again.
  const ready = useSyncExternalStore(subscribeTour, tourReady, () => false)
  const on = useSyncExternalStore(subscribeTour, loadTourOn, loadTourOn)
  const [step, setStep] = useState<TourStep | null>(null)
  // Look again for a step to show whenever the tour state or the page changes, and now and then in case the page has finished drawing or a sheet has closed.
  useEffect(() => {
    if (paused || !ready || !on) return
    const look = () => setStep((now) => {
      // Another modal (a sheet, or a page's own Stanley tour) has the screen: this tour steps aside until it is gone.
      if (document.querySelector('.dialog-backdrop, .coach-backdrop')) return null
      if (now && !seen.includes(now.id) && targetBox(now.target)) return now
      return nextStep(seen, (name) => targetBox(name) !== null)
    })
    queueMicrotask(look)
    return startVisibleInterval(look, 700)
  }, [seen, paused, ready, on])
  if (!step || paused || !ready || !on) return null
  // The frame steps are counted among themselves ("3/14"); a step about one page's content has no count, and always offers Skip.
  const index = GENERAL_STEPS.findIndex((s) => s.id === step.id)
  const left = TOUR_STEPS.filter((s) => !seen.includes(s.id)).length
  return <TourCard key={step.id} step={step} count={step.page ? null : `${index + 1}/${GENERAL_STEPS.length}`} last={!step.page && left <= 1} />
}

function TourCard({ step, count, last }: { step: TourStep; count: string | null; last: boolean }) {
  const titleId = useId()
  const bodyId = useId()
  const box = useDialog<HTMLDivElement>(skipTour)
  const [target, setTarget] = useState<Box | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [vp, setVp] = useState(view)
  const Icon = ICONS[step.icon]

  const measure = useCallback(() => {
    const found = targetBox(step.target)
    if (found) setTarget(found)
    setVp(view())
  }, [step.target])

  // Bring the part being explained into view, then keep the glass and the card lined up with it through scrolling and resizing.
  useLayoutEffect(() => {
    const el = targetsOf(step.target)[0]
    if (el) {
      const r = el.getBoundingClientRect()
      const v = view()
      if (r.top < 0 || r.bottom > v.height) el.scrollIntoView({ block: 'center', behavior: 'auto' })
      // A button inside the scrolling row of ship buttons is slid to the start of the row.
      const track = el.closest<HTMLElement>('.testbar__at')
      if (track) track.scrollTo({ left: track.scrollLeft + r.left - track.getBoundingClientRect().left, behavior: 'auto' })
    }
    const frame = requestAnimationFrame(measure)
    box.current?.querySelector<HTMLElement>('.tour__got')?.focus({ preventScroll: true })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [step.target, measure, box])

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const frame = requestAnimationFrame(() => setSize({ width: el.offsetWidth, height: el.offsetHeight }))
    return () => cancelAnimationFrame(frame)
  }, [box, vp.width, vp.height, step.id])

  // A target as wide as the screen (the bottom tab bar, the page header) is pointed at from above or below, not from the side.
  let prefer: Side = step.side
  if (target && (prefer === 'left' || prefer === 'right') && target.width > vp.width * 0.6) prefer = target.top + target.height / 2 > vp.height / 2 ? 'top' : 'bottom'
  if (target && prefer === 'bottom' && target.top + target.height / 2 > vp.height * 0.6) prefer = 'top'
  const place = target && size ? placeCard(target, size, vp, prefer) : null
  const hole = target ? spotlight(target, vp) : null
  const clip = hole
    ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${hole.left}px ${hole.top}px, ${hole.left}px ${hole.top + hole.height}px, ${hole.left + hole.width}px ${hole.top + hole.height}px, ${hole.left + hole.width}px ${hole.top}px, ${hole.left}px ${hole.top}px)`
    : undefined
  const style: CSSProperties = place
    ? { left: place.left, top: place.top, '--tour-arrow': `${place.arrow}px` } as CSSProperties
    : { left: 0, top: 0, visibility: 'hidden' }

  return createPortal(
    <div className="tour" data-testid="tour">
      <div className="tour__block" aria-hidden="true" />
      <div className="tour__glass" aria-hidden="true" style={{ clipPath: clip }} />
      {hole && <div className="tour__ring" aria-hidden="true" style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }} />}
      <div ref={box} className="tour__card" data-side={place?.side} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} tabIndex={-1} style={style}>
        <div className="tour__head">
          <span className="tour__icon" aria-hidden="true"><Icon aria-hidden="true" /></span>
          <h2 id={titleId} className="tour__title">{t(`tour.${step.id}.title` as StringKey)}</h2>
        </div>
        <p id={bodyId} className="tour__body">{t(`tour.${step.id}.body` as StringKey)}</p>
        <div className="tour__foot">
          {count ? <span className="tour__count" aria-label={t('tour.count.label', { n: count.split('/')[0]!, total: count.split('/')[1]! })}>{count}</span> : <span className="tour__count" />}
          {!last && <button type="button" className="tour__skip" onClick={skipTour}>{t('tour.skip')}</button>}
          <Button variant="primary" className="tour__got" onClick={() => markTourStep(step.id)}>{t('tip.gotIt')}</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
