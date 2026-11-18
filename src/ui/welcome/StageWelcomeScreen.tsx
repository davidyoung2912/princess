import { useSyncExternalStore } from 'react'
import { Link, useLocation } from 'react-router'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { t, th, type StringKey } from '../../i18n'
import { needId, welcomeContent } from '../../routes/stageWelcome'
import { useGuide } from '../../hooks/useGuide'
import { stepDoneInGuide } from '../../guide/view'
import { Check } from 'lucide-react'
import { getProgress, subscribeProgress } from '../../stageProgress/store'
import { getContext, subscribeContext } from '../../account/context'
import { wasVisited } from '../../routes/stageProgress'
import { loadTicks, subscribeTicks, toggleNeed } from '../../settings/welcomeNeeds'
import { Square, SquareCheck } from '../icons'
import { LinkButton } from '../Button'
import { StageHero } from '../StageHero'
import { AppWelcome } from './AppWelcome'
import { StanleyIntro } from './StanleyIntro'

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
  const { state } = useLocation()
  // A first sign-in lands here with `intro: 'app'` (the app's own welcome), then `intro: 'stanley'` (Stanley introduces himself), before the stage's own welcome.
  const intro = (state as { intro?: unknown } | null)?.intro
  if (intro === 'app') return <AppWelcome />
  if (intro === 'stanley') return <StanleyIntro />
  return <StageWelcomeStage />
}

function StageWelcomeStage() {
  const { stage, focusSailingId } = useJourneyPosition()
  const personId = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  const visits = useSyncExternalStore(subscribeProgress, () => getProgress(personId), () => getProgress(personId))
  const { state } = useLocation()
  const c = welcomeContent(stage)
  const first = c.introKey !== null
  const ticks = useSyncExternalStore(subscribeTicks, loadTicks, loadTicks)
  const guide = useGuide().data
  const steps = c.steps.map((x, i) => ({ ...x, done: wasVisited(visits, stage, focusSailingId, i + 1) || (guide?.stage === stage && stepDoneInGuide(guide, i + 1)) }))
  const doneCount = steps.filter((x) => x.done).length
  const remaining = steps.length - doneCount
  const nextUpIndex = steps.findIndex((x) => !x.done)
  const nextUp = nextUpIndex >= 0 ? steps[nextUpIndex] : null
  const sections = [
    { id: 'welcome-before', label: t(first ? 'welcome.eyebrowFirst' : 'welcome.h.transition') },
    { id: 'welcome-focus', label: t('welcome.h.focus') },
    { id: 'welcome-need', label: t('welcome.h.need') },
    { id: 'welcome-lead', label: c.next ? t('welcome.h.leadTo', { next: words(stage, 'nextName') }) : t('welcome.h.leadEnd') },
    { id: 'welcome-steps', label: t('welcome.h.progress') },
    { id: 'welcome-moveon', label: c.next ? t('welcome.h.moveOn', { next: words(stage, 'nextName') }) : t('welcome.h.moveOnEnd') },
  ]
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
      <nav aria-label={t('welcome.jump')}>
        <ul className="naut-jump">
          {sections.map((x) => <li key={x.id}><a href={`#${x.id}`}>{x.label}</a></li>)}
        </ul>
      </nav>
      <section id="welcome-before" aria-labelledby="welcome-before-h">
        <h2 id="welcome-before-h">{th(first ? 'welcome.eyebrowFirst' : 'welcome.h.transition')}</h2>
        <p>{words(stage, first ? 'intro' : 'transition')}</p>
      </section>
      <section id="welcome-focus" aria-labelledby="welcome-focus-h">
        <h2 id="welcome-focus-h">{th('welcome.h.focus')}</h2>
        <p>{words(stage, 'focus')}</p>
      </section>
      <section id="welcome-need" aria-labelledby="welcome-need-h">
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
      </section>
      <section id="welcome-lead" aria-labelledby="welcome-lead-h">
        <h2 id="welcome-lead-h">{c.next ? th('welcome.h.leadTo', { next: words(stage, 'nextName') }) : th('welcome.h.leadEnd')}</h2>
        <p>{words(stage, 'lead')}</p>
      </section>
      <section id="welcome-steps" aria-labelledby="welcome-steps-h">
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
        <p>{remaining === 0 ? t('welcome.allDone') : t('welcome.toGo', { count: remaining })}</p>
        <div className="button-row"><LinkButton to={back((state as { from?: unknown } | null)?.from)} replace>{t('welcome.go')}</LinkButton></div>
      </section>
      <section id="welcome-moveon" aria-labelledby="welcome-moveon-h">
        <h2 id="welcome-moveon-h">{c.next ? th('welcome.h.moveOn', { next: words(stage, 'nextName') }) : th('welcome.h.moveOnEnd')}</h2>
        <p>{words(stage, 'moveOn')}</p>
        {nextUp ? (
          <>
            <p><strong>{t('welcome.moveOn.first')}</strong> {words(stage, `step.${nextUpIndex + 1}`)}</p>
            <div className="button-row"><LinkButton to={nextUp.to}>{t('welcome.moveOn.cta')}</LinkButton></div>
          </>
        ) : (
          <>
            <p><strong>{t('welcome.moveOn.ready')}</strong></p>
            <div className="button-row"><LinkButton to="/" replace>{t('welcome.moveOn.home')}</LinkButton></div>
          </>
        )}
      </section>
    </div>
  )
}
