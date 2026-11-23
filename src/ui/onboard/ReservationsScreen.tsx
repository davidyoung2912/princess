import { GroupTable } from '../aboard/GroupTable'
import { DietaryRequests } from './DietaryRequests'
import { Link, useParams } from 'react-router'
import { useState } from 'react'
import { asDiningView } from '../../api/guards'
import type { HistoryEntry } from '../../domain/account'
import type { Reservation } from '../../api/types'
import { formatDate, formatTime } from '../../domain/cruise'
import { dinnerDays, DRESS_NOTES, venueById } from '../../domain/dining'
import { formatMoney } from '../../domain/money'
import { itinerary, PORTS, type PortId } from '../../domain/sailings'
import { addDays } from '../../domain/timezones'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { useSailing, usePersona } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, th } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { names } from '../plan/people'
import { PlanError, ReadOnly } from '../plan/common'
import { WaitsList } from './Waits'
import { TripReservations } from '../explorer/TripReservations'
import { BackLink, Saved } from './common'

/** Everything the guest has booked, dinners, treatments and tours, in one list by day with clash warnings; each row opens its own Explorer (DIN-02, POR-03). */
export function ReservationsScreen() {
  const me = usePersona()
  const dining = useSavedCopy('dining', me?.booker ?? 'none', () => api.plan.dining.view(), asDiningView, [me?.id])
  const spa = useMine(() => api.plan.spa.view())
  const tours = useMine(() => api.plan.excursions.list())
  return (
    <div className="page">
      <p>{t('res.trip.intro')}</p>
      <p><Link to="/home/updates">{t('res.trip.changes')}</Link></p>
      <Saved copy={dining}>{(v) => <TripReservations dining={v} spa={spa.data} tours={tours.data} reloadDining={dining.retry} reloadSpa={spa.retry} />}</Saved>
      <p><LinkButton to="/dining-today?view=trip" variant="secondary">{t('res.find')}</LinkButton></p>
      <WaitsList />
      <p className="muted">{t('res.queue')}</p>
    </div>
  )
}

/** One reservation: details, change it (atomically), tell the restaurant you are late, cancel, and see what changed (DIN-02, DIN-10). */
export function ReservationScreen() {
  const { id = '' } = useParams()
  const me = usePersona()
  const dining = useSavedCopy('dining', me?.booker ?? 'none', () => api.plan.dining.view(), asDiningView, [me?.id])
  return (
    <div className="page">
      <Saved copy={dining}>
        {(v) => {
          const r = v.reservations.find((x) => x.id === id)
          return r ? <Detail r={r} canEdit={v.canBook} reload={dining.retry} /> : <Banner kind="info" title={t('res.gone')}><p>{t('res.goneBody')}</p></Banner>
        }}
      </Saved>
      <BackLink to="/plan/reservations" label={t('route.reservations')} />
    </div>
  )
}

const placeName = (port: PortId): string => (port === 'sea' ? t('plan.atSea') : PORTS[port].name)

