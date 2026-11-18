import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { ExplorerDay } from '../../../api/explorerTypes'
import type { SpaAppointment, SpaView } from '../../../api/spaTypes'
import { formatTime } from '../../../domain/cruise'
import { treatmentKey } from '../../../domain/explorer/shortlist'
import { shortDate } from '../../../domain/explorer/presentation'
import { formatMoney } from '../../../domain/money'
import { dinnerDays } from '../../../domain/dining'
import { spaBookingCard } from '../../../domain/explorer/bookingState'
import { groupByDay, type ReservationScope } from '../../../domain/explorer/reservationsByDay'
import { itinerary, PORTS } from '../../../domain/sailings'
import { useAheadInput, useExplorerStage } from '../../../hooks/useExplorerStage'
import { aheadOnly } from '../../../domain/explorer/finished'
import { lineWords } from '../lineWords'
import { useAction } from '../../../hooks/useAction'
import { useSailing } from '../../../hooks/useDemo'
import { t, headingCase } from '../../../i18n'
import { api } from '../../../runtime'
import { Button } from '../../Button'
import { CalendarCheck } from '../../icons'
import { Dialog } from '../../Dialog'
import { PlanError } from '../../plan/common'
import { names } from '../../plan/people'
import { SaveButton } from '../SaveButton'
import { ReservationList, type ReservationItem } from '../Parts'

interface Props {
  venues: ExplorerDay['venues']
  day: number
  /** Only appointments at this venue (a venue's own page); all of the day's when absent. */
  venueId?: string
  view: SpaView
  reload: () => void
  /** Where a venue's page is; absent on the venue's own page. */
  basePath?: string
  /** This day (the default) or every day of the trip. */
  scope?: ReservationScope
}

const BASE = '/spa-explorer'

