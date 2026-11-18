import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Check, Clock } from 'lucide-react'
import type { GuideTask, GuideView } from '../../api/guideTypes'
import { dotReason, publishDot } from '../../ai/stanleyDot'
import { doneTasks, moreCount, openTasks, primaryOf } from '../../guide/view'
import { moveOnWords, taskMeta, taskWords } from '../../guide/words'
import { useGuideView } from '../../hooks/useGuideView'
import { useSettings } from '../../hooks/useSettings'
import { t, th, type StringKey } from '../../i18n'
import { openedFrom } from '../../routes/screens'
import { stanleyLevelFor } from '../../settings/settings'
import { Button, LinkButton } from '../Button'
import { getContext, subscribeContext } from '../../account/context'
import { demoNow } from '../../demo/store'
import { isoDay } from '../../domain/rates'
import { putOffGuideTask, restoreGuideTask, skipGuideTask } from '../../guide/choicesStore'
import { markTaskHere, noteGuideHere } from '../../diagnostics/guideFunnel'
import { refreshGuide } from '../../guide/refresh'
import { handoffFor, handoffKey } from '../../guide/handoff'
import { getProgress, recordVisit, subscribeProgress } from '../../stageProgress/store'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { FitPrompt, FitQuestion } from './FitPrompt'
import { formatDate } from '../../domain/cruise'
import { Card } from '../Card'
import { TaskCalendar, TaskDoIt, TaskHelp, TaskRemind } from '../ai/GuideStanley'

const Meta = ({ task }: { task: GuideTask }) => <p className="guide__meta muted">{taskMeta(task).join(' · ')}</p>

/** The stage line: where the guest is, how far through, and what really moves them on (with its date). */
function StageLine({ view }: { view: GuideView }) {
  return (
    <div className="guide__line">
      <p className="guide__stage"><strong>{t(`journey.stage.${view.stage}` as StringKey)}</strong> · {t('guide.progress', { done: view.counts.done, total: view.counts.total })}</p>
      <p className="muted">{moveOnWords(view.moveOn)}</p>
    </div>
  )
}

const DAY_MS = 86_400_000

/** What the guest can do to put a task aside, and the polite message that says it was. A task with a real deadline cannot be put aside, so it gets no buttons. */
function useAside() {
  const personId = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  const [said, setSaid] = useState('')
  return {
    said,
    skip: (task: GuideTask) => { skipGuideTask(personId, task, demoNow()); markTaskHere(task.id, 'skipped'); setSaid(t('guide.aside.live', { task: taskWords(task).title })) },
    later: (task: GuideTask) => { putOffGuideTask(personId, task, isoDay(demoNow() + DAY_MS)); setSaid(t('guide.aside.live', { task: taskWords(task).title })) },
    restore: async (id: string) => {
      restoreGuideTask(personId, id)
      setSaid(t('guide.restored.live', { task: taskWords({ id }).title }))
      // The server drops a put-aside task from the plan, so read it again once the change is saved.
      await refreshGuide()
    },
  }
}

type Aside = ReturnType<typeof useAside>

function PutAside({ task, aside }: { task: GuideTask; aside: Aside }) {
  if (task.hard || task.state === 'done') return null
  const title = taskWords(task).title
  return (
    <span className="guide__aside">
      <Button variant="tertiary" onClick={() => aside.later(task)} aria-label={t('guide.laterFor', { task: title })}>{t('guide.later')}</Button>
      <Button variant="tertiary" onClick={() => aside.skip(task)} aria-label={t('guide.skipFor', { task: title })}>{t('guide.skip')}</Button>
    </span>
  )
}

/** One short message when a stage opens: where the guest is, what comes first. Dismissed once, it is remembered on the server so no device asks again. */
function Handoff({ view }: { view: GuideView }) {
  const { focusSailingId } = useJourneyPosition()
  const personId = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  const progress = useSyncExternalStore(subscribeProgress, () => getProgress(personId), () => getProgress(personId))
  const hand = handoffFor(view, progress, focusSailingId)
  if (!hand) return null
  const tasks = hand.first.map((id) => taskWords({ id }).title.toLowerCase()).join(', ')
  return (
    <Card info labelledBy="guide-handoff-h">
      <div className="guide__handoff" role="status">
        <h2 id="guide-handoff-h" className="card__title">{th('guide.handoff.title', { stage: t(`journey.stage.${hand.stage}` as StringKey) })}</h2>
        <p>{t(hand.first.length === 1 ? 'guide.handoff.first1' : 'guide.handoff.first', { tasks })} {hand.more > 0 && t('guide.handoff.more', { count: hand.more })}</p>
        <p className="muted">{moveOnWords(view.moveOn)}</p>
      </div>
      <Button variant="tertiary" onClick={() => recordVisit(personId, handoffKey(hand.stage, focusSailingId), demoNow())}>{t('guide.handoff.dismiss')}</Button>
    </Card>
  )
}

