import { useState } from 'react'
import { Link } from 'react-router'
import type { DiningView, Reservation } from '../../api/types'
import { DINNER_DAYS, DRESS_NOTES, mealCharge, reservable, SEATINGS, venueById, MAX_PARTY, type Venue } from '../../domain/dining'
import { formatDate, formatTime } from '../../domain/cruise'
import { itinerary, PORTS } from '../../domain/sailings'
import type { PersonaId } from '../../domain/personas'
import { formatMoney } from '../../domain/pricing'
import { addDays } from '../../domain/timezones'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { useSailing } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { TextArea } from '../Field'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { Back, GuestPicker, PlanError, ReadOnly } from './common'
import { names } from './people'

/** Restaurant reservations before sailing, with the loyalty window explained (PRE-03, DIN-12). */
export function DiningScreen() {
  const view = useMine(() => api.plan.dining.view())
  return (
    <div className="page">
      <h1>{t('route.dining')}</h1>
      <p>{t('dine.intro')}</p>
      <Load state={view}>{(v) => <Body view={v} reload={view.retry} />}</Load>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}

function Body({ view, reload }: { view: DiningView; reload: () => void }) {
  const cancel = useAction(async (id: string) => { await api.plan.dining.cancel(id); reload() })
  const venues = reservable().filter((v) => v.kind !== 'main' || view.plan === 'anytime')
  const open = view.window.open
  return (
    <>
      <ReadOnly canDo={view.canBook} />
      {open ? <Banner kind="success" title={t('dine.open')} /> : (
        <Banner kind="info" title={t('dine.closed')} action={<Link to="/me/payments">{t('route.payments')}</Link>}>
          <p>{t('dine.closedBody', { date: formatDate(view.window.opensOn ?? '') })}</p>
        </Banner>
      )}
      <Card labelledBy="main-h">
        <h2 id="main-h" className="card__title">{t('dine.main')}</h2>
        {view.seating ? <p>{t('dine.fixed', { time: formatTime(SEATINGS[view.plan as 'early' | 'late']) })}</p> : <p>{t('dine.anytime')}</p>}
      </Card>

      <section aria-labelledby="res-h">
        <h2 id="res-h">{t('dine.mine')}</h2>
        <PlanError error={cancel.error} />
        {view.reservations.length === 0 ? <p className="muted">{t('dine.none')}</p> : (
          <ul className="card-grid">{view.reservations.map((r) => <ReservationCard key={r.id} r={r} canCancel={view.canBook} busy={cancel.busy} onCancel={() => void cancel.run(r.id)} />)}</ul>
        )}
      </section>

      {view.canBook && <Reserve view={view} venues={venues} open={open} onDone={reload} />}
    </>
  )
}

function ReservationCard({ r, canCancel, busy, onCancel }: { r: Reservation; canCancel: boolean; busy: boolean; onCancel: () => void }) {
  const v = venueById(r.venueId)!
  const s = useSailing()
  return (
    <li className="card">
      <h3 className="card__title">{v.name}</h3>
      <p><StatusBadge kind="booked" label={t('dine.confirmed')} /></p>
      <ul className="tour__facts">
        <li>{t('dine.when', { day: r.day, date: formatDate(addDays(s.departure, r.day - 1)), time: formatTime(r.time) })}</li>
        <li>{names(r.guests)}</li>
        <li>{r.charge > 0 ? t('dine.charge', { amount: formatMoney(r.charge) }) : v.kind === 'specialty' ? t('dine.coveredAll') : t('dine.included')}</li>
        {r.covered.length > 0 && r.charge > 0 && <li>{t('dine.coveredSome', { names: names(r.covered) })}</li>}
        <li>{t('dine.reminder', { date: formatDate(r.reminderOn) })}</li>
        {r.note && <li>{r.note}</li>}
        {r.dietary.map((d) => <li key={d.name}>{t('dine.dietary', { name: d.name, needs: d.needs.map((n) => t(`profile.dietary.${n}` as never)).join(', ') })}</li>)}
      </ul>
      {canCancel && <Button variant="tertiary" disabled={busy} onClick={onCancel}>{t('dine.cancel')}<span className="visually-hidden"> {v.name}, {t('plan.day', { n: r.day })}</span></Button>}
    </li>
  )
}

function Reserve({ view, venues, open, onDone }: { view: DiningView; venues: Venue[]; open: boolean; onDone: () => void }) {
  const s = useSailing()
  const [venueId, setVenueId] = useState(venues[0].id)
  const [day, setDay] = useState(3)
  const [time, setTime] = useState('')
  const [guests, setGuests] = useState<PersonaId[]>(view.party.filter((g) => g.age >= 18).slice(0, 1).map((g) => g.id))
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [listed, setListed] = useState(false)
  const [auto, setAuto] = useState(false)
  const venue = venueById(venueId)!
  const slots = useAsync(() => api.plan.dining.slots(venueId, day), [venueId, day, view.reservations.length])
  const book = useAction(async () => { const v = await api.plan.dining.reserve({ venueId, day, time, guests, note }); onDone(); return v })
  const waitlist = useAction(async () => { await api.waits.joinWaitlist({ venueId, day, time, guests, auto }); setListed(true) })
  const days = itinerary(s)
  const cost = mealCharge(venue, guests.length, view.mealsLeft)
  const free = slots.data?.find((x) => x.time === time)
  const full = !!free && free.tables === 0
  const blocked = !open ? t('dine.blocked.closed') : guests.length === 0 ? t('dine.blocked.guests') : !time || !free || full ? t('dine.blocked.time') : ''

  const submit = async () => {
    if (await book.run()) { setDone(venue.name); setTime(''); setNote('') }
  }

  return (
    <section aria-labelledby="new-h">
      <h2 id="new-h">{t('dine.new')}</h2>
      <form onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <fieldset>
          <legend>{t('dine.where')}</legend>
          {venues.map((v) => (
            <label key={v.id} className="choice choice--top">
              <input type="radio" name="venue" checked={venueId === v.id} onChange={() => { setVenueId(v.id); setTime(''); setDone(null) }} />
              <span>{v.name}<small>{v.cuisine} · {v.deck} · {v.cover === 0 ? t('dine.included') : t('dine.cover', { amount: formatMoney(v.cover) })}</small><small>{v.menu}</small><small>{DRESS_NOTES[v.dress]}</small></span>
            </label>
          ))}
        </fieldset>

        <div className="field">
          <label htmlFor="dine-day">{t('dine.night')}</label>
          <select id="dine-day" value={day} onChange={(e) => { setDay(Number(e.target.value)); setTime(''); setDone(null) }}>
            {DINNER_DAYS.map((n) => {
              const d = days[n - 1]
              return <option key={n} value={n}>{t('plan.day', { n })} · {formatDate(d.date)} · {d.port === 'sea' ? t('plan.atSea') : PORTS[d.port].name}</option>
            })}
          </select>
        </div>

        <GuestPicker legend={t('dine.party')} party={view.party} value={guests} onChange={setGuests} hint={t('dine.partyHint', { max: MAX_PARTY })} />

        <fieldset>
          <legend>{t('dine.time')}</legend>
          {slots.data ? (
            <ul className="slot-grid">
              {slots.data.map((x) => (
                <li key={x.time}>
                  <label className={`choice${x.tables === 0 ? ' choice--full' : ''}`}>
                    <input type="radio" name="time" checked={time === x.time} onChange={() => { setTime(x.time); setDone(null); setListed(false) }} />
                    <span>{formatTime(x.time)}<small>{x.tables === 0 ? t('dine.full') : x.tables <= 2 ? t('dine.few') : t('dine.free')}</small></span>
                  </label>
                </li>
              ))}
            </ul>
          ) : <p role="status" className="muted">{t('account.loading')}</p>}
        </fieldset>

        {venue.kind === 'specialty' && guests.length > 0 && (
          <p aria-live="polite">{cost.pays === 0 ? t('dine.costCovered', { count: guests.length }) : cost.covered > 0 ? t('dine.costSome', { covered: cost.covered, amount: formatMoney(cost.charge) }) : t('dine.costAll', { amount: formatMoney(cost.charge) })}</p>
        )}
        <TextArea label={t('dine.note')} hint={t('dine.noteHint')} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        <PlanError error={book.error} />
        {full && open && guests.length > 0 && (
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
        {done && <p role="status" className="muted">{t('dine.booked', { name: done })}</p>}
        <Button type="submit" disabled={book.busy || !!blocked}>{book.busy ? t('account.saving') : t('dine.reserve')}</Button>
        {blocked && <p className="muted">{blocked}</p>}
      </form>
    </section>
  )
}
