import { useState } from 'react'
import type { TripView } from '../../api/types'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { addDays, dateIn } from '../../domain/timezones'
import { daysBetween } from '../../domain/trip'
import { cancelOn, cancelSteps, freeWindowNote, ifMissed, moveCheck, oneCannotGo, paymentCalendar, paymentSchedule, priceDrop, type WhatIfBooking } from '../../domain/whatIf'
import { useNow } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Load } from '../account/parts'
import { BackLink } from '../onboard/common'

type Scenario = 'cancel' | 'oneGo' | 'drop' | 'move'
const SCENARIOS: readonly Scenario[] = ['cancel', 'oneGo', 'drop', 'move']
const SCHED_WHAT: Record<'deposit' | 'balance', StringKey> = { deposit: 'sched.deposit', balance: 'sched.balance' }
const SCHED_STATE: Record<'paid' | 'due' | 'overdue' | 'later', StringKey> = { paid: 'sched.paid', due: 'sched.due', overdue: 'sched.overdue', later: 'sched.later' }
const SCENARIO_KEY: Record<Scenario, StringKey> = { cancel: 'whatif.cancel', oneGo: 'whatif.oneGo', drop: 'whatif.drop', move: 'whatif.move' }

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** "What happens if" (S2-01) and the payment schedule with a calendar file (S2-05). It only calculates; it never cancels, changes or charges. */
export function WhatIfScreen() {
  const view = useMine(() => api.payments.get())
  const now = useNow()
  const today = dateIn(now, 'America/New_York')
  return (
    <div className="page">
      <BackLink to="/plan" label={t('route.plan')} />
      <h1>{t('route.whatIf')}</h1>
      <p>{t('whatif.intro')}</p>
      <Banner kind="info" title={t('whatif.concept')} />
      <Load state={view}>{(v) => <Body trip={v.trip} today={today} now={now} />}</Load>
    </div>
  )
}

function Body({ trip, today, now }: { trip: TripView; today: string; now: number }) {
  const b: WhatIfBooking = { plan: trip.plan, guests: trip.guests, today, departure: trip.departure, balancePaid: trip.payment === 'paid', finalDays: daysBetween(trip.plan.finalDue, trip.departure) }
  const [scenario, setScenario] = useState<Scenario>('cancel')
  const [on, setOn] = useState(addDays(today, Math.min(30, Math.max(0, trip.daysToDeparture))))
  const [newTotal, setNewTotal] = useState(String(Math.max(0, trip.plan.total / 100 - 200)))
  const [newDate, setNewDate] = useState(addDays(trip.departure, 21))
  const clamp = on < today ? today : on > trip.departure ? trip.departure : on
  const sched = paymentSchedule(b)

  return (
    <>
      <Card labelledBy="wi-pick">
        <fieldset>
          <legend id="wi-pick">{t('whatif.pick')}</legend>
          {SCENARIOS.map((s) => <label key={s} className="choice"><input type="radio" name="scenario" checked={scenario === s} onChange={() => setScenario(s)} /><span>{t(SCENARIO_KEY[s])}</span></label>)}
        </fieldset>
        {(scenario === 'cancel' || scenario === 'oneGo') && <Field label={t('whatif.date')} type="date" value={on} min={today} max={trip.departure} onChange={(e) => setOn(e.target.value)} />}
        {scenario === 'drop' && <Field label={t('whatif.newTotal')} inputMode="numeric" value={newTotal} onChange={(e) => setNewTotal(e.target.value.replace(/[^\d]/g, ''))} />}
        {scenario === 'move' && <Field label={t('whatif.newSailing')} type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />}
        <div role="status" aria-live="polite">
          {scenario === 'cancel' && <Cancel b={b} on={clamp} />}
          {scenario === 'oneGo' && <OneGo b={b} on={clamp} />}
          {scenario === 'drop' && <Drop b={b} newTotal={Number(newTotal || '0') * 100} />}
          {scenario === 'move' && <p>{t(MOVE_KEY[moveCheck(b, newDate)])}</p>}
        </div>
      </Card>

      <Card labelledBy="wi-steps">
        <h2 id="wi-steps" className="card__title">{t('whatif.steps')}</h2>
        <ul className="plain-list">
          {cancelSteps(b).map((s) => <li key={s.tier}>{t('whatif.stepRow', { date: formatDate(s.from), fee: formatMoney(s.fee), refund: formatMoney(s.refund) })}</li>)}
        </ul>
        <p className="muted">{freeWindowNote()}</p>
      </Card>

      <Card labelledBy="wi-sched">
        <h2 id="wi-sched" className="card__title">{t('sched.title')}</h2>
        <ul className="plain-list">
          {sched.map((i) => <li key={i.id}>{t('sched.row', { what: t(SCHED_WHAT[i.id]), amount: formatMoney(i.amount), date: formatDate(i.due) })} <strong>{t(SCHED_STATE[i.state])}</strong></li>)}
        </ul>
        {sched.some((i) => i.state !== 'paid') ? (
          <>
            <p>{ifMissed(b)}</p>
            <p className="muted">{t('sched.calendarHint')}</p>
            <Button variant="secondary" onClick={() => download('payments.ics', paymentCalendar(b, trip.number, now))}>{t('sched.calendar')}</Button>
          </>
        ) : <p>{t('sched.none')}</p>}
      </Card>
    </>
  )
}

const MOVE_KEY: Record<ReturnType<typeof moveCheck>, StringKey> = { ok: 'whatif.moveOk', same: 'whatif.moveSame', tooLate: 'whatif.moveTooLate', newTooSoon: 'whatif.moveNewTooSoon' }

function Money({ fee, refund, paid }: { fee: number; refund: number; paid: number }) {
  return (
    <dl className="facts">
      <div><dt>{t('whatif.paid')}</dt><dd>{formatMoney(paid)}</dd></div>
      <div><dt>{t('whatif.fee')}</dt><dd>{formatMoney(fee)}</dd></div>
      <div><dt>{t('whatif.refund')}</dt><dd>{formatMoney(refund)}</dd></div>
    </dl>
  )
}

const Cancel = ({ b, on }: { b: WhatIfBooking; on: string }) => { const o = cancelOn(b, on); return <Money fee={o.fee} refund={o.refund} paid={o.paid} /> }

function OneGo({ b, on }: { b: WhatIfBooking; on: string }) {
  const o = oneCannotGo(b, on)
  if (!o) return <p>{t('whatif.single')}</p>
  return (
    <>
      <p>{t('whatif.share')}: {formatMoney(o.share)}</p>
      <Money fee={o.fee} refund={o.refund} paid={o.paid} />
      <p className="muted">{t('whatif.others', { n: o.remaining })}</p>
    </>
  )
}

function Drop({ b, newTotal }: { b: WhatIfBooking; newTotal: number }) {
  const r = priceDrop(b, newTotal)
  if (r.ok) return <p>{t('whatif.saving', { amount: formatMoney(r.saving), date: formatDate(b.plan.finalDue) })}</p>
  return <p>{t(r.reason === 'notLower' ? 'whatif.notLower' : 'whatif.afterFinal')}</p>
}
