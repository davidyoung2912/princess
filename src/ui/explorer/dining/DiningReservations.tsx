import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { DiningView, Reservation } from '../../../api/types'
import type { ExplorerDay } from '../../../api/explorerTypes'
import { formatDate, formatTime } from '../../../domain/cruise'
import { shortDate } from '../../../domain/explorer/presentation'
import { itinerary, PORTS } from '../../../domain/sailings'
import { dinnerDays } from '../../../domain/dining'
import { groupByDay, type ReservationScope } from '../../../domain/explorer/reservationsByDay'
import { formatMoney } from '../../../domain/money'
import { useSailing } from '../../../hooks/useDemo'
import { useSavedDishes } from '../../../hooks/useSavedDishes'
import { dishesAt } from '../../../domain/explorer/shortlist'
import { t } from '../../../i18n'
import { api } from '../../../runtime'
import { Button } from '../../Button'
import { Dialog } from '../../Dialog'
import { PlanError } from '../../plan/common'
import { useAction } from '../../../hooks/useAction'
import { names } from '../../plan/people'
import { diningBookingCard } from '../../../domain/explorer/bookingState'
import { useAheadInput, useExplorerStage } from '../../../hooks/useExplorerStage'
import { aheadOnly } from '../../../domain/explorer/finished'
import { lineWords } from '../lineWords'
import { ReservationList, type ReservationItem } from '../Parts'

const VENUE_BASE = '/dining-today'

interface Props {
  venues: ExplorerDay['venues']
  day: number
  /** Only reservations at this venue (a venue's own page); all of the day's when absent. */
  venueId?: string
  view: DiningView
  reload: () => void
  /** Where a reservation's venue page is; absent on the venue's own page. */
  basePath?: string
  /** This day (the default) or every day of the trip. */
  scope?: ReservationScope
}

/** The guest's dinner reservations for the chosen day, with Change, Cancel and a button to reserve, wired to the dining service. */
export function DiningReservations({ venues, day, venueId, view, reload, basePath, scope = 'day' }: Props) {
  const sailing = useSailing()
  const saved = useSavedDishes()
  const { stage } = useExplorerStage()
  const ahead = useAheadInput(day)
  const card = diningBookingCard(view, stage)
  const days = itinerary(sailing)
  const navigate = useNavigate()
  // Reserving and moving are their own page: `reserve=new` or `reserve=<reservation id>` on this screen's address (see DiningScreens).
  const openEditor = (reserve: string, on = day) => { void navigate(`${venueId ? `${VENUE_BASE}/${venueId}` : VENUE_BASE}?day=${on}&reserve=${encodeURIComponent(reserve)}`) }
  const [cancelling, setCancelling] = useState<Reservation | null>(null)
  const title = (id: string) => venues.find((v) => v.venue.id === id)?.venue.title ?? id
  const whole = scope === 'trip' && !venueId
  const all = view.reservations.filter((r) => (whole || r.day === day) && (!venueId || r.venueId === venueId)).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
  const { shown: mine, earlier } = whole ? { shown: all, earlier: 0 } : aheadOnly(all, ahead)
  const item = (r: Reservation): ReservationItem => ({
    id: r.id, title: title(r.venueId), name: `${title(r.venueId)}, ${formatTime(r.time)}`, to: basePath && !venueId ? `${basePath}/${r.venueId}?day=${r.day}` : undefined,
    when: `${shortDate(days[r.day - 1]?.date ?? days[0].date)}, ${formatTime(r.time)}`,
    facts: [
      names(r.guests), r.charge > 0 ? t('dine.charge', { amount: formatMoney(r.charge) }) : t('dine.included'), ...(r.note ? [r.note] : []),
      ...(r.reminderOn ? [t('dine.reminder', { date: formatDate(r.reminderOn) })] : []),
      ...(dishesAt(saved, r.venueId).length > 0 ? [t('dine.toTry', { dishes: dishesAt(saved, r.venueId).join(', ') })] : []),
      ...r.dietary.map((d) => t('dine.dietary', { name: d.name, needs: d.needs.map((n) => t(`profile.dietary.${n}` as never)).join(', ') })),
    ],
  })
  const items: ReservationItem[] = mine.map(item)
  const readOnly = !view.canBook || stage === 'after'
  const change = (id: string) => { const r = mine.find((x) => x.id === id); if (r) openEditor(r.id, r.day) }
  const dialog = cancelling && <CancelDialog r={cancelling} name={title(cancelling.venueId)} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); reload() }} />
  if (whole) {
    const booked = new Map(groupByDay(mine.map((r) => ({ ...r, date: days[r.day - 1]?.date ?? '', startAt: 0, endAt: 0 }))).map((g) => [g.day, g.items]))
    const nights = dinnerDays(days.length)
    const allDays = [...new Set([...nights, ...booked.keys()])].sort((a, b) => a - b)
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
                  <p className="exp-trip__none"><span className="muted">{t('exp.trip.none')}</span>{card.canReserve && <Button variant="secondary" onClick={() => openEditor('new', n)}>{t('exp.trip.book')}<span className="visually-hidden"> {heading}</span></Button>}</p>
                </>
              )}
            </div>
          )
        })}
        {!card.canReserve && (view.canBook || stage === 'after') && <p className="muted">{lineWords(card.detail ?? card.headline)}</p>}
        {dialog}
      </section>
    )
  }
  return (
    <>
      <ReservationList
        heading={venueId ? t('exp.res.hereTitle') : t('exp.res.title')} items={items} empty={venueId ? t('exp.res.noneHere') : t('exp.res.none')} readOnly={readOnly}
        onChange={change}
        onCancel={(id) => setCancelling(mine.find((x) => x.id === id) ?? null)}
        action={card.canReserve ? <Button onClick={() => openEditor('new')}>{t('exp.res.new')}</Button> : view.canBook || stage === 'after' ? <p className="muted">{lineWords(card.detail ?? card.headline)}</p> : null}
      />
      {earlier > 0 && <p className="muted">{t('exp.earlier', { count: earlier })}</p>}
      {dialog}
    </>
  )
}

function CancelDialog({ r, name, onClose, onDone }: { r: Reservation; name: string; onClose: () => void; onDone: () => void }) {
  const cancel = useAction(async () => { await api.plan.dining.cancel(r.id); onDone() })
  return (
    <Dialog title={t('exp.res.cancelTitle')} onClose={onClose}>
      <p>{t('exp.res.cancelBody', { name, time: formatTime(r.time) })}</p>
      <PlanError error={cancel.error} />
      <div className="exp-actions">
        <Button variant="danger" disabled={cancel.busy} onClick={() => void cancel.run()}>{t('exp.res.cancelYes')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('exp.res.cancelNo')}</Button>
      </div>
    </Dialog>
  )
}
