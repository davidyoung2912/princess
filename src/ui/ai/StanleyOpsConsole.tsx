import { useId, useState } from 'react'
import { ApiError } from '../../api/errors'
import { questionOf, LIBRARY } from '../../ai/stanleyLibrary'
import { SHIP_FACTS } from '../../domain/finishMore'
import { costDashboard, normalizeHandoffOutcomes, normalizeTierSummary, readDeviceSignals, staleReport, TARGET_LARGE_BELOW, TARGET_NO_MODEL, type CostDashboard, type HandoffOutcomes } from '../../ai/stanleyOps'
import { t, th } from '../../i18n'
import { fetchHandoffOutcomes, fetchStanleyTiers } from '../../runtime'
import { Button } from '../Button'

function askedQuestion(id: string): string {
  const [kind, key] = id.split(':')
  return (kind === 'ship' ? SHIP_FACTS.find((f) => f.id === key)?.q : (() => { const e = LIBRARY.find((x) => x.id === key); return e ? questionOf(e) : undefined })()) ?? id
}

const percent = (v: number | null): string => (v === null ? t('ops.none') : `${v}%`)
const verdict = (ok: boolean | null): string => (ok === null ? '' : ok ? t('ops.meets') : t('ops.misses'))

/**
 * The crew-side content console (phase 14): which written answers are due for review, by owner, and which questions are asked again and again or go unanswered on this device, then the cost
 * of Stanley's replies against the targets, for an administrator. Counts and dates only: there is no thumbs signal, no guest and no words.
 */
export function StanleyOpsConsole() {
  const id = useId()
  const [now] = useState(() => Date.now())
  const owners = staleReport(now)
  const [sig] = useState(readDeviceSignals)
  const [cost, setCost] = useState<CostDashboard | null>(null)
  const [handoffs, setHandoffs] = useState<HandoffOutcomes | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'forbidden' | 'failed'>('idle')

  async function load() {
    setState('busy')
    try {
      const summary = normalizeTierSummary(await fetchStanleyTiers(7))
      setHandoffs(normalizeHandoffOutcomes(await fetchHandoffOutcomes(7).catch(() => null)))
      setCost(summary ? costDashboard(summary) : null)
      setState(summary ? 'idle' : 'failed')
    } catch (e) {
      setState(e instanceof ApiError && e.code === 'forbidden' ? 'forbidden' : 'failed')
    }
  }

  return (
    <section aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>{th('ops.title')}</h3>
      <p>{t('ops.intro')}</p>
      <h4>{t('ops.review.title')}</h4>
      {owners.length === 0 ? <p>{t('ops.review.none')}</p> : (
        <ul>
          {owners.map((o) => (
            <li key={o.owner}>
              <details>
                <summary>{t('ops.review.owner', { owner: o.owner, overdue: o.overdue, due: o.due })}</summary>
                <ul>{o.items.slice(0, 50).map((i) => <li key={i.id}><small>{i.id} · {t(`ops.risk.${i.risk}` as 'ops.risk.low')} · {i.status === 'overdue' ? t('ops.review.overdue', { date: i.expiresOn }) : t('ops.review.dueOn', { date: i.expiresOn })}</small></li>)}</ul>
              </details>
            </li>
          ))}
        </ul>
      )}
      <h4>{t('ops.signals.title')}</h4>
      <p>{t('ops.signals.unanswered', { percent: percent(sig.unansweredShare) })}</p>
      {sig.repeats.length === 0 ? <p>{t('ops.signals.noRepeats')}</p> : <ul>{sig.repeats.map((r) => <li key={r.id}>{t('diag.stanley.repeat.line', { question: askedQuestion(r.id), count: r.count })}</li>)}</ul>}
      <h4>{t('ops.cost.title')}</h4>
      <p>{t('ops.cost.intro', { free: TARGET_NO_MODEL, large: TARGET_LARGE_BELOW })}</p>
      <Button variant="secondary" onClick={() => void load()} disabled={state === 'busy'}>{t('ops.cost.load')}</Button>
      <div role="status">
        {state === 'forbidden' && <p>{t('ops.cost.forbidden')}</p>}
        {state === 'failed' && <p>{t('ops.cost.failed')}</p>}
        {cost && cost.replies === 0 && <p>{t('ops.cost.empty')}</p>}
        {cost && cost.replies > 0 && (
          <ul>
            <li>{t('ops.cost.replies', { count: cost.replies })}</li>
            <li>{t('ops.cost.noModel', { percent: percent(cost.noModelPercent), verdict: verdict(cost.meetsNoModel) })}</li>
            <li>{t('ops.cost.large', { percent: percent(cost.largePercent), verdict: verdict(cost.meetsLarge) })}</li>
            <li>{t('ops.cost.handoff', { percent: percent(cost.handoffPercent) })}</li>
            <li>{t('ops.cost.failedShare', { percent: percent(cost.failedPercent) })}</li>
            <li>{t('ops.cost.tokens', { count: cost.tokensPerResolved ?? t('ops.none') })}</li>
          </ul>
        )}
        {cost && cost.cards.length > 0 && (
          <>
            <h5>{t('ops.cards.title')}</h5>
            <ul>{cost.cards.map((c) => <li key={c.cardId}>{t('ops.cards.line', { card: c.cardId, count: c.replies, abstained: c.abstained })}</li>)}</ul>
          </>
        )}
        {handoffs && handoffs.opened > 0 && (
          <>
            <h5>{t('ops.handoff.title')}</h5>
            <p>{t('ops.handoff.intro', { count: handoffs.opened, percent: percent(handoffs.onTimePercent) })}</p>
            <ul>{handoffs.topics.map((x) => <li key={x.topic}>{t('ops.handoff.line', { topic: x.topic, opened: x.opened, overdue: x.overdue, escalated: x.escalated })}</li>)}</ul>
          </>
        )}
      </div>
    </section>
  )
}
