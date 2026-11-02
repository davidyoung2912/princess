import { useState } from 'react'
import { Link } from 'react-router'
import {
  addBag, buildJourney, CARRY_ON_ITEMS, CHECKED_BAGS, DRIVE_STEPS, flightStatus, flyEarlyAdvice, flyEarlyDate, GROUND, hotelHandoff, isTime, markBagPhotographed, minutesToWindow,
  normalizeFlight, PICKUP_NOTES, removeBag, routeConditions, toggleIn, TRIP_MODES, validFlightNumber, watchDelay, latestComfortableLanding, type JourneyPlan, type TripMode,
} from '../../domain/journey'
import { EMBARK } from '../../domain/boarding'
import { formatMoney } from '../../domain/pricing'
import { newTripId, useTrip } from '../../hooks/useTrip'
import { useNow, useSailing } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { BackLink, } from '../onboard/common'
import { duration, useShipTime } from '../onboard/shipTime'

const STATUS_KIND = { onTrack: 'info', tight: 'warning', atRisk: 'warning' } as const

/** Door to door (S4A-01 to S4A-12): one timeline from the front door or hotel to the gangway, with the slack on each leg and what to do about it. */
export function JourneyScreen() {
  const { state, update } = useTrip()
  const sailing = useSailing()
  const now = useNow()
  const time = useShipTime()
  const { journey, embark } = state
  const plan: JourneyPlan = { ...journey.plan, windowStart: embark.window }
  const set = (change: Partial<JourneyPlan>) => update((s) => ({ ...s, journey: { ...s.journey, plan: { ...s.journey.plan, ...change } } }))
  const [flight, setFlight] = useState(plan.flightNumber)
  const [bag, setBag] = useState('')

  const status = plan.mode === 'fly' && validFlightNumber(plan.flightNumber) ? flightStatus(plan.flightNumber, plan.hotelNight ? flyEarlyDate(sailing.departure) : sailing.departure) : null
  const delay = watchDelay(status)
  const result = buildJourney(plan, sailing.departure, delay)
  const early = flyEarlyAdvice(plan, sailing.departure, delay)
  const cond = routeConditions(sailing.departure, plan.windowStart)
  const hotel = hotelHandoff(plan, sailing.departure, cond.leaveEarlierMinutes)
  const toGo = minutesToWindow(now, sailing.departure, plan.windowStart)

  return (
    <div className="page">
      <h1>{t('route.gettingThere')}</h1>
      <p>{t('journey.intro')}</p>

      <Card labelledBy="j-plan">
        <h2 id="j-plan" className="card__title">{t('journey.plan')}</h2>
        <fieldset>
          <legend>{t('journey.mode')}</legend>
          {TRIP_MODES.map((m: TripMode) => <label key={m} className="choice"><input type="radio" name="trip-mode" checked={plan.mode === m} onChange={() => set({ mode: m })} /><span>{t(`journey.mode.${m}` as StringKey)}</span></label>)}
        </fieldset>
        {plan.mode === 'fly' ? (
          <>
            <Field label={t('journey.flight')} hint={t('journey.flight.hint')} value={flight} maxLength={7} onChange={(e) => setFlight(e.target.value)} onBlur={() => set({ flightNumber: normalizeFlight(flight).slice(0, 6) })} />
            <Field label={t('journey.landing')} type="time" value={plan.landing} onChange={(e) => isTime(e.target.value) && set({ landing: e.target.value })} />
            <label className="choice"><input type="checkbox" checked={plan.carryOnOnly} onChange={(e) => set({ carryOnOnly: e.target.checked })} /><span>{t('journey.carryOnOnly')}</span></label>
          </>
        ) : (
          <Field label={t('journey.road')} type="number" min={10} max={900} value={String(plan.roadMinutes)} onChange={(e) => { const v = Number(e.target.value); if (v >= 10 && v <= 900) set({ roadMinutes: v }) }} />
        )}
        <label className="choice"><input type="checkbox" checked={plan.hotelNight} onChange={(e) => set({ hotelNight: e.target.checked })} /><span>{t('journey.hotelNight')}</span></label>
        {plan.windowStart ? <p className="muted">{t('journey.window', { time: plan.windowStart })}</p> : <p className="muted">{t('journey.window.none')} <Link to="/home/embarkation/plan">{t('route.embarkPlan')}</Link></p>}
      </Card>

      <Banner kind={STATUS_KIND[result.status]} title={t(`journey.status.${result.status}` as StringKey)}>
        <p role="status">{t('journey.slack', { time: time(result.atTerminal), slack: duration(Math.max(0, result.slack)) })}</p>
        {result.slack < 0 && <p>{t('journey.late')}</p>}
        {result.pastWindow && <p>{t('journey.pastWindow')}</p>}
      </Banner>

      <section aria-labelledby="j-line">
        <h2 id="j-line">{t('journey.timeline')}</h2>
        <ol>
          {result.legs.map((l) => (
            <li key={l.id}>{time(l.start)}: {t(l.label)}{l.minutes > 0 ? ` (${duration(l.minutes)})` : ''}</li>
          ))}
        </ol>
        {result.leaveBy !== null && <p>{t('journey.leaveBy', { time: time(result.leaveBy - cond.leaveEarlierMinutes * 60_000) })}</p>}
        {toGo > 0 && toGo < 24 * 60 && <p className="calm-hide">{t('journey.countdown', { time: duration(toGo) })}</p>}
      </section>

      {plan.mode === 'fly' && (
        <Card labelledBy="j-watch">
          <h2 id="j-watch" className="card__title">{t('journey.watch')}</h2>
          {status ? (
            <>
              <p role="status">{t(`journey.watch.${status.state}` as StringKey, { minutes: status.delayMinutes })}</p>
              <p className="muted">{t('journey.watch.sim')}</p>
              {status.state !== 'onTime' && result.status !== 'onTrack' && <p>{t('journey.watch.risk')} <Link to="/home/delayed">{t('route.delayed')}</Link></p>}
            </>
          ) : <p className="muted">{t('journey.watch.enter')}</p>}
        </Card>
      )}

      {early.recommend && (
        <Card labelledBy="j-early">
          <h2 id="j-early" className="card__title">{t('journey.early')}</h2>
          <p>{t(`journey.early.${early.reason}` as StringKey, { landing: latestComfortableLanding(plan) })}</p>
          <p>{t('journey.early.cost', { hotel: formatMoney(early.hotelCostCents), missed: formatMoney(early.missedCostCents) })}</p>
          <p className="muted">{t('journey.early.verify')}</p>
          <Button variant="secondary" onClick={() => set({ hotelNight: true })}>{t('journey.early.take', { date: flyEarlyDate(sailing.departure) })}</Button>
        </Card>
      )}

      <Card labelledBy="j-cond">
        <h2 id="j-cond" className="card__title">{t('journey.cond')}</h2>
        <p>{t('journey.cond.line', { traffic: t(`journey.traffic.${cond.traffic}` as StringKey), sky: t(`journey.sky.${cond.sky}` as StringKey) })}</p>
        {cond.leaveEarlierMinutes > 0 ? <p>{t('journey.cond.earlier', { minutes: cond.leaveEarlierMinutes })}</p> : <p>{t('journey.cond.fine')}</p>}
        <p className="muted">{t('journey.cond.sim')}</p>
      </Card>

      {plan.hotelNight && (
        <Card labelledBy="j-hotel">
          <h2 id="j-hotel" className="card__title">{t('journey.hotel')}</h2>
          <p>{t('journey.hotel.leave', { time: time(hotel.leaveHotel), checkout: time(hotel.checkoutBy) })}</p>
          <ul><li>{t('journey.hotel.late')}</li><li>{t('journey.hotel.hold')}</li></ul>
        </Card>
      )}

      {plan.mode === 'drive' ? (
        <Card labelledBy="j-drive">
          <h2 id="j-drive" className="card__title">{t('journey.drive')}</h2>
          <ol>{DRIVE_STEPS.map((k) => <li key={k}>{t(k, { address: EMBARK.address })}</li>)}</ol>
          <p className="muted">{t('journey.verify')}</p>
        </Card>
      ) : (
        <Card labelledBy="j-ground">
          <h2 id="j-ground" className="card__title">{t('journey.ground')}</h2>
          <ul>{GROUND.map((g) => <li key={g.id}>{t(`journey.ground.${g.id}` as StringKey)}: {g.cost}{g.stepFree ? ` · ${t('journey.ground.stepFree')}` : ''}</li>)}</ul>
          <h3>{t('journey.pickup')}</h3>
          <ul>{PICKUP_NOTES.map((k) => <li key={k}>{t(k)}</li>)}</ul>
          <p className="muted">{t('journey.verify')}</p>
        </Card>
      )}

      <section aria-labelledby="j-pack">
        <h2 id="j-pack">{t('journey.pack')}</h2>
        <p>{t('journey.pack.why')}</p>
        <fieldset>
          <legend>{t('journey.pack.carry')}</legend>
          {CARRY_ON_ITEMS.map((i) => <label key={i} className="choice"><input type="checkbox" checked={journey.carryOn.includes(i)} onChange={() => update((s) => ({ ...s, journey: { ...s.journey, carryOn: toggleIn(s.journey.carryOn, i) } }))} /><span>{t(`journey.pack.carry.${i}` as StringKey)}</span></label>)}
        </fieldset>
        <fieldset>
          <legend>{t('journey.pack.checked')}</legend>
          {CHECKED_BAGS.map((i) => <label key={i} className="choice"><input type="checkbox" checked={journey.checked.includes(i)} onChange={() => update((s) => ({ ...s, journey: { ...s.journey, checked: toggleIn(s.journey.checked, i) } }))} /><span>{t(`journey.pack.checked.${i}` as StringKey)}</span></label>)}
        </fieldset>
      </section>

      <section aria-labelledby="j-bags">
        <h2 id="j-bags">{t('journey.bags')}</h2>
        <p>{t('journey.bags.why')}</p>
        <ul>
          {journey.bags.map((b) => (
            <li key={b.id}>
              <label className="choice"><input type="checkbox" checked={b.photographedAt !== null} onChange={(e) => update((s) => ({ ...s, journey: markBagPhotographed(s.journey, b.id, e.target.checked ? now : null) }))} /><span>{t('journey.bags.done', { label: b.label })}</span></label>
              <Button variant="secondary" onClick={() => update((s) => ({ ...s, journey: removeBag(s.journey, b.id) }))}>{t('journey.bags.remove', { label: b.label })}</Button>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); update((s) => ({ ...s, journey: addBag(s.journey, bag, newTripId()) })); setBag('') }}>
          <Field label={t('journey.bags.add')} value={bag} maxLength={40} onChange={(e) => setBag(e.target.value)} />
          <Button type="submit" variant="secondary">{t('journey.bags.addButton')}</Button>
        </form>
      </section>
      <BackLink to="/plan" label={t('route.plan')} />
    </div>
  )
}
