import { PastedLines } from '../PastedLines'
import { useState } from 'react'
import { Link } from 'react-router'
import { gentleNotes } from '../../domain/autopilot'
import { acceptChange, addProposal, canUndo, changeLog, declineChange, proposeReflow, shipChangesFor, undoChange, visibleRows, type Cause, type Change, type Edit, type PlanRow } from '../../domain/planChange'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { useNow } from '../../hooks/useDemo'
import { usePilot } from '../../hooks/usePilot'
import { programmeFollows } from '../../pilot/programme'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { FeedWaiting } from '../FeedWaiting'
import { REFUSED } from './refused'
import { SlotWatch } from './SlotWatch'
import { WeekPlanner } from './WeekPlanner'

const TENDER_DELAYS = [20, 40, 60] as const

/** The sentence for one edit, from the rows it would act on. */
function describe(edit: Edit, rows: readonly PlanRow[]): string {
  if (edit.op === 'add') return t('autopilot.edit.add', { title: edit.entry.title, start: edit.entry.start })
  const row = rows.find((r) => r.entry.id === edit.id)
  const title = row?.entry.title ?? edit.id
  return edit.op === 'drop' ? t('autopilot.edit.drop', { title }) : t('autopilot.edit.move', { title, from: row?.entry.start ?? '', to: edit.to })
}