function Detail({ r, canEdit, reload }: { r: Reservation; canEdit: boolean; reload: () => void }) {
  const s = useSailing()
  const v = venueById(r.venueId)!
  const days = itinerary(s)
  const [day, setDay] = useState(r.day)
  const [time, setTime] = useState('')
  const [moved, setMoved] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [late, setLate] = useState(15)
  const slots = useAsync(() => api.plan.dining.slots(r.venueId, day), [r.venueId, day, r.day, r.time])
  const history = useMine(() => api.account.history(), [r.day, r.time, r.lateMinutes])
  const move = useAction(async () => { await api.plan.dining.move(r.id, { day, time }); setMoved(t('res.moved', { day, time: formatTime(time) })); setTime(''); reload() })
  const tell = useAction(async () => { await api.plan.dining.late(r.id, late); reload() })
  const cancel = useAction(async () => { await api.plan.dining.cancel(r.id); reload() })
  const same = day === r.day
  return (
    <>
      <ReadOnly canDo={canEdit} />
      <Card tour="res-h" labelledBy="res-h">
        <h2 id="res-h" className="card__title">{v.name}</h2>
        <ul className="tour__facts">
          <li>{t('dine.when', { day: r.day, date: formatDate(addDays(s.departure, r.day - 1)), time: formatTime(r.time) })}</li>
          <li>{names(r.guests)}</li>
          <li>{DRESS_NOTES[v.dress]}</li>
          <li>{r.charge > 0 ? t('dine.charge', { amount: formatMoney(r.charge) }) : v.kind === 'specialty' ? t('dine.coveredAll') : t('dine.included')}</li>
          {r.dietary.map((d) => <li key={d.name}>{t('dine.dietary', { name: d.name, needs: d.needs.map((n) => t(`profile.dietary.${n}` as never)).join(', ') })}</li>)}
          {r.lateMinutes > 0 && <li><strong>{t('res.lateHeld', { count: r.lateMinutes })}</strong></li>}
        </ul>
        <p><Link to={`/ship/venues/${r.venueId}`}>{t('res.menu')}</Link></p>
        <p className="muted">{t('res.rules')}</p>
      </Card>

      <DietaryRequests r={r} canEdit={canEdit} reload={reload} />

      <GroupTable r={r} canEdit={canEdit} />

      {moved && <Banner kind="success" title={moved}><p>{t('res.movedBody')}</p></Banner>}

      {canEdit && (
        <>
          <section aria-labelledby="move-h">
            <h2 id="move-h">{th('res.change')}</h2>
            <p className="muted">{t('res.changeHold')}</p>
            <form onSubmit={(e) => { e.preventDefault(); void move.run() }}>
              <div className="field">
                <label htmlFor="res-day">{t('dine.night')}</label>
                <select id="res-day" className="field__input" value={day} onChange={(e) => { setDay(Number(e.target.value)); setTime(''); setMoved(null) }}>
                  {dinnerDays(days.length).map((n) => <option key={n} value={n}>{t('plan.day', { n })} · {formatDate(days[n - 1].date)} · {placeName(days[n - 1].port)}</option>)}
                </select>
              </div>
              <fieldset className="slot-card">
                <legend>{t('dine.time')}</legend>
                {slots.data ? (
                  <ul className="slot-grid">
                    {slots.data.map((x) => {
                      const current = same && x.time === r.time
                      return (
                        <li key={x.time}>
                          <label className={`choice${x.tables === 0 && !current ? ' choice--full' : ''}`}>
                            <input type="radio" name="res-time" checked={time === x.time} disabled={current || x.tables === 0} onChange={() => { setTime(x.time); setMoved(null) }} />
                            <span>{formatTime(x.time)}<small>{current ? t('res.yours') : x.tables === 0 ? t('dine.full') : x.tables <= 2 ? t('dine.few') : t('dine.free')}</small></span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                ) : <p role="status" className="muted">{t('account.loading')}</p>}
              </fieldset>
              <PlanError error={move.error} />
              {move.error && <p className="muted">{t('res.stillYours', { when: t('dine.when', { day: r.day, date: formatDate(addDays(s.departure, r.day - 1)), time: formatTime(r.time) }) })}</p>}
              <Button type="submit" disabled={move.busy || !time}>{move.busy ? t('account.saving') : t('res.move')}</Button>
              {!time && <p className="muted">{t('res.pick')}</p>}
            </form>
          </section>

          <section aria-labelledby="late-h">
            <h2 id="late-h">{th('res.late')}</h2>
            <p>{t('res.lateBody')}</p>
            <div className="field">
              <label htmlFor="res-late">{t('res.lateMinutes')}</label>
              <select id="res-late" className="field__input" value={late} onChange={(e) => setLate(Number(e.target.value))}>
                {[5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{t('onb.minutes', { count: m })}</option>)}
              </select>
            </div>
            <PlanError error={tell.error} />
            <Button variant="secondary" disabled={tell.busy} onClick={() => void tell.run()}>{t('res.lateSend')}</Button>
          </section>

          <section aria-labelledby="cancel-h">
            <h2 id="cancel-h">{th('res.cancel')}</h2>
            <PlanError error={cancel.error} />
            {confirmCancel ? (
              <Banner kind="warning" title={t('res.cancelSure')} action={<div className="button-row"><Button variant="danger" disabled={cancel.busy} onClick={() => void cancel.run()}>{t('res.cancelYes')}</Button><Button variant="tertiary" onClick={() => setConfirmCancel(false)}>{t('res.cancelNo')}</Button></div>}>
                <p>{t('res.cancelBody')}</p>
              </Banner>
            ) : <Button variant="tertiary" onClick={() => setConfirmCancel(true)}>{t('dine.cancel')}</Button>}
          </section>
        </>
      )}

      <section aria-labelledby="trail-h">
        <h2 id="trail-h">{th('res.trail')}</h2>
        <Load state={history}>
          {(h) => {
            const rows = h.filter((x: HistoryEntry) => x.what === 'dining').slice(0, 8)
            return rows.length === 0 ? <p className="muted">{t('res.trailNone')}</p> : <ul className="plain-bullets">{rows.map((x) => <li key={x.id}>{x.detail} <span className="muted">({x.by})</span></li>)}</ul>
          }}
        </Load>
      </section>
    </>
  )
}
