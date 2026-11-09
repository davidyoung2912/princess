import { useSyncExternalStore } from 'react'
import { Link, useLocation } from 'react-router'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { t, th, type StringKey } from '../../i18n'
import { needId, welcomeContent } from '../../routes/stageWelcome'
import { nextSteps } from '../../routes/stageHome'
import { pickTrip, useStageFacts } from '../../hooks/useStageFacts'
import { useOnboardToday } from '../../hooks/useOnboardToday'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { Check } from 'lucide-react'
import { getProgress, subscribeProgress } from '../../stageProgress/store'
import { getContext, subscribeContext } from '../../account/context'
import { wasVisited } from '../../routes/stageProgress'
import { loadTicks, subscribeTicks, toggleNeed } from '../../settings/welcomeNeeds'
import { Square, SquareCheck } from '../icons'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { StageHero } from '../StageHero'

/** Where "Get started" goes: back to the screen the guest was on when the welcome came up (if it was an app address), otherwise Home. */
const back = (from: unknown): string => (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/welcome') ? from : '/')

/** One piece of a stage's welcome text. The keys are `welcome.<stage>.<part>`; `welcomeContent` names the same keys for the tests and the copy check. */
const words = (stage: string, part: string): string => t(`welcome.${stage}.${part}` as StringKey)

const stageName = (stage: string): string => t(`journey.stage.${stage}` as StringKey)

/**
 * The welcome to a stage (docs/stage-welcome-plan.md): shown once on entering the stage, and any time from "Stage overview". It says where the guest has come from,
 * what the stage is for, how it leads on and the steps in it. The words come from the locale keys `welcomeContent` names.
 */
export function StageWelcomeScreen() {
  const { stage, focusSailingId } = useJourneyPosition()
  const personId = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  const visits = useSyncExternalStore(subscribeProgress, () => getProgress(personId), () => getProgress(personId))
  const { state } = useLocation()
  const c = welcomeContent(stage)
  const first = c.introKey !== null
  const ticks = useSyncExternalStore(subscribeTicks, loadTicks, loadTicks)
  const trips = useMine(() => api.trips.list())
  const today = useOnboardToday()
  const { facts } = useStageFacts(trips.data ? pickTrip(trips.data.upcoming) : null, today.data ?? null)
  const steps = nextSteps(stage, facts).map((x, i) => ({ ...x, done: x.done || wasVisited(visits, stage, focusSailingId, i + 1) }))
  const doneCount = steps.filter((x) => x.done).length
  const remaining = steps.length - doneCount
  return (
    <div className="page welcome">
      <StageHero stage={stage} />
      <header className="welcome__head">
        <p className="welcome__eyebrow">{t(first ? 'welcome.eyebrowFirst' : 'welcome.eyebrow')}</p>
        <h2 className="welcome__title">{words(stage, 'title')}</h2>
      </header>
      <nav aria-label={t('welcome.map')}>
        <ol className="welcome__map">
          {c.previous && <li className="welcome__stage"><span className="welcome__tag">{t('welcome.previous')}</span>{stageName(c.previous)}</li>}
          <li className="welcome__stage welcome__stage--now" aria-current="step"><span className="welcome__tag">{t('welcome.now')}</span>{stageName(stage)}</li>
          {c.next && <li className="welcome__stage"><span className="welcome__tag">{t('welcome.next')}</span>{stageName(c.next)}</li>}
        </ol>
      </nav>
      <Card labelledBy="welcome-before-h">
        <h2 id="welcome-before-h">{th(first ? 'welcome.eyebrowFirst' : 'welcome.h.transition')}</h2>
        <p>{words(stage, first ? 'intro' : 'transition')}</p>
      </Card>
      <Card labelledBy="welcome-focus-h">
        <h2 id="welcome-focus-h">{th('welcome.h.focus')}</h2>
        <p>{words(stage, 'focus')}</p>
      </Card>
      <Card labelledBy="welcome-need-h">
        <h2 id="welcome-need-h">{th('welcome.h.need')}</h2>
        <p>{words(stage, 'needIntro')}</p>
        <ul className="welcome__needs">
          {c.needs.map((n, i) => {
            const ticked = !!ticks[needId(stage, i + 1)]
            const text = words(stage, `need.${i + 1}`)
            const Box = ticked ? SquareCheck : Square
            return (
              <li key={n.key} className={ticked ? 'welcome__need welcome__need--done' : 'welcome__need'}>
                <label className="welcome__tick">
                  <input type="checkbox" className="visually-hidden" checked={ticked} onChange={() => toggleNeed(stage, i + 1)} />
                  <Box aria-hidden="true" size={26} />
                  <span>{text}</span>
                </label>
                {n.to && <Link to={n.to} className="welcome__open">{t('welcome.open')}<span className="visually-hidden">: {text}</span></Link>}
              </li>
            )
          })}
        </ul>
        <p className="muted">{t('welcome.needNote')}</p>
      </Card>
      <Card labelledBy="welcome-lead-h">
        <h2 id="welcome-lead-h">{c.next ? th('welcome.h.leadTo', { stage: stageName(c.next) }) : th('welcome.h.leadEnd')}</h2>
        <p>{words(stage, 'lead')}</p>
      </Card>
      <Card hero labelledBy="welcome-steps-h">
        <h2 id="welcome-steps-h">{th('welcome.h.progress')}</h2>
        <p className="muted">{t('welcome.progress', { done: doneCount, total: steps.length })}</p>
        <ol className="welcome__steps">
          {steps.map((x, i) => {
            const text = words(stage, `step.${i + 1}`)
            return x.done
              ? <li key={x.key} className="welcome__step welcome__step--done"><Check size={18} aria-hidden="true" /> <span>{text}</span> <span className="muted">· {t('welcome.stepDone')}</span></li>
              : <li key={x.key} className="welcome__step"><Link to={x.to}>{text}</Link> <span className="muted">· {t('welcome.stepToDo')}</span></li>
          })}
        </ol>
        <p>{remaining === 0 ? (c.next ? t('welcome.allDone', { stage: stageName(c.next) }) : t('welcome.allDoneEnd')) : (c.next ? t('welcome.toGo', { count: remaining, stage: stageName(c.next) }) : t('welcome.toGoEnd', { count: remaining }))}</p>
        <div className="button-row"><LinkButton to={back((state as { from?: unknown } | null)?.from)} replace>{t('welcome.go')}</LinkButton></div>
      </Card>
    </div>
  )
}