/** Autopilot day (S6-02, S6-03, S4-01, S4-02): the day plan proposes changes when something moves; nothing changes until the guest accepts, and an accepted change can be undone. */
export function AutopilotScreen() {
  const { state, update } = usePilot()
  const now = useNow()
  const time = useShipTime()
  const today = useCurrentDay()
  const [day, setDay] = useState(today)
  const [message, setMessage] = useState<StringKey | null>(null)
  const [delay, setDelay] = useState<number>(40)
  const dp = useDayPlan(day)
  const port = dp.itineraryDay.allAboard !== undefined
  const waiting = dp.changes.filter((c) => c.status === 'proposed')
  const log = changeLog(dp.changes.filter((c) => c.status !== 'proposed'))
  const shown = visibleRows(dp.rows, now, dp.dayEndAt)
  const notes = state.gentle ? gentleNotes(dp.rows, dp.weather) : []

  const commit = (next: readonly Change[]) => {
    programmeFollows(api.onboard, dp.sailing, state.prefs, dp.changes, next)
    update((s) => ({ ...s, changes: [...s.changes.filter((c) => c.day !== day), ...next] }))
  }
  const propose = (causes: Cause[]) => {
    let next = dp.changes
    let added = 0
    for (const cause of causes) {
      const c = proposeReflow(dp.rows, cause, dp.alternatives, { now, day, dayEndAt: dp.dayEndAt })
      if (c && !next.some((x) => x.id === c.id)) { next = addProposal(next, c); added++ }
    }
    commit(next)
    setMessage(added > 0 ? 'autopilot.found' : 'autopilot.none')
  }
  const check = () => {
    const causes: Cause[] = shipChangesFor(dp.sailing, day, dp.rows)
    if (dp.weather?.rainFrom && dp.weather.rainTo) causes.push({ kind: 'rain', from: dp.weather.rainFrom, to: dp.weather.rainTo })
    propose(causes)
  }
  const accept = (id: string) => {
    const r = acceptChange(dp.base, dp.changes, id, now)
    if (r.ok) { commit(r.changes); setMessage('autopilot.accepted') } else setMessage(REFUSED[r.reason])
  }

  return (
    <div className="page">
      <h1>{t('route.autopilot')}</h1>
      <p>{t('autopilot.intro')}</p>
      <p className="muted">{t('autopilot.promise')}</p>

      <PastedLines day={day} />
      <Card labelledBy="ap-day">
        <h2 id="ap-day" className="card__title">{t('autopilot.day')}</h2>
        <label htmlFor="ap-pick">{t('autopilot.pick')}</label>
        <select id="ap-pick" className="field__input" value={day} onChange={(e) => { setDay(Number(e.target.value)); setMessage(null) }}>
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t('autopilot.dayOption', { n })}{n === today ? ` · ${t('autopilot.today')}` : ''}</option>)}
        </select>
        {dp.weather ? <p className="muted">{t('autopilot.sky', { uv: dp.weather.uv, f: dp.weather.tempF, c: Math.round(((dp.weather.tempF - 32) * 5) / 9) })}{dp.weather.rainFrom ? ` ${t('autopilot.rain', { from: dp.weather.rainFrom, to: dp.weather.rainTo ?? '' })}` : ''} {t('autopilot.simulated')}</p> : <FeedWaiting />}
        <ul className="plain-list">
          {shown.map((r) => (
            <li key={r.entry.id} className={r.state === 'dropped' ? 'plan-row--dropped' : undefined}>
              <strong>{r.entry.start}</strong> <Link to={r.entry.path}>{r.entry.title}</Link>
              {r.state !== 'planned' && <span className="plan-row__note">{t(`autopilot.state.${r.state}` as StringKey, { was: r.was ?? '' })}</span>}
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p>{t('autopilot.empty')}</p>}
        <label className="choice"><input type="checkbox" checked={state.gentle} onChange={(e) => update((s) => ({ ...s, gentle: e.target.checked }))} /><span>{t('gentle.on')}<small>{t('gentle.hint')}</small></span></label>
        {notes.length > 0 && (
          <ul className="plain-list" aria-label={t('gentle.list')}>
            {notes.map((n, i) => <li key={`${n.kind}-${n.about}-${i}`}>{n.at}: {t(`gentle.${n.kind}` as StringKey, { title: dp.rows.find((r) => r.entry.id === n.about)?.entry.title ?? '' })}</li>)}
          </ul>
        )}
      </Card>

      <Card labelledBy="ap-check">
        <h2 id="ap-check" className="card__title">{t('autopilot.check')}</h2>
        <p>{t('autopilot.checkBody')}</p>
        <div className="button-row">
          <Button onClick={check}>{t('autopilot.checkNow')}</Button>
          {port && dp.itineraryDay.allAboard && (
            <>
              <label htmlFor="ap-delay" className="muted">{t('autopilot.tender')}</label>
              <select id="ap-delay" className="field__input" value={delay} onChange={(e) => setDelay(Number(e.target.value))}>{TENDER_DELAYS.map((m) => <option key={m} value={m}>{t('autopilot.minutes', { count: m })}</option>)}</select>
              <Button variant="secondary" onClick={() => propose([{ kind: 'tender', delayMinutes: delay, allAboard: dp.itineraryDay.allAboard ?? '16:30' }])}>{t('autopilot.tenderGo')}</Button>
            </>
          )}
        </div>
        {message && <p role="status">{t(message)}</p>}
      </Card>

      {waiting.length > 0 && (
        <section aria-labelledby="ap-wait">
          <h2 id="ap-wait">{t('autopilot.waiting')}</h2>
          {waiting.map((c) => (
            <Card key={c.id}>
              <h3 className="card__title">{c.title}</h3>
              <p className="muted">{c.cause}</p>
              <p>{c.why}</p>
              <ul className="plain-list" aria-label={t('autopilot.preview')}>{c.edits.map((e, i) => <li key={i}>{describe(e, dp.rows)}</li>)}</ul>
              {c.warning && <Banner kind="warning" title={t('autopilot.warning')}><p>{c.warning}</p></Banner>}
              <p className="muted">{t('autopilot.undoUntil', { time: time(c.undoUntil) })}</p>
              <div className="button-row">
                <Button onClick={() => accept(c.id)}>{t('autopilot.accept')}</Button>
                <Button variant="secondary" onClick={() => commit(declineChange(dp.changes, c.id, now))}>{t('autopilot.decline')}</Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <section aria-labelledby="ap-log">
        <h2 id="ap-log">{t('autopilot.log')}</h2>
        {log.length === 0 ? <p className="muted">{t('autopilot.logEmpty')}</p> : (
          <ul className="plain-list">
            {log.map((c) => (
              <li key={c.id}>
                {t(`autopilot.status.${c.status}` as StringKey)}: {c.title} <span className="muted">({c.source === 'assistant' ? t('autopilot.fromAsk') : t('autopilot.fromAutopilot')}, {time(c.decidedAt ?? c.proposedAt)})</span>
                {canUndo(c, now) && <> <Button variant="tertiary" onClick={() => commit(undoChange(dp.changes, c.id, now))}>{t('autopilot.undo')}</Button></>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <WeekPlanner />
      <SlotWatch />
      <BackLink to="/plan" label={t('route.plan')} />
    </div>
  )
}
