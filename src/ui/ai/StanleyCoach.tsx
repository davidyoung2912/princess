import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import stanley from '../../assets/stanley-small.png'
import { COACH_TARGETS, findCoachTarget, holeBox, notePlacement, type Box } from '../../ai/coachSpotlight'
import { COACH_STEPS, coachAutoShows, hasCoach, type CoachScreen } from '../../ai/stanleyMoments'
import { startVisibleInterval } from '../../hooks/visibleInterval'
import { useSettings } from '../../hooks/useSettings'
import { useDialog } from '../../hooks/useDialog'
import { t, type StringKey } from '../../i18n'
import { isReplayed, isSeen, markSeen, seenVersion, subscribeSeen } from '../../settings/stanleySeen'
import { stanleyLevelFor } from '../../settings/settings'
import { Button } from '../Button'

const PAD = 8

const reducedMotion = () => document.documentElement.dataset.motion === 'reduced' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * A first-visit tour of a screen: two or three short steps, one at a time, each lighting up the part of the page it talks about and dimming the rest,
 * with Back, Next, Done and "Skip tour". It shows once for each of five screens at Chatty, and the help panel can bring it back.
 * It is a modal dialog: focus moves in and stays inside, and Escape skips the tour. A step whose part of the page cannot be found is shown centred, with nothing lit.
 */
export function StanleyCoach({ screenId }: { screenId: string | undefined }) {
  const [settings] = useSettings()
  useSyncExternalStore(subscribeSeen, seenVersion, seenVersion)
  if (!hasCoach(screenId)) return null
  const level = stanleyLevelFor(settings)
  const key = `coach:${screenId}`
  const asked = isReplayed(key) && level !== 'off'
  if (!asked && !(coachAutoShows(level) && !isSeen(key))) return null
  return <Spotlight screenId={screenId} onFinish={() => markSeen(key)} />
}

function Spotlight({ screenId, onFinish }: { screenId: CoachScreen; onFinish: () => void }) {
  const [step, setStep] = useState(0)
  const [hole, setHole] = useState<Box | null>(null)
  const [placement, setPlacement] = useState<'below' | 'above' | 'bottom'>('bottom')
  const titleId = useId()
  const box = useDialog<HTMLDivElement>(onFinish)
  const note = useRef<HTMLDivElement>(null)
  const total = COACH_STEPS[screenId]
  const last = step >= total - 1

  const measure = useCallback(() => {
    const el = findCoachTarget(document.getElementById('main') ?? document, COACH_TARGETS[screenId][step])
    const r = el?.getBoundingClientRect()
    const h = r && r.width > 0 && r.height > 0 ? holeBox({ top: r.top, left: r.left, width: r.width, height: r.height }, PAD, window.innerWidth, window.innerHeight) : null
    setHole(h)
    setPlacement(notePlacement(h, window.innerHeight, note.current?.offsetHeight ?? 240))
  }, [screenId, step])

  useLayoutEffect(() => {
    const el = findCoachTarget(document.getElementById('main') ?? document, COACH_TARGETS[screenId][step])
    el?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    const first = requestAnimationFrame(measure)
    // A smooth scroll takes a moment, so measure again as the page moves.
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(first); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure) }
  }, [measure, screenId, step])

  useEffect(() => {
    // Keep the lit area in step if the page moves under it (for example when the screen's data arrives).
    return startVisibleInterval(measure, 500)
  }, [measure])

  const noteStyle = hole && placement === 'below' ? { top: hole.top + hole.height + 12 } : hole && placement === 'above' ? { bottom: window.innerHeight - hole.top + 12 } : undefined
  return (
    <div className="coach-backdrop no-print" data-lit={hole ? 'yes' : 'no'}>
      {hole && <div className="coach-hole" style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} aria-hidden="true" />}
      <div ref={box} className="coach-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div ref={note} className={`stanley-coach coach-note coach-note--${placement}`} style={noteStyle}>
          <img className="stanley-next__face" src={stanley} alt="" width="192" height="192" />
          <div className="stanley-coach__text">
            <p className="muted" aria-live="polite">{t('stanley.coach.count', { n: step + 1, total })}</p>
            <h2 id={titleId} className="stanley-coach__title">{t(`stanley.coach.${screenId}.${step + 1}.title` as StringKey)}</h2>
            <p>{t(`stanley.coach.${screenId}.${step + 1}.body` as StringKey)}</p>
            <div className="stanley-coach__actions">
              {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>{t('stanley.coach.back')}</Button>}
              {last ? <Button onClick={onFinish}>{t('stanley.coach.done')}</Button> : <Button onClick={() => setStep(step + 1)}>{t('stanley.coach.next')}</Button>}
              {!last && <Button variant="secondary" onClick={onFinish}>{t('stanley.coach.skip')}</Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