function DoNow({ task, aside, view }: { task: GuideTask; aside: Aside; view: GuideView }) {
  const w = taskWords(task)
  return (
    <Card hero labelledBy="guide-now-h">
      <h2 id="guide-now-h" className="card__title">{th('guide.now')}</h2>
      <p className="guide__task">{w.title}</p>
      {task.changed && <p className="guide__changed" role="status"><strong>{t('guide.changed')}</strong> {task.changed.what} {task.changed.why}</p>}
      <p>{w.why}</p>
      {task.urgency === 'now' && <p className="guide__urgent"><Clock size={16} aria-hidden="true" /> {t('guide.urgent')}</p>}
      <Meta task={task} />
      <div className="button-row"><LinkButton to={task.to} state={openedFrom('blue', task.id)} aria-label={t('guide.startTask', { task: w.title })}>{t('guide.start')}</LinkButton><TaskDoIt task={task} where="home" /></div>
      <div className="guide__more"><PutAside task={task} aside={aside} /><TaskHelp task={task} view={view} /><TaskRemind task={task} /><TaskCalendar task={task} /></div>
    </Card>
  )
}

function Row({ task, aside, view }: { task: GuideTask; aside: Aside; view: GuideView }) {
  const w = taskWords(task)
  return (
    <li className="stage-step">
      <span className="stage-step__body">
        <LinkButton variant="secondary" icon={ArrowRight} to={task.to} state={openedFrom('blue', task.id)}>{w.title}</LinkButton>
        <Meta task={task} />
      </span>
      <PutAside task={task} aside={aside} />
      <TaskHelp task={task} view={view} />
      <TaskRemind task={task} />
      <TaskCalendar task={task} />
    </li>
  )
}

/**
 * The guest's plan on Home, at every stage (docs/next-steps-guidance-plan.md section 3.2): the stage line, one "Do this now" with its why, due date and button, then up to
 * four more to come, then what is done. It reads the same guide as the landing card, the journey strip and Stanley, so none of them can disagree. It also tells
 * Stanley's speech dot whether the guide has something urgent.
 */
export function StageGuide() {
  const { data: view, stale } = useGuideView()
  const aside = useAside()
  const [settings] = useSettings()
  const reason = dotReason(view, stanleyLevelFor(settings))
  useEffect(() => { publishDot(reason); return () => publishDot(null) }, [reason])
  useEffect(() => { if (view) noteGuideHere(view) }, [view])
  if (!view) return null
  const primary = primaryOf(view)
  const open = openTasks(view)
  const rest = open.filter((x) => x.id !== primary?.id)
  const done = doneTasks(view)
  const more = moreCount(view)
  return (
    <section aria-label={t('guide.title')} className="guide">
      <StageLine view={view} />
      {(view.stage === 'dream' || view.stage === 'discover') && <FitPrompt />}
      <FitQuestion stage={view.stage} />
      {stale && <p className="muted">{t('guide.stale')}</p>}
      <Handoff view={view} />
      {primary ? <DoNow task={primary} aside={aside} view={view} /> : (
        <Card info>
          <p>{t('guide.ahead')}</p>
          <p className="muted">{t('guide.aheadNext', { moveOn: moveOnWords(view.moveOn) })}</p>
          {rest[0] && <p><Link to={rest[0].to} state={openedFrom('blue', rest[0].id)}>{t('guide.lookAhead')}: {taskWords(rest[0]).title}</Link></p>}
        </Card>
      )}
      {rest.length > 0 && (
        <section aria-labelledby="guide-soon-h" className="stage-next">
          <h2 id="guide-soon-h">{th('guide.soon')}</h2>
          <ol className="stage-steps">{rest.map((x) => <Row key={x.id} task={x} aside={aside} view={view} />)}</ol>
          {more > 0 && <p className="muted">{t('guide.more', { count: more })} <Link to="/plan">{t('guide.moreLink')}</Link></p>}
        </section>
      )}
      {done.length > 0 && (
        <details className="guide__done">
          <summary>{th('guide.doneCount', { count: done.length })}</summary>
          <ul className="stage-steps">
            {done.map((x) => <li key={x.id} className="stage-step stage-steps__done"><span className="stage-step__num" aria-hidden="true"><Check size={16} className="tick-draw" /></span><span className="stage-step__body">{taskWords(x).title}<span className="visually-hidden"> · {t('guide.done')}</span></span></li>)}
          </ul>
        </details>
      )}
      {(view.hidden.length > 0 || view.deferred.length > 0) && (
        <details className="guide__done">
          <summary>{th('guide.asideCount', { count: view.hidden.length + view.deferred.length })}</summary>
          <ul className="stage-steps">
            {view.hidden.map((id) => <AsideRow key={id} id={id} text={t('guide.asideHidden', { task: taskWords({ id }).title })} aside={aside} />)}
            {view.deferred.map((d) => <AsideRow key={d.id} id={d.id} text={t('guide.asideLater', { date: formatDate(d.until), task: taskWords({ id: d.id }).title })} aside={aside} />)}
          </ul>
        </details>
      )}
      <p className="visually-hidden" role="status" aria-live="polite">{aside.said}</p>
    </section>
  )
}

function AsideRow({ id, text, aside }: { id: string; text: string; aside: Aside }) {
  return (
    <li className="stage-step">
      <span className="stage-step__body">{text}</span>
      <Button variant="tertiary" onClick={() => { void aside.restore(id) }} aria-label={t('guide.restoreFor', { task: taskWords({ id }).title })}>{t('guide.restore')}</Button>
    </li>
  )
}
