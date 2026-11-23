import { useState } from 'react'
import type { SpaAppointment, SpaView } from '../../../../shared/api/spaTypes'
import { formatTime } from '../../../../domain/cruise'
import { dinnerDays } from '../../../../domain/dining'
import { shortDate } from '../../domain/presentation'
import { formatMoney } from '../../../../domain/money'
import type { PersonaId } from '../../../../domain/people'
import { itinerary, portById } from '../../../../domain/sailings'
import { useAction } from '../../../../shared/hooks/useAction'
import { useAsync } from '../../../../shared/hooks/useAsync'
import { useSailing } from '../../../../shared/hooks/useDemo'
import { t } from '../../../../shared/i18n'
import { api } from '../../../../app/runtime'
import { Button } from '../../../../shared/ui/Button'
import { BackLink } from '../../../onboard/ui/common'
import { TextArea } from '../../../../shared/ui/Field'
import { GuestPicker, PlanError } from '../../../plan/ui/common'

interface Props {
  view: SpaView
  /** The venues whose treatments can be chosen (the spa venues that take appointments). */
  venues: readonly { id: string; title: string }[]
  /** The venue when the editor opens on its own page. */
  venueId?: string
  /** The treatment to start with, when it was chosen on the page. */
  treatmentId?: string
  day: number
  /** Present to change this appointment; absent to book a new one. */
  appointment?: SpaAppointment
  /** Where Back and Close lead. */
  backTo: string
  backLabel: string
  onClose: () => void
  onDone: () => void
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

/** Book a treatment, or change an appointment's day, time, people and note: a page with the time grid, using the spa service. The price and the cancellation policy are shown before saving. */
export function SpaEditor({ view, venues, venueId: fixedVenue, treatmentId: startTreatment, day: startDay, appointment, backTo, backLabel, onClose, onDone }: Props) {
  const sailing = useSailing()
  const days = itinerary(sailing)
  const changing = appointment !== undefined
  const bookable = view.treatments.filter((x) => venues.some((v) => v.id === x.venueId) && (!fixedVenue || x.venueId === fixedVenue))
  const [treatmentId, setTreatmentId] = useState(appointment?.treatmentId ?? startTreatment ?? bookable[0]?.id ?? '')
  const [day, setDay] = useState(appointment?.day ?? startDay)
  const [time, setTime] = useState(appointment?.time ?? '')
  const [guests, setGuests] = useState<PersonaId[]>(appointment?.guests ?? view.party.filter((g) => g.age >= 18).slice(0, 1).map((g) => g.id))
  const [note, setNote] = useState(appointment?.note ?? '')
  const treatment = view.treatments.find((x) => x.id === treatmentId)
  const slots = useAsync(() => api.plan.spa.slots(treatmentId, day, appointment?.id), [treatmentId, day, appointment?.id, view.appointments.length])
  const save = useAction(async () => {
    if (appointment) {
      if (day !== appointment.day || time !== appointment.time) await api.plan.spa.move(appointment.id, { day, time })
      if (!same(guests, appointment.guests) || note !== appointment.note) await api.plan.spa.update(appointment.id, { guests, note })
    } else await api.plan.spa.reserve({ treatmentId, day, time, guests, note })
    return true
  })
  const free = slots.data?.find((x) => x.time === time)
  const unchanged = changing && day === appointment.day && time === appointment.time && same(guests, appointment.guests) && note === appointment.note
  const blocked = !view.canBook ? t('spa.blocked.closed') : guests.length === 0 ? t('spa.blocked.guests') : !time || !free || (free.left === 0 && !(changing && day === appointment.day && time === appointment.time)) ? t('spa.blocked.time') : unchanged ? t('spa.blocked.same') : ''
  const total = (treatment?.price ?? 0) * guests.length
  const go = async () => {
    if (await save.run()) { onDone(); onClose() }
  }
  return (
    <div className="page">
      <form onSubmit={(e) => { e.preventDefault(); void go() }}>
        {!changing && (
          <div className="field">
            <label htmlFor="spa-treatment">{t('spa.treatment')}</label>
            <select id="spa-treatment" value={treatmentId} onChange={(e) => { setTreatmentId(e.target.value); setTime('') }}>
              {bookable.map((x) => <option key={x.id} value={x.id}>{x.title} · {t('spa.minutes', { n: x.minutes })} · {formatMoney(x.price)}</option>)}
            </select>
          </div>
        )}
        {treatment && <p className="muted">{treatment.detail}{treatment.minAge ? ` ${t('exp.venue.minAge', { age: treatment.minAge })}` : ''}</p>}
        <div className="field">
          <label htmlFor="spa-day">{t('spa.day')}</label>
          <select id="spa-day" value={day} onChange={(e) => { setDay(Number(e.target.value)); setTime('') }}>
            {dinnerDays(days.length).map((n) => <option key={n} value={n}>{t('exp.date.option', { day: n, date: shortDate(days[n - 1].date) })} · {days[n - 1].port === 'sea' ? t('exp.clock.sea') : portById(days[n - 1].port)?.name ?? days[n - 1].port}</option>)}
          </select>
        </div>
        <GuestPicker legend={t('spa.who')} party={view.party} value={guests} onChange={setGuests} hint={t('spa.whoHint', { max: view.maxParty })} />
        <fieldset className="slot-card">
          <legend>{t('spa.time')}</legend>
          {slots.data ? (slots.data.length === 0 ? <p className="muted">{t('spa.noTimes')}</p> : (
            <ul className="slot-grid">
              {slots.data.map((x) => (
                <li key={x.time}>
                  <label className={`choice${x.left === 0 ? ' choice--full' : ''}`}>
                    <input type="radio" name="spa-time" checked={time === x.time} onChange={() => setTime(x.time)} />
                    <span>{formatTime(x.time)}<small>{x.left === 0 ? t('spa.full') : x.left <= 1 ? t('spa.few') : t('spa.free')}</small></span>
                  </label>
                </li>
              ))}
            </ul>
          )) : <p role="status" className="muted">{t('account.loading')}</p>}
        </fieldset>
        <TextArea label={t('spa.note')} hint={t('spa.noteHint')} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        {treatment && <p><strong>{t('spa.total', { amount: formatMoney(total) })}</strong></p>}
        <p className="muted">{t('spa.policy', { hours: view.cancelFreeHours, percent: view.lateFeePercent })}</p>
        <PlanError error={save.error} />
        <div className="exp-actions">
          <Button type="submit" disabled={save.busy || !!blocked}>{save.busy ? t('account.saving') : changing ? t('spa.saveChange') : t('spa.save')}</Button>
          <Button variant="tertiary" onClick={onClose}>{t('common.close')}</Button>
        </div>
        {blocked && <p className="muted">{blocked}</p>}
      </form>
      <BackLink to={backTo} label={backLabel} />
    </div>
  )
}
