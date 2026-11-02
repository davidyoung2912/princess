import { useState } from 'react'
import { Link } from 'react-router'
import type { PortDayView } from '../../api/types'
import { partyOf } from '../../domain/personas'
import { PORT_GUIDES } from '../../domain/ports'
import { crowdFor, hourlyCrowd, quietestWindow } from '../../domain/portCrowd'
import { agreePlan, clearPlan, dayOf, planAgreed, proposePlan, setPlanB } from '../../domain/portParty'
import { ACCESSIBLE_TENDER_STEPS, BUFFER_CHOICES, DEFAULT_BUFFER, latestStart, PLAN_B, PLAN_B_TRIGGERS, planPortDay, pilotStepLabel, recommendedPlanB, type PlanBTrigger } from '../../domain/portPilot'
import { PORTS } from '../../domain/sailings'
import { clockTime } from '../../domain/syncAge'
import { usePort } from '../../hooks/usePort'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { duration, useShipTime } from './shipTime'

const TRAVEL_CHOICES = [0, 10, 20, 30, 45, 60] as const

/** The Port Day Pilot (S6A-01 to S6A-04, S6A-06, S6A-15): the leave-by time worked backward from all-aboard, the crowd, a plan B in one tap, and a plan the group agrees on. */
export function PortPilot({ v }: { v: PortDayView }) {
  const shipTime = useShipTime()
  const { state, update, me } = usePort()
  const port = v.day.port
  const excursions = PORT_GUIDES[port].excursions
  const crowd = crowdFor(port, v.day.date)
  const day = dayOf(state.party, v.day.date)
  const [outing, setOuting] = useState<string>(day.plan?.outing ?? 'free')
  const [travel, setTravel] = useState<number>(day.plan?.travelMinutes ?? 20)
  const [buffer, setBuffer] = useState<number>(day.plan?.buffer ?? DEFAULT_BUFFER)
  const choice = excursions.find((x) => x.id === outing)
  const plan = planPortDay({
    day: v.day, travelMinutes: travel, outingMinutes: choice ? Math.round(choice.hours * 60) : null, buffer, crowd: crowd.level,
    tenderCallAt: v.tender?.callAt ?? null, tenderDelayMinutes: v.tender ? 0 : v.delayMinutes,
  })
  const start = latestStart({ day: v.day, travelMinutes: travel, outingMinutes: choice ? Math.round(choice.hours * 60) : null, buffer, crowd: crowd.level, tenderCallAt: v.tender?.callAt ?? null })
  const both = (at: number) => {
    const ship = shipTime(at)
    const local = clockTime(new Date(at), v.day.portZone)
    return ship === local ? ship : t('pilot.both', { ship, local })
  }
  const members = me ? partyOf(me.id) : []
  const ids = members.map((m) => m.id)
  const agreed = planAgreed(day.plan, ids)
  const iAgreed = !!me && !!day.plan?.agreed.includes(me.id)
  const hours = hourlyCrowd(crowd, 8, 17)
  const quiet = quietestWindow(hours)
  const recommended = recommendedPlanB({ tenderDelayMinutes: v.tender?.delayMinutes ?? v.delayMinutes, tenderInstead: v.tender?.mayTender ?? false, tender: v.day.tender })
  const planB = PLAN_B[port]
  const chosenB = day.planB && (PLAN_B_TRIGGERS as readonly string[]).includes(day.planB) ? planB[day.planB as PlanBTrigger] : null

  return (
    <>
      <Card hero labelledBy="pilot-h">
        <h2 id="pilot-h" className="card__title">{t('pilot.title', { port: PORTS[port].name })}</h2>
        <p className="muted">{t('pilot.intro')}</p>
        <fieldset>
          <legend>{t('pilot.outing')}</legend>
          <label className="choice"><input type="radio" name="pilot-outing" checked={outing === 'free'} onChange={() => setOuting('free')} /><span>{t('pilot.free')}</span></label>
          {excursions.map((x) => (
            <label key={x.id} className="choice"><input type="radio" name="pilot-outing" checked={outing === x.id} onChange={() => setOuting(x.id)} /><span>{t('pilot.excursion', { name: x.name, hours: x.hours })}</span></label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t('pilot.travel')}</legend>
          {TRAVEL_CHOICES.map((m) => <label key={m} className="choice"><input type="radio" name="pilot-travel" checked={travel === m} onChange={() => setTravel(m)} /><span>{m === 0 ? t('pilot.travel.none') : t('pilot.travel.minutes', { minutes: m })}</span></label>)}
        </fieldset>
        <fieldset>
          <legend>{t('pilot.buffer')}</legend>
          {BUFFER_CHOICES.map((m) => <label key={m} className="choice"><input type="radio" name="pilot-buffer" checked={buffer === m} onChange={() => setBuffer(m)} /><span>{t('pilot.buffer.minutes', { minutes: m })}</span></label>)}
          <p className="muted">{t('pilot.buffer.why')}</p>
        </fieldset>
        <p className="aboard__deadline"><strong>{t('pilot.leaveBy', { time: both(plan.leaveBy) })}</strong></p>
        {choice && (plan.fits
          ? <p role="status">{t('pilot.fits', { minutes: duration(plan.minutesThere) })}{start !== null ? ` ${t('pilot.latestStart', { time: both(start) })}` : ''}</p>
          : <Banner kind="warning" title={t('pilot.tooLong')}><p>{t('pilot.tooLongBody', { short: duration(plan.shortBy), name: choice.name })}</p></Banner>)}
        {!choice && (plan.minutesThere > 0 ? <p role="status">{t('pilot.timeThere', { minutes: duration(plan.minutesThere) })}</p> : <Banner kind="warning" title={t('pilot.noTime')}><p>{t('pilot.noTimeBody')}</p></Banner>)}
        <h3>{t('pilot.steps')}</h3>
        <ol className="plain-bullets">{plan.steps.map((s) => <li key={s.id}>{t(pilotStepLabel(s.id), { time: both(s.at) })}</li>)}</ol>
        <p className="muted">{t('pilot.threeClocks')}</p>
      </Card>

      <Card labelledBy="crowd-h">
        <h2 id="crowd-h" className="card__title">{t('crowd.title')}</h2>
        <p>{t('crowd.ships', { count: crowd.ships })} <span className="muted">{t(`crowd.level.${crowd.level}` as StringKey)}</span></p>
        {crowd.stayAboardNote && <Banner kind="info" title={t('crowd.stayAboard')}><p>{t('crowd.stayAboardBody')}</p></Banner>}
        <p>{quiet ? t('crowd.quietest', { from: hourName(quiet.from), to: hourName(quiet.to) }) : t('crowd.noQuiet')}</p>
        <p className="muted">{t('crowd.sim')}</p>
      </Card>

      <Card labelledBy="planb-h">
        <h2 id="planb-h" className="card__title">{t('planb.title')}</h2>
        <p className="muted">{t('planb.intro')}</p>
        {recommended && <p role="status">{t('planb.suggested', { name: t(`planb.t.${recommended}` as StringKey) })}</p>}
        <fieldset>
          <legend>{t('planb.pick')}</legend>
          {PLAN_B_TRIGGERS.map((k) => (
            <label key={k} className="choice"><input type="radio" name="planb" checked={day.planB === k} onChange={() => update((s) => ({ ...s, party: setPlanB(s.party, v.day.date, k) }))} /><span>{t(`planb.t.${k}` as StringKey)}</span></label>
          ))}
        </fieldset>
        {chosenB ? (
          <>
            <h3>{chosenB.title}</h3>
            <p>{chosenB.detail}</p>
            <Button variant="tertiary" onClick={() => update((s) => ({ ...s, party: setPlanB(s.party, v.day.date, null) }))}>{t('planb.clear')}</Button>
          </>
        ) : <p className="muted">{t('planb.none')}</p>}
      </Card>

      {v.day.tender && (
        <Card labelledBy="tenderday-h">
          <h2 id="tenderday-h" className="card__title">{t('tenderday.title')}</h2>
          <dl className="plain-dl">
            <div><dt>{t('tenderday.ticket')}</dt><dd>{v.tender ? v.tender.group.name : t('tenderday.noTicket')}</dd></div>
            <div><dt>{t('tenderday.wait')}</dt><dd>{v.tender ? (v.tender.waitMinutes > 0 ? duration(v.tender.waitMinutes) : t('tenderday.noWait')) : '-'}</dd></div>
            <div><dt>{t('tenderday.last')}</dt><dd>{both(plan.lastTenderAt!)}</dd></div>
            <div><dt>{t('tenderday.switch')}</dt><dd>{t('tenderday.switchBody')}</dd></div>
          </dl>
          <h3>{t('tenderday.accessible')}</h3>
          <ol className="plain-bullets">{ACCESSIBLE_TENDER_STEPS.map((k) => <li key={k}>{t(k)}</li>)}</ol>
        </Card>
      )}

      <Card labelledBy="share-h">
        <h2 id="share-h" className="card__title">{t('share.title')}</h2>
        <p className="muted">{t('share.intro')}</p>
        {day.plan ? (
          <>
            <p><strong>{day.plan.title}</strong> {t('share.detail', { travel: day.plan.travelMinutes, buffer: day.plan.buffer })}</p>
            <ul className="plain-bullets">
              {members.map((m) => <li key={m.id}>{m.firstName}: {day.plan!.agreed.includes(m.id) ? t('share.agreed') : t('share.waiting')}</li>)}
            </ul>
            {agreed && <p role="status">{t('share.everyone')}</p>}
            <div className="button-row">
              {!iAgreed && me && <Button onClick={() => update((s) => ({ ...s, party: agreePlan(s.party, v.day.date, me.id) }))}>{t('share.agree')}</Button>}
              <Button variant="tertiary" onClick={() => update((s) => ({ ...s, party: clearPlan(s.party, v.day.date) }))}>{t('share.clear')}</Button>
            </div>
          </>
        ) : (
          <Button disabled={!me || !!me.child} onClick={() => me && update((s) => ({ ...s, party: proposePlan(s.party, v.day.date, { outing, title: choice?.name ?? t('pilot.free'), travelMinutes: travel, buffer }, me.id) }))}>{t('share.propose')}</Button>
        )}
        {me?.child && <p className="muted">{t('share.adultOnly')}</p>}
        <p><Link to="/plan/split">{t('route.split')}</Link></p>
      </Card>
    </>
  )
}

const hourName = (h: number): string => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 || h === 24 ? 'am' : 'pm'}`
