import { useState } from 'react'
import type { PortDayView } from '../../api/types'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'

import { ALERT_CHOICES, addRendezvous, anyoneOut, backCheck, dayOf, meetView, MEET_STATES, presenceOf, removeRendezvous, setAlertBefore, setMeetState, setPresence, type MeetState, type Presence } from '../../domain/portParty'
import { PORTS } from '../../domain/sailings'
import { zonedToEpoch } from '../../domain/timezones'
import { useWakeLock } from '../../hooks/useWakeLock'
import { useNow } from '../../hooks/useDemo'
import { newPortId, usePort } from '../../hooks/usePort'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { duration, useShipTime } from './shipTime'
import { partyPeople } from '../../account/context'

/** "I'm back aboard" (S6A-05) and meeting up (S6-12): who is out and who is back, a nudge when all-aboard nears, and a place to meet with a plan for no signal. */
export function PortParty({ v }: { v: PortDayView }) {
  useWakeLock()
  const now = useNow()
  const shipTime = useShipTime()
  const { state, update, me } = usePort()
  const members = me ? partyPeople(me.id) : []
  const date = v.day.date
  const day = dayOf(state.party, date)
  const check = backCheck(members.map((m) => ({ id: m.id, child: m.child })), day, v.day.allAboardAt, state.party.alertBefore, now)
  const mine = me ? presenceOf(day, me.id) : null
  const name = (id: string) => members.find((m) => m.id === id)?.firstName ?? id
  const say = (status: Presence) => me && update((s) => ({ ...s, party: setPresence(s.party, date, me.id, status, now) }))
  const kids = new Set(members.filter((m) => m.child).map((m) => m.id))

  const [place, setPlace] = useState('')
  const [time, setTime] = useState('')
  const [fallback, setFallback] = useState('')
  const [problem, setProblem] = useState<StringKey | null>(null)

  const addMeet = () => {
    if (!me) return
    if (!place.trim()) return setProblem('meet.problem.place')
    if (!/^\d{2}:\d{2}$/.test(time)) return setProblem('meet.problem.time')
    setProblem(null)
    update((s) => ({ ...s, party: addRendezvous(s.party, { place, at: zonedToEpoch(date, time, v.day.portZone), fallback, members: members.map((m) => m.id) }, me.id, newPortId()) }))
    setPlace('')
    setTime('')
    setFallback('')
  }

  return (
    <>
      <Card labelledBy="back-h">
        <h2 id="back-h" className="card__title">{t('back.title')}</h2>
        <p className="muted">{t('back.intro')}</p>
        {check.due && (
          <Banner kind={check.gangway ? 'danger' : 'warning'} title={t('back.nudge', { time: duration(check.minutesLeft) })}>
            <p>{t('back.nudgeBody', { names: [...check.missing, ...check.missingChildren].map(name).join(', ') })}</p>
            {check.missingChildren.length > 0 && <p>{t('back.child')}</p>}
            {check.gangway && <p>{t('back.gangway', { number: GUEST_SERVICES_NUMBER })}</p>}
          </Banner>
        )}
        <ul className="plain-bullets">
          {members.map((m) => {
            const p = presenceOf(day, m.id)
            return <li key={m.id}>{m.firstName}: {p ? t(`back.s.${p}` as StringKey) : t('back.s.unknown')}</li>
          })}
        </ul>
        {me && (
          <div className="button-row">
            <Button variant={mine === 'back' ? 'primary' : 'secondary'} onClick={() => say('back')} aria-pressed={mine === 'back'}>{t('back.back')}</Button>
            <Button variant={mine === 'leaving' ? 'primary' : 'secondary'} onClick={() => say('leaving')} aria-pressed={mine === 'leaving'}>{t('back.leaving')}</Button>
            <Button variant={mine === 'ashore' ? 'primary' : 'secondary'} onClick={() => say('ashore')} aria-pressed={mine === 'ashore'}>{t('back.ashore')}</Button>
          </div>
        )}
        {!anyoneOut(day) && <p className="muted">{t('back.noneOut')}</p>}
        <label className="field">
          <span>{t('back.alert')}</span>
          <select className="field__input" value={state.party.alertBefore} onChange={(e) => update((s) => ({ ...s, party: setAlertBefore(s.party, Number(e.target.value)) }))}>
            {ALERT_CHOICES.map((m) => <option key={m} value={m}>{t('back.alert.minutes', { minutes: m })}</option>)}
          </select>
        </label>
        <p className="muted">{t('back.private', { port: PORTS[v.day.port].name })}</p>
      </Card>

      <Card labelledBy="meet-h">
        <h2 id="meet-h" className="card__title">{t('meet.title')}</h2>
        <p className="muted">{t('meet.intro')}</p>
        {state.party.rendezvous.length === 0 && <p>{t('meet.none')}</p>}
        {state.party.rendezvous.map((r) => {
          const view = meetView(r, kids, now)
          const adult = !!me && !me.child
          return (
            <div key={r.id} className="card">
              <h3 className="card__title">{t('meet.at', { place: r.place, time: shipTime(r.at) })}</h3>
              <ul className="plain-bullets">{Object.keys(r.members).map((id) => <li key={id}>{name(id)}: {t(`meet.s.${r.members[id]}` as StringKey)}</li>)}</ul>
              <p className="muted">{t('meet.fallback', { place: r.fallback, minutes: r.fallbackAfter })}</p>
              {view.useFallback && <Banner kind="warning" title={t('meet.useFallback', { place: r.fallback })}><p>{t('meet.useFallbackBody')}</p></Banner>}
              {adult && view.childLate.length > 0 && <p role="status">{t('meet.childLate', { names: view.childLate.map(name).join(', ') })}</p>}
              {me && me.id in r.members && (
                <div className="button-row">
                  {MEET_STATES.filter((s): s is Exclude<MeetState, 'waiting'> => s !== 'waiting').map((s) => (
                    <Button key={s} variant={r.members[me.id] === s ? 'primary' : 'secondary'} aria-pressed={r.members[me.id] === s} onClick={() => update((st) => ({ ...st, party: setMeetState(st.party, r.id, me.id, s) }))}>{t(`meet.set.${s}` as StringKey)}</Button>
                  ))}
                  {me.id === r.by && <Button variant="tertiary" onClick={() => update((st) => ({ ...st, party: removeRendezvous(st.party, r.id, me.id) }))}>{t('meet.remove')}</Button>}
                </div>
              )}
            </div>
          )
        })}
        {me && !me.child && (
          <form onSubmit={(e) => { e.preventDefault(); addMeet() }}>
            <h3>{t('meet.new')}</h3>
            <Field label={t('meet.place')} value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} />
            <Field label={t('meet.time', { zone: PORTS[v.day.port].name })} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <Field label={t('meet.fallbackLabel')} hint={t('meet.fallbackHint')} value={fallback} maxLength={80} onChange={(e) => setFallback(e.target.value)} />
            {problem && <p className="field__error" role="alert">{t(problem)}</p>}
            <Button type="submit">{t('meet.add')}</Button>
          </form>
        )}
      </Card>
    </>
  )
}
