import { useState } from 'react'
import { Link } from 'react-router'
import { EMBARK } from '../../domain/boarding'
import {
  familyProblems, FAMILY_ROLES, firstHours, hourClock, MAX_WELCOME, QUICK_START, setMeetNote, setReady, setRole, sharedWelcome,
  stewardFor, swapEffect, WELCOME_FIELDS, type EmbarkNeeds, type FamilyRole, type WelcomeField,
} from '../../domain/embark'
import { isTime, toggleIn } from '../../domain/journey'

import { formatTime } from '../../domain/cruise'
import { useShipTime } from '../onboard/shipTime'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { useTrip } from '../../hooks/useTrip'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { FeedWaiting } from '../FeedWaiting'
import { embarkFeed } from '../../feeds/embark'
import { useFeed } from '../../hooks/useServedFeeds'
import { Field } from '../Field'
import { BackLink } from '../onboard/common'
import { duration } from '../onboard/shipTime'
import { partyPeople } from '../../account/context'

/** Embarkation plan (S5-01 to S5-06): the arrival window and what it costs in waiting, a step-by-step forecast, the first three hours aboard, the cabin quick-start, a family plan and a welcome. */
export function EmbarkPlanScreen() {
  const { state, update, me } = useTrip()
  const status = useMine(() => api.checkin.status())
  const shipEmbark = useMine(() => api.boarding.embark())
  const shipTime = useShipTime()
  const shipBoarded = shipEmbark.data?.boarded ?? null
  const { embark } = state
  const needs = embark.needs
  const setNeeds = (change: Partial<EmbarkNeeds>) => update((s) => ({ ...s, embark: { ...s.embark, needs: { ...s.embark.needs, ...change } } }))
  const queue = useFeed(embarkFeed, needs.priority, needs.mobility, needs.quiet, needs.earliest ?? '')
  const windows = queue?.windows ?? []
  const best = windows.find((w) => w.start === queue?.recommended) ?? null
  const chosen = windows.find((w) => w.start === embark.window) ?? null
  const shown = chosen ?? best
  const people = me ? partyPeople(me.id) : []
  const problems = familyProblems(people.map((p) => ({ id: p.id, child: p.child })), embark.family)
  const hours = firstHours(embark.boardedAt)
  const shared = sharedWelcome(embark.welcome)
  const [meet, setMeet] = useState(embark.family.meetNote)

  return (
    <div className="page">
      <p>{t('embarkPlan.intro')}</p>

      <Card labelledBy="e-needs">
        <h2 id="e-needs" className="card__title">{th('embarkPlan.needs')}</h2>
        <label className="choice"><input type="checkbox" checked={needs.priority} onChange={(e) => setNeeds({ priority: e.target.checked })} /><span>{t('embarkPlan.priority')}</span></label>
        <label className="choice"><input type="checkbox" checked={needs.mobility} onChange={(e) => setNeeds({ mobility: e.target.checked })} /><span>{t('embarkPlan.mobility')}</span></label>
        <label className="choice"><input type="checkbox" checked={needs.quiet} onChange={(e) => setNeeds({ quiet: e.target.checked })} /><span>{t('embarkPlan.quiet')}<small>{t('embarkPlan.quiet.why')}</small></span></label>
        <Field label={t('embarkPlan.earliest')} hint={t('embarkPlan.earliest.hint')} type="time" value={needs.earliest ?? ''} onChange={(e) => setNeeds({ earliest: isTime(e.target.value) ? e.target.value : null })} />
      </Card>

      <Card labelledBy="e-window">
        <h2 id="e-window" className="card__title">{th('embarkPlan.window')}</h2>
        {!queue ? <FeedWaiting /> : best ? <p>{t('embarkPlan.window.best', { time: formatTime(best.start), wait: duration(best.waitMinutes) })}</p> : <p>{t('embarkPlan.window.none')}</p>}
        <fieldset>
          <legend>{t('embarkPlan.window.choose')}</legend>
          {windows.map((w) => {
            const fx = shown ? swapEffect(shown, w) : null
            return (
              <label key={w.start} className="choice">
                <input type="radio" name="embark-window" checked={shown?.start === w.start} onChange={() => update((s) => ({ ...s, embark: { ...s.embark, window: w.start } }))} />
                <span>{formatTime(w.start)} to {formatTime(w.end)}<small>{t(`travel.crowd.${w.crowd}` as StringKey)} · {t('embarkPlan.wait', { wait: duration(w.waitMinutes) })}{fx && !fx.sameSlot ? ` · ${t(fx.aboardChange > 0 ? 'embarkPlan.later' : 'embarkPlan.sooner', { time: duration(Math.abs(fx.aboardChange)) })}` : ''}</small></span>
              </label>
            )
          })}
        </fieldset>
        <p className="muted">{t('embarkPlan.sim')}</p>
        <p><Link to="/plan/getting-there">{t('route.gettingThere')}</Link></p>
      </Card>

      {shown && (() => {
        const f = shown
        return (
          <section aria-labelledby="e-forecast">
            <h2 id="e-forecast">{th('embarkPlan.forecast')}</h2>
            <ol>
              {f.steps.map((s) => (
                <li key={s.id}>
                  <strong>{t(`embarkPlan.step.${s.id}` as StringKey)}</strong>: {t('embarkPlan.step.times', { walk: duration(s.walk), queue: duration(s.queue) })}
                  {s.accessibleLane && ` · ${t('embarkPlan.lane.accessible')}`}
                  {needs.quiet && s.quietLane && ` · ${t('embarkPlan.lane.quiet')}`}
                </li>
              ))}
            </ol>
            <p>{t('embarkPlan.total', { total: duration(f.total) })}</p>
            {needs.priority && <p>{t('embarkPlan.priority.note')}</p>}
            <p className="muted">{t('embarkPlan.assist')}</p>
          </section>
        )
      })()}

      <section aria-labelledby="e-hours">
        <h2 id="e-hours">{th('embarkPlan.hours')}</h2>
        <p role="status">{shipBoarded ? t('embarkPlan.boardedConfirmed', { time: shipTime(shipBoarded.at), source: t(`embarkPlan.source.${shipBoarded.source}` as StringKey) }) : t('embarkPlan.boardedNot')}</p>
        <Field label={t('embarkPlan.boarded')} type="time" value={embark.boardedAt} onChange={(e) => isTime(e.target.value) && update((s) => ({ ...s, embark: { ...s.embark, boardedAt: e.target.value } }))} />
        <p>{t(hours.cabinReady ? 'embarkPlan.cabinReady' : 'embarkPlan.cabinNotReady', { time: formatTime(EMBARK.staterooms) })}</p>
        <ol>{hours.items.map((i) => <li key={i.id}>{formatTime(hourClock(i.at))}: {t(`embarkPlan.hour.${i.id}` as StringKey)}</li>)}</ol>
      </section>

      <Card labelledBy="e-quick">
        <h2 id="e-quick" className="card__title">{th('quick.title')}</h2>
        <ol>{QUICK_START.map((k) => <li key={k}>{t(k, { steward: stewardFor(me?.booker ?? '') })}</li>)}</ol>
      </Card>

      <section aria-labelledby="e-family">
        <h2 id="e-family">{th('embarkPlan.family')}</h2>
        {status.data && <p>{t(`embarkPlan.checkin.${status.data.state}` as StringKey)}</p>}
        <ul>
          {people.map((p) => (
            <li key={p.id}>
              <label htmlFor={`role-${p.id}`}>{p.firstName}{p.child ? ` (${t('embarkPlan.child')})` : ''}</label>{' '}
              <select id={`role-${p.id}`} value={embark.family.roles[p.id] ?? 'together'} onChange={(e) => update((s) => ({ ...s, embark: { ...s.embark, family: setRole(s.embark.family, p.id, e.target.value as FamilyRole) } }))}>
                {FAMILY_ROLES.map((r) => <option key={r} value={r}>{t(`embarkPlan.role.${r}` as StringKey)}</option>)}
              </select>
              <label className="choice"><input type="checkbox" checked={embark.family.ready[p.id] === true} onChange={(e) => update((s) => ({ ...s, embark: { ...s.embark, family: setReady(s.embark.family, p.id, e.target.checked) } }))} /><span>{t('embarkPlan.ready', { name: p.firstName })}</span></label>
            </li>
          ))}
        </ul>
        {problems.map((p) => <Banner key={p} kind="warning" title={t(`embarkPlan.problem.${p}` as StringKey)}><p>{t(`embarkPlan.problem.${p}.fix` as StringKey)}</p></Banner>)}
        <Field label={t('embarkPlan.meet')} hint={t('embarkPlan.meet.hint')} value={meet} maxLength={80} onChange={(e) => setMeet(e.target.value)} onBlur={() => update((s) => ({ ...s, embark: { ...s.embark, family: setMeetNote(s.embark.family, meet) } }))} />
      </section>

      <Card labelledBy="e-welcome">
        <h2 id="e-welcome" className="card__title">{th('welcome.title')}</h2>
        <p>{t('welcome.intro')}</p>
        {WELCOME_FIELDS.map((f: WelcomeField) => (
          <div key={f}>
            <Field label={t(`welcome.field.${f}` as StringKey)} value={embark.welcome[f]} maxLength={MAX_WELCOME} onChange={(e) => update((s) => ({ ...s, embark: { ...s.embark, welcome: { ...s.embark.welcome, [f]: e.target.value } } }))} />
            <label className="choice"><input type="checkbox" checked={embark.welcome.share.includes(f)} onChange={() => update((s) => ({ ...s, embark: { ...s.embark, welcome: { ...s.embark.welcome, share: toggleIn(s.embark.welcome.share, f) } } }))} /><span>{t('welcome.share', { field: t(`welcome.field.${f}` as StringKey) })}</span></label>
          </div>
        ))}
        <p role="status">{shared.length === 0 ? t('welcome.none') : t('welcome.greeting', { name: me?.firstName ?? '', detail: shared.map((x) => x.text).join(', ') })}</p>
        <p className="muted">{t('welcome.device')}</p>
      </Card>
      <BackLink to="/home/embarkation" label={t('route.embarkation')} />
    </div>
  )
}
