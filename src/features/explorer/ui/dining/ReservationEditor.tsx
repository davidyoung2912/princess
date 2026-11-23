import { useState } from 'react'
import type { DiningView, Reservation } from '../../../../shared/api/types'
import { dinnerDays, mealCharge, MAX_PARTY, venueById } from '../../../../domain/dining'
import { formatMoney } from '../../../../domain/money'
import { formatTime } from '../../../../domain/cruise'
import { shortDate } from '../../domain/presentation'
import type { PersonaId } from '../../../../domain/people'
import { itinerary, portById } from '../../../../domain/sailings'
import { useAction } from '../../../../shared/hooks/useAction'
import { useAsync } from '../../../../shared/hooks/useAsync'
import { useSailing } from '../../../../shared/hooks/useDemo'
import { t } from '../../../../shared/i18n'
import { Link } from 'react-router'
import { api } from '../../../../app/runtime'
import { Button } from '../../../../shared/ui/Button'
import { BackLink } from '../../../onboard/ui/common'
import { TextArea } from '../../../../shared/ui/Field'
import { GuestPicker, PlanError } from '../../../plan/ui/common'

interface Props {
  view: DiningView
  /** The restaurants that can be reserved. */
  venues: readonly { id: string; title: string }[]
  /** The restaurant when the editor opens on its own page. */
  venueId?: string
  day: number
  /** Present to move this reservation; absent to make a new one. */
  reservation?: Reservation
  /** Where Back and Close lead. */
  backTo: string
  backLabel: string
  onClose: () => void
  onDone: () => void
}

/** Reserve a table, or move one to another night or time: a page with the table grid, using the same dining service as the reservations page. */
export function ReservationEditor({ view, venues, venueId: fixedVenue, day: startDay, reservation, backTo, backLabel, onClose, onDone }: Props) {
  const sailing = useSailing()
  const days = itinerary(sailing)
  const moving = reservation !== undefined
  const [venueId, setVenueId] = useState(reservation?.venueId ?? fixedVenue ?? venues[0]?.id ?? '')
  const [day, setDay] = useState(reservation?.day ?? startDay)
  const [time, setTime] = useState('')
  const [guests, setGuests] = useState<PersonaId[]>(view.party.filter((g) => g.age >= 18).slice(0, 1).map((g) => g.id))
  const [note, setNote] = useState(reservation?.note ?? '')
  const [done, setDone] = useState('')
  const [listed, setListed] = useState(false)
  const [auto, setAuto] = useState(false)
  const slots = useAsync(() => api.plan.dining.slots(venueId, day), [venueId, day, view.reservations.length])
  const save = useAction(async () => {
    if (moving) await api.plan.dining.move(reservation.id, { day, time })
    else await api.plan.dining.reserve({ venueId, day, time, guests, note })
    return true
  })
  const waitlist = useAction(async () => { await api.waits.joinWaitlist({ venueId, day, time, guests, auto }); setListed(true) })
  const free = slots.data?.find((x) => x.time === time)
  const full = !!free && free.tables === 0
  const venue = venueById(venueId)
  const cost = venue?.kind === 'specialty' && !moving && guests.length > 0 ? mealCharge(venue, guests.length, view.mealsLeft) : null
  const blocked = !view.window.open ? t('dine.blocked.closed') : !moving && guests.length === 0 ? t('dine.blocked.guests') : !time || !free || free.tables === 0 ? t('dine.blocked.time') : ''
  const go = async () => {
    if (await save.run()) { setDone(t('exp.res.saved')); onDone(); onClose() }
  }
  return (
    <div className="page">
      <form onSubmit={(e) => { e.preventDefault(); void go() }}>
        {!moving && !fixedVenue && (
          <div className="field">
            <label htmlFor="exp-res-venue">{t('dine.where')}</label>
            <select id="exp-res-venue" value={venueId} onChange={(e) => { setVenueId(e.target.value); setTime(''); setListed(false) }}>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="exp-res-day">{t('dine.night')}</label>
          <select id="exp-res-day" value={day} onChange={(e) => { setDay(Number(e.target.value)); setTime(''); setListed(false) }}>
            {dinnerDays(days.length).map((n) => <option key={n} value={n}>{t('exp.date.option', { day: n, date: shortDate(days[n - 1].date) })} · {days[n - 1].port === 'sea' ? t('exp.clock.sea') : portById(days[n - 1].port)?.name ?? days[n - 1].port}</option>)}
          </select>
        </div>
        {!moving && <GuestPicker legend={t('dine.party')} party={view.party} value={guests} onChange={setGuests} hint={t('dine.partyHint', { max: MAX_PARTY })} />}
        <fieldset className="slot-card">
          <legend>{t('dine.time')}</legend>
          {slots.data ? (
            <ul className="slot-grid">
              {slots.data.map((x) => (
                <li key={x.time}>
                  <label className={`choice${x.tables === 0 ? ' choice--full' : ''}`}>
                    <input type="radio" name="exp-time" checked={time === x.time} onChange={() => { setTime(x.time); setListed(false) }} />
                    <span>{formatTime(x.time)}<small>{x.tables === 0 ? t('dine.full') : x.tables <= 2 ? t('dine.few') : t('dine.free')}</small></span>
                  </label>
                </li>
              ))}
            </ul>
          ) : <p role="status" className="muted">{t('account.loading')}</p>}
        </fieldset>
        {!moving && <TextArea label={t('dine.note')} hint={t('dine.noteHint')} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />}
        {cost && <p aria-live="polite">{cost.pays === 0 ? t('dine.costCovered', { count: guests.length }) : cost.covered > 0 ? t('dine.costSome', { covered: cost.covered, amount: formatMoney(cost.charge) }) : t('dine.costAll', { amount: formatMoney(cost.charge) })}</p>}
        <PlanError error={save.error} />
        {!moving && full && view.window.open && guests.length > 0 && (
          <div>
            <p>{t('wait.fullHint')}</p>
            <PlanError error={waitlist.error} />
            <label className="choice choice--top">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              <span>{t('wait.auto')}<small>{t('wait.autoBody')}</small></span>
            </label>
            {listed ? <p role="status">{t('wait.listed')} <Link to="/plan/reservations">{t('wait.see')}</Link></p> : <Button variant="secondary" disabled={waitlist.busy} onClick={() => void waitlist.run()}>{t('wait.join')}</Button>}
          </div>
        )}
        {done && <p role="status" className="muted">{done}</p>}
        <div className="exp-actions">
          <Button type="submit" disabled={save.busy || !!blocked}>{save.busy ? t('account.saving') : moving ? t('exp.res.moveSave') : t('dine.reserve')}</Button>
        </div>
        {blocked && <p className="muted">{blocked}</p>}
      </form>
      <BackLink to={backTo} label={backLabel} />
    </div>
  )
}
