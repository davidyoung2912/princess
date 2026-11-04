import { useState, useSyncExternalStore } from 'react'
import stanley from '../../assets/stanley-small.png'
import { COACH_STEPS, coachAutoShows, hasCoach } from '../../ai/stanleyMoments'
import { useSettings } from '../../hooks/useSettings'
import { t, type StringKey } from '../../i18n'
import { isReplayed, isSeen, markSeen, seenVersion, subscribeSeen } from '../../settings/stanleySeen'
import { stanleyLevelFor } from '../../settings/settings'
import { Button } from '../Button'

/**
 * A first-visit tour of a screen: two or three short steps in a card at the top of the page, one at a time, with Back, Next, Done and "Skip tour". It shows
 * once for each of five screens at Chatty, and the help panel can bring it back. It does not cover the page or trap focus, so the screen stays usable.
 */
export function StanleyCoach({ screenId }: { screenId: string | undefined }) {
  const [settings] = useSettings()
  const [step, setStep] = useState(0)
  useSyncExternalStore(subscribeSeen, seenVersion, seenVersion)
  if (!hasCoach(screenId)) return null
  const level = stanleyLevelFor(settings)
  const key = `coach:${screenId}`
  const asked = isReplayed(key) && level !== 'off'
  if (!asked && !(coachAutoShows(level) && !isSeen(key))) return null
  const total = COACH_STEPS[screenId]
  const last = step >= total - 1
  const finish = () => { setStep(0); markSeen(key) }
  return (
    <div className="page page--tip no-print">
      <aside className="stanley-coach" aria-label={t('stanley.coach.label')}>
        <img className="stanley-next__face" src={stanley} alt="" width="192" height="192" />
        <div className="stanley-coach__text">
          <p className="muted">{t('stanley.coach.count', { n: step + 1, total })}</p>
          <h2 className="stanley-coach__title">{t(`stanley.coach.${screenId}.${step + 1}.title` as StringKey)}</h2>
          <p>{t(`stanley.coach.${screenId}.${step + 1}.body` as StringKey)}</p>
          <div className="stanley-coach__actions">
            {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>{t('stanley.coach.back')}</Button>}
            {last ? <Button onClick={finish}>{t('stanley.coach.done')}</Button> : <Button onClick={() => setStep(step + 1)}>{t('stanley.coach.next')}</Button>}
            {!last && <Button variant="secondary" onClick={finish}>{t('stanley.coach.skip')}</Button>}
          </div>
        </div>
      </aside>
    </div>
  )
}
