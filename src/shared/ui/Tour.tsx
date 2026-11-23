import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { t } from '../i18n'
import type { StringKey } from '../i18n'
import { startVisibleInterval } from '../hooks/visibleInterval'
import { loadTourOn, loadTourSeen, markTourStep, skipGuide, subscribeTour, tourReady } from '../settings/tour'
import { resetTourScroll, scrollIntoViewTracked } from '../../features/tour/logic/scroll'
import { nextStep, stepsOfGuide, type GuideId, type TourStep } from '../../features/tour/logic/steps'
import { Button } from './Button'
import { TOUR_ICONS } from './tourIcons'

/** Every part of the screen marked `data-tour="<name>"` that is showing. */
const targetsOf = (name: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].filter((el) => getComputedStyle(el).visibility !== 'hidden')

/** Whether any part marked `<name>` is showing on screen (cut to the carousel it scrolls in). */
function targetShows(name: string): boolean {
  return targetsOf(name).some((el) => {
    const r = el.getBoundingClientRect()
    const clip = el.closest('.testbar__at')?.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && Math.min(r.right, clip?.right ?? Infinity) - Math.max(r.left, clip?.left ?? -Infinity) >= 1
  })
}

/**
 * The first-visit tour: one small tip card at a time along the bottom of the screen (above the tab bar on a phone), over a page that stays usable. Got It! saves the step
 * on the account and moves on; Skip ends the tour. Me → Settings brings it back. `paused` holds it back while something else (a welcome page, a sheet) has the screen.
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
      if (now && !seen.includes(now.id) && targetShows(now.target)) return now
      return nextStep(seen, (name) => targetShows(name))
    })
    queueMicrotask(look)
    return startVisibleInterval(look, 700)
  }, [seen, paused, ready, on])
  // The tour may move the page to show a step. When it is finished with the page (the last step done, the rest skipped, or the tour turned off), the page goes back to the top.
  const shown = useRef<TourStep | null>(null)
  useEffect(() => {
    if (shown.current && !step) resetTourScroll()
    shown.current = step
  }, [step])
  useEffect(() => { if (!on) resetTourScroll() }, [on])
  if (!step || paused || !ready || !on) return null
  // A guide's cards are counted among themselves ("3/4"), and Skip ends that guide only. The one-off cards for the other pages are not a guide: no count, and Skip is always offered.
  const mine = stepsOfGuide(step.guide)
  const counted = step.guide !== 'pages' && mine.length > 1
  const left = mine.filter((s) => !seen.includes(s.id)).length
  return <TourCard key={step.id} step={step} count={counted ? `${mine.findIndex((s) => s.id === step.id) + 1}/${mine.length}` : null} last={step.guide !== 'pages' && left <= 1} />
}

/** The guide's name, for the card's footer. */
const guideName = (guide: GuideId): string => t(`tour.guide.${guide}` as StringKey)

function TourCard({ step, count, last }: { step: TourStep; count: string | null; last: boolean }) {
  const titleId = useId()
  const Icon = TOUR_ICONS[step.icon]
  // The part of the screen the step is about flashes while the card is up, and is brought into view if it is off screen.
  useEffect(() => {
    const els = targetsOf(step.target)
    const r = els[0]?.getBoundingClientRect()
    if (r && els[0] && (r.top < 0 || r.bottom > window.innerHeight * 0.6)) scrollIntoViewTracked(els[0])
    els.forEach((el) => el.classList.add('tour-flash'))
    return () => els.forEach((el) => el.classList.remove('tour-flash'))
  }, [step.target])
  // A note that is not modal: the page behind stays usable. A step is announced politely when it appears, and the guest can still use the keyboard to reach Got It! after the page.
  return (
    // Pressing anywhere on the card is Got It! (the buttons keep their own meaning: Skip skips). Keyboard and screen reader users have the Got It! button itself, so the card needs no key handler.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <aside className="tour" data-testid="tour" role="region" aria-labelledby={titleId} onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a')) markTourStep(step.id) }}>
      <p className="tour__head"><Icon className="tour__icon" aria-hidden="true" /><strong id={titleId} className="tour__title">{t(`tour.${step.id}.title` as StringKey)}</strong></p>
      <p className="tour__text">{t(`tour.${step.id}.body` as StringKey)}</p>
      <div className="tour__foot">
        {count ? <span className="tour__count" aria-label={t('tour.guide.count', { guide: guideName(step.guide), n: count.split('/')[0]!, total: count.split('/')[1]! })}>{guideName(step.guide)} · {count}</span> : <span className="tour__count" />}
        {!last && <button type="button" className="tour__skip" onClick={() => skipGuide(step.guide)}>{t('tour.skip')}</button>}
        <Button variant="secondary" className="tour__got" onClick={() => markTourStep(step.id)}>{t('tip.gotIt')}</Button>
      </div>
    </aside>
  )
}
