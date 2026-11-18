import { useEffect } from 'react'
import { Link } from 'react-router'
import { Check, Clock } from 'lucide-react'
import type { GuideTask, GuideView } from '../../api/guideTypes'
import { dotReason, publishDot } from '../../ai/stanleyDot'
import { doneTasks, moreCount, openTasks, primaryOf } from '../../guide/view'
import { moveOnWords, taskMeta, taskWords } from '../../guide/words'
import { useGuideView } from '../../hooks/useGuideView'
import { useSettings } from '../../hooks/useSettings'
import { t, th, type StringKey } from '../../i18n'
import { openedFrom } from '../../routes/screens'
import { stanleyLevelFor } from '../../settings/settings'
import { LinkButton } from '../Button'
import { Card } from '../Card'

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

function DoNow({ task }: { task: GuideTask }) {
  const w = taskWords(task)
  return (
    <Card hero labelledBy="guide-now-h">
      <h2 id="guide-now-h" className="card__title">{th('guide.now')}</h2>
      <p className="guide__task">{w.title}</p>
      <p>{w.why}</p>
      {task.urgency === 'now' && <p className="guide__urgent"><Clock size={16} aria-hidden="true" /> {t('guide.urgent')}</p>}
      <Meta task={task} />
      <div className="button-row"><LinkButton to={task.to} state={openedFrom('blue')} aria-label={t('guide.startTask', { task: w.title })}>{t('guide.start')}</LinkButton></div>
    </Card>
  )
}

function Row({ task }: { task: GuideTask }) {
  const w = taskWords(task)
  return (
    <li className="stage-step">
      <span className="stage-step__body">
        <Link to={task.to} state={openedFrom('blue')}>{w.title}</Link>
        <Meta task={task} />
      </span>
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
  const [settings] = useSettings()
  const reason = dotReason(view, stanleyLevelFor(settings))
  useEffect(() => { publishDot(reason); return () => publishDot(null) }, [reason])
  if (!view) return null
  const primary = primaryOf(view)
  const open = openTasks(view)
  const rest = open.filter((x) => x.id !== primary?.id)
  const done = doneTasks(view)
  const more = moreCount(view)
  return (
    <section aria-label={t('guide.title')} className="guide">
      <StageLine view={view} />
      {stale && <p className="muted">{t('guide.stale')}</p>}
      {primary ? <DoNow task={primary} /> : (
        <Card info>
          <p>{t('guide.allDone')}</p>
          {rest[0] && <p><Link to={rest[0].to} state={openedFrom('blue')}>{t('guide.lookAhead')}: {taskWords(rest[0]).title}</Link></p>}
        </Card>
      )}
      {rest.length > 0 && (
        <section aria-labelledby="guide-soon-h" className="stage-next">
          <h2 id="guide-soon-h">{th('guide.soon')}</h2>
          <ol className="stage-steps">{rest.map((x) => <Row key={x.id} task={x} />)}</ol>
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
    </section>
  )
}
