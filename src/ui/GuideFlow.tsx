import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { flowAt } from '../guide/flow'
import { moveOnWords, taskWords } from '../guide/words'
import { useGuideView } from '../hooks/useGuideView'
import { t, th, type StringKey } from '../i18n'
import { openedFrom } from '../routes/screens'
import { LinkButton } from './Button'

const stageName = (stage: string): string => t(`journey.stage.${stage}` as StringKey)
const fromTask = (state: unknown): string | null => { const g = (state as { guide?: unknown } | null)?.guide; return typeof g === 'string' ? g : null }

/** A slim line on top of a screen the guest opened from their plan: where this step sits, and a way back. Nothing is drawn for a screen opened any other way. */
export function GuideCrumb() {
  const { pathname, state } = useLocation()
  const { data: view } = useGuideView()
  const from = fromTask(state)
  const flow = view && from ? flowAt(view, pathname, from) : null
  if (!flow) return null
  return (
    <div className="page guide-crumb-wrap">
      <p className="guide-crumb muted">
        <Link to="/" state={openedFrom('blue')}>{t('guide.crumb.back')}</Link> · {t('guide.crumb', { n: flow.n, total: flow.total, task: taskWords(flow.task).title })}
      </p>
    </div>
  )
}

/**
 * The foot of a screen that is a step in the plan: what is next, as a button, and how much is left. It also says, politely, when the step on this screen becomes done.
 * It reads the same guide as Home, so the two cannot disagree.
 */
export function WhatNext() {
  const { pathname, state } = useLocation()
  const { data: view } = useGuideView()
  const flow = view && pathname !== '/' ? flowAt(view, pathname, fromTask(state)) : null
  const was = useRef<{ id: string; done: boolean } | null>(null)
  const [said, setSaid] = useState('')
  useEffect(() => {
    if (!flow || !view) { was.current = null; return }
    const done = flow.task.state === 'done'
    const prev = was.current
    was.current = { id: flow.task.id, done }
    if (prev && prev.id === flow.task.id && !prev.done && done) {
      const task = taskWords(flow.task).title
      const stage = stageName(view.stage)
      setSaid(flow.left > 0 ? t('guide.next.doneLive', { task, count: flow.left, stage }) : t('guide.next.allLive', { task, stage }))
    }
  }, [flow, view])
  if (!flow || !view) return <div className="visually-hidden" role="status" aria-live="polite">{said}</div>
  const stage = stageName(view.stage)
  const { next, left } = flow
  return (
    <div className="page guide-next-wrap">
      <section className="card guide-next" aria-labelledby="guide-next-h">
        <h2 id="guide-next-h">{th('guide.next.title')}</h2>
        <p className="muted">{left > 0 ? t('guide.next.left', { count: left, stage }) : t('guide.next.none', { stage })}</p>
        {left === 0 && <p className="muted">{t('guide.next.then', { moveOn: moveOnWords(view.moveOn) })}</p>}
        <div className="guide-next__actions">
          {next && <LinkButton to={next.to} state={openedFrom('blue', next.id)}>{t('guide.next.go', { task: taskWords(next).title })}</LinkButton>}
          <LinkButton to="/" variant={next ? 'secondary' : 'primary'} state={openedFrom('blue')}>{t('guide.next.home')}</LinkButton>
        </div>
      </section>
      <div className="visually-hidden" role="status" aria-live="polite">{said}</div>
    </div>
  )
}
