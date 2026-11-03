import { useCallback, useEffect, useState } from 'react'
import { applyFilter, describeEvent, groupByActivityDay, isProblem, nextCursor, type ActivityEvent, type ActivityFilter } from '../../domain/activityLog'
import { formatDayMonth } from '../../domain/cruise'
import { usePersona } from '../../hooks/useDemo'
import { t, th, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'

const PAGE = 50

/** The guest's own audit report: what was done on their account, newest first, with what failed marked. */
export function ActivityScreen() {
  // Keyed by the signed-in person, so another person never sees the previous person's report while theirs loads.
  return <Report key={usePersona()?.id ?? ''} />
}

function Report() {
  const shipTime = useShipTime()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [more, setMore] = useState<number | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [filter, setFilter] = useState<ActivityFilter>({ outcome: 'all' })

  const fetchPage = useCallback((before?: number) => {
    api.account.activity({ max: PAGE, before }).then(
      (page) => {
        setEvents((old) => (before ? [...old, ...page] : page))
        setMore(nextCursor(page, PAGE))
        setStatus('ready')
      },
      () => setStatus('error'),
    )
  }, [])
  const load = (before?: number) => {
    setStatus('loading')
    fetchPage(before)
  }

  useEffect(() => fetchPage(), [fetchPage])

  const shown = applyFilter(events, filter)
  const days = groupByActivityDay(shown, (at) => new Date(at).toISOString().slice(0, 10))
  return (
    <div className="page">
      <h1>{th('route.activity')}</h1>
      <p>{t('activity.intro')}</p>
      <div className="field">
        <label htmlFor="activity-filter">{t('activity.filter.label')}</label>
        <select id="activity-filter" value={filter.outcome} onChange={(e) => setFilter({ outcome: e.target.value === 'problems' ? 'problems' : 'all' })}>
          <option value="all">{t('activity.filter.all')}</option>
          <option value="problems">{t('activity.filter.problems')}</option>
        </select>
      </div>
      {status === 'error' && (
        <Card info>
          <p role="alert">{t('activity.error.load')}</p>
          <Button variant="secondary" onClick={() => load(events.length ? more ?? undefined : undefined)}>{t('activity.retry')}</Button>
        </Card>
      )}
      {status === 'loading' && events.length === 0 && <p role="status" className="muted">{t('account.loading')}</p>}
      {status === 'ready' && shown.length === 0 && <Card info><p>{t(filter.outcome === 'problems' ? 'activity.none.problems' : 'activity.none')}</p></Card>}
      {shown.length > 0 && <p role="status">{t('activity.count', { count: shown.length })}</p>}
      {days.map((d) => (
        <section key={d.day} aria-labelledby={`act-${d.day}`}>
          <h2 id={`act-${d.day}`}>{formatDayMonth(d.day)}</h2>
          <ul className="plain-list">
            {d.events.map((e) => <Row key={e.id} e={e} when={shipTime(e.at)} />)}
          </ul>
        </section>
      ))}
      {more !== null && <Button variant="secondary" disabled={status === 'loading'} onClick={() => load(more)}>{t('activity.more')}</Button>}
      {more === null && status === 'ready' && events.length > 0 && <p className="muted">{t('activity.end')}</p>}
      <BackLink to="/me/settings" label={t('route.settings')} />
    </div>
  )
}

function Row({ e, when }: { e: ActivityEvent; when: string }) {
  const line = describeEvent(e)
  return (
    <li>
      <span>
        {t(`activity.${line.key}` as StringKey, line.values)}
        <small className="muted"> · {when}{!e.byYou && <> · {t('activity.byOther')}</>}</small>
        {line.note && e.category !== 'auth' && e.category !== 'error' && <small className="muted"> · {line.note}</small>}
        {isProblem(e) && e.requestId && <small className="muted"> · {t('activity.request', { id: e.requestId.slice(0, 40) })}</small>}
      </span>
      <span className={e.outcome === 'success' ? 'tag' : 'tag tag--alert'}>{t(`activity.outcome.${e.outcome}` as StringKey)}</span>
    </li>
  )
}