/** The guest's spa appointments for the chosen day, with Change, Cancel and a button to book, wired to the spa service. On a venue's page it also lists the treatments there. */
export function SpaReservations({ venues, day, venueId, view, reload, basePath, scope = 'day' }: Props) {
  const sailing = useSailing()
  const { stage } = useExplorerStage()
  const ahead = useAheadInput(day)
  const card = spaBookingCard(view, stage)
  const days = itinerary(sailing)
  const navigate = useNavigate()
  // Booking and changing are their own page: `book=new` (with `treatment=<id>`) or `book=<appointment id>` on this screen's address (see SpaScreens).
  const openEditor = (book: string, treatment?: string, on = day) => { void navigate(`${venueId ? `${BASE}/${venueId}` : BASE}?day=${on}&book=${encodeURIComponent(book)}${treatment ? `&treatment=${encodeURIComponent(treatment)}` : ''}`) }
  const [cancelling, setCancelling] = useState<SpaAppointment | null>(null)
  const title = (id: string) => venues.find((v) => v.venue.id === id)?.venue.title ?? id
  const whole = scope === 'trip' && !venueId
  const all = view.appointments.filter((a) => (whole || a.day === day) && (!venueId || a.venueId === venueId)).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
  const { shown: mine, earlier } = whole ? { shown: all, earlier: 0 } : aheadOnly(all, ahead)
  const item = (a: SpaAppointment): ReservationItem => ({
    id: a.id, title: a.title, name: `${a.title}, ${formatTime(a.time)}`, to: basePath && !venueId ? `${basePath}/${a.venueId}?day=${a.day}` : undefined,
    when: `${shortDate(days[a.day - 1]?.date ?? days[0].date)}, ${formatTime(a.time)}`, time: a.time,
    facts: [title(a.venueId), t('spa.minutes', { n: a.minutes }), names(a.guests), t('spa.total', { amount: formatMoney(a.price) }), ...(a.note ? [a.note] : [])],
  })
  const items: ReservationItem[] = mine.map(item)
  const readOnly = !view.canBook || stage === 'after'
  const change = (id: string) => { const a = mine.find((x) => x.id === id); if (a) openEditor(a.id, undefined, a.day) }
  const dialog = cancelling && <CancelDialog a={cancelling} hours={view.cancelFreeHours} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); reload() }} />
  const reason = !card.canReserve && (view.canBook || stage === 'after') ? <p className="muted">{lineWords(card.detail ?? card.headline)}</p> : null
  if (whole) {
    const booked = new Map(groupByDay(mine.map((a) => ({ ...a, date: days[a.day - 1]?.date ?? '', startAt: 0, endAt: 0 }))).map((g) => [g.day, g.items]))
    const allDays = [...new Set([...dinnerDays(days.length), ...booked.keys()])].sort((a, b) => a - b)
    return (
      <section aria-labelledby="exp-trip-h">
        <h2 id="exp-trip-h">{t('exp.trip.title')}</h2>
        {allDays.map((n) => {
          const d = days[n - 1]
          const here = (booked.get(n) ?? []).map(item)
          const heading = `${t('plan.day', { n })} · ${shortDate(d?.date ?? days[0].date)} · ${!d || d.port === 'sea' ? t('plan.atSea') : PORTS[d.port].name}`
          return (
            <div key={n} className="exp-trip__day">
              {here.length > 0 ? (
                <ReservationList id={`exp-trip-${n}`} level={3} heading={heading} items={here} empty="" readOnly={readOnly} onChange={change} onCancel={(id) => setCancelling(mine.find((x) => x.id === id) ?? null)} />
              ) : (
                <>
                  <h3 id={`exp-trip-${n}`}>{heading}</h3>
                  <p className="exp-trip__none"><span className="muted">{t('exp.trip.none')}</span>{card.canReserve && <Button variant="secondary" icon={CalendarCheck} onClick={() => openEditor('new', undefined, n)}>{t('exp.trip.bookSpa')}<span className="visually-hidden"> {heading}</span></Button>}</p>
                </>
              )}
            </div>
          )
        })}
        {reason}
        {dialog}
      </section>
    )
  }
  const here = venueId ? view.treatments.filter((x) => x.venueId === venueId) : []
  return (
    <>
      <ReservationList
        heading={venueId ? t('spa.mineHere') : t('spa.mine')} items={items} empty={venueId ? t('spa.noneHere') : t('spa.none')} readOnly={readOnly}
        onChange={change}
        onCancel={(id) => setCancelling(mine.find((x) => x.id === id) ?? null)}
        action={card.canReserve ? <Button icon={CalendarCheck} onClick={() => openEditor('new')}>{t('spa.new')}</Button> : reason}
      />
      {earlier > 0 && <p className="muted">{t('exp.earlier', { count: earlier })}</p>}
      {here.length > 0 && (
        <section aria-labelledby="spa-here-h">
          <h2 id="spa-here-h">{headingCase(t('spa.treatmentsHere'))}</h2>
          <ul className="card-grid">
            {here.map((x) => (
              <li key={x.id} className="card">
                <h3 className="card__title">{x.title}</h3>
                <p>{x.detail}</p>
                <p className="muted">{t('spa.minutes', { n: x.minutes })} · {formatMoney(x.price)}{x.minAge ? ` · ${t('exp.venue.minAge', { age: x.minAge })}` : ''}</p>
                <div className="button-row">
                  {card.canReserve && <Button variant="secondary" icon={CalendarCheck} onClick={() => openEditor('new', x.id)}>{t('spa.bookThis')}<span className="visually-hidden"> {x.title}</span></Button>}
                  <SaveButton itemKey={treatmentKey(venues[0]?.venue.shipId ?? '', x.id)} title={x.title} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {dialog}
    </>
  )
}

/** Cancelling says first whether it is free or what the ship keeps. */
function CancelDialog({ a, hours, onClose, onDone }: { a: SpaAppointment; hours: number; onClose: () => void; onDone: () => void }) {
  const cancel = useAction(async () => { await api.plan.spa.cancel(a.id); onDone() })
  const body = a.cancel.free
    ? t('spa.cancelFree', { name: a.title, time: formatTime(a.time) })
    : t('spa.cancelFee', { name: a.title, time: formatTime(a.time), hours, amount: formatMoney(a.cancel.fee) })
  return (
    <Dialog title={t('spa.cancelTitle')} onClose={onClose}>
      <p>{body}</p>
      <PlanError error={cancel.error} />
      <div className="exp-actions">
        <Button variant="danger" disabled={cancel.busy} onClick={() => void cancel.run()}>{t('spa.cancelYes')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('spa.cancelNo')}</Button>
      </div>
    </Dialog>
  )
}
