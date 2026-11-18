import { Link, useNavigate } from 'react-router'
import { useMemo, useState } from 'react'
import type { SpaAppointment, SpaView } from '../../api/spaTypes'
import type { DiningView, ExcursionsView, Reservation } from '../../api/types'
import { formatDate, formatTime } from '../../domain/cruise'
import { dishesAt } from '../../domain/explorer/shortlist'
import { useSavedDishes } from '../../hooks/useSavedDishes'
import { venueById } from '../../domain/dining'
import { groupByDay, tripClashes, tripItems, type TripItem } from '../../domain/explorer/reservationsByDay'
import { shortDate } from '../../domain/explorer/presentation'
import { itinerary, PORTS, shipZoneOnDate } from '../../domain/sailings'
import { zonedToEpoch } from '../../domain/timezones'
import { useSailing } from '../../hooks/useDemo'
import { useExplorerStage } from '../../hooks/useExplorerStage'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { CalendarClock, X } from '../icons'
import { DiningCancelDialog, SpaCancelDialog } from './CancelDialogs'
import { SendToChat } from '../onboard/SendToChat'
import { StatusBadge } from '../StatusBadge'

const KIND = { dining: 'exp.trip.kind.dining', spa: 'exp.trip.kind.spa', tour: 'exp.trip.kind.tour', event: 'exp.trip.kind.dining' } as const

/**
 * Everything the guest has booked, dinners, treatments and tours, in one list grouped by day, with a warning where two of them overlap.
 * The one place dinners and treatments are listed: each can be changed (in its Explorer's editor, which returns here) or cancelled right here. A tour opens in its own Explorer.
 */
export function TripReservations({ dining, spa, tours, reloadDining, reloadSpa }: { dining: DiningView | null; spa: SpaView | null; tours: ExcursionsView | null; reloadDining: () => void; reloadSpa: () => void }) {
  const sailing = useSailing()
  const { stage } = useExplorerStage()
  const navigate = useNavigate()
  const [cancelling, setCancelling] = useState<{ dining: Reservation } | { spa: SpaAppointment } | null>(null)
  const saved = useSavedDishes()
  const open = stage !== 'after'
  const canDining = !!dining?.canBook && open
  const canSpa = !!spa?.canBook && open
  const change = (i: TripItem) => {
    const to = i.kind === 'dining' ? `/dining-today?day=${i.day}&reserve=${encodeURIComponent(i.id)}` : `/spa-explorer?day=${i.day}&book=${encodeURIComponent(i.id)}`
    void navigate(to, { state: { from: '/plan/reservations' } })
  }
  /** What else is worth saying about a dinner: the reminder, what is passed on to the restaurant, and the dishes the guest saved there. */
  const factsOf = (i: TripItem): string[] => {
    if (i.kind !== 'dining') return []
    const r = dining?.reservations.find((x) => x.id === i.id)
    const dishes = dishesAt(saved, i.venueId)
    return [
      ...(r?.reminderOn ? [t('dine.reminder', { date: formatDate(r.reminderOn) })] : []),
      ...(r?.dietary ?? []).map((d) => t('dine.dietary', { name: d.name, needs: d.needs.map((n) => t(`profile.dietary.${n}` as never)).join(', ') })),
      ...(dishes.length > 0 ? [t('dine.toTry', { dishes: dishes.join(', ') })] : []),
    ]
  }
  const manage = (i: TripItem) => {
    if (i.kind === 'dining' && canDining) return { change: () => change(i), cancel: () => { const r = dining?.reservations.find((x) => x.id === i.id); if (r) setCancelling({ dining: r }) } }
    if (i.kind === 'spa' && canSpa) return { change: () => change(i), cancel: () => { const a = spa?.appointments.find((x) => x.id === i.id); if (a) setCancelling({ spa: a }) } }
    return null
  }
  const days = itinerary(sailing)
  const items = useMemo(() => tripItems({
    dining, spa, tours, dates: days.map((d) => d.date), diningTitle: (id) => venueById(id)?.name ?? id,
    atMs: (date, time) => zonedToEpoch(date, time, shipZoneOnDate(sailing, date)),
  }), [dining, spa, tours, days, sailing])
  const clashes = useMemo(() => tripClashes(items), [items])
  if (items.length === 0) return <p className="muted">{t('res.trip.none')}</p>
  return (
    <div>
      {groupByDay(items).map((g) => {
        const d = days[g.day - 1]
        const place = !d || d.port === 'sea' ? t('plan.atSea') : PORTS[d.port].name
        return (
          <section key={g.day} className="exp-trip__day" aria-labelledby={`trip-day-${g.day}`}>
            <h2 id={`trip-day-${g.day}`}>{t('plan.day', { n: g.day })} · {shortDate(g.date)} · {place}</h2>
            <ul className="card-grid">{g.items.map((i) => <Row key={i.id} i={i} clash={clashes.get(i.id) ?? []} manage={manage(i)} facts={factsOf(i)} />)}</ul>
          </section>
        )
      })}
      {cancelling && 'dining' in cancelling && <DiningCancelDialog r={cancelling.dining} name={items.find((x) => x.id === cancelling.dining.id)?.title ?? ''} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); reloadDining() }} />}
      {cancelling && 'spa' in cancelling && <SpaCancelDialog a={cancelling.spa} hours={spa?.cancelFreeHours ?? 0} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); reloadSpa() }} />}
    </div>
  )
}

function Row({ i, clash, manage, facts }: { i: TripItem; clash: TripItem[]; facts: string[]; manage: { change: () => void; cancel: () => void } | null }) {
  return (
    <li className="card">
      <h3 className="card__title"><Link to={i.to}>{i.title}</Link></h3>
      <p><StatusBadge kind="booked" label={t(KIND[i.kind])} /> <strong>{formatTime(i.start)}</strong></p>
      {clash.length > 0 && <Banner kind="warning" title={t('res.trip.clash', { other: clash.map((c) => `${c.title} at ${formatTime(c.start)}`).join(', ') })} />}
      <p>
        <Link to={i.to}>{t('res.trip.open')}<span className="visually-hidden"> {i.title}, {t('plan.day', { n: i.day })}</span></Link>
        {i.kind === 'dining' && <> · <Link to={`/plan/reservations/${i.id}`}>{t('res.trip.details')}<span className="visually-hidden"> {i.title}, {t('plan.day', { n: i.day })}</span></Link></>}
      </p>
      {facts.length > 0 && <ul className="tour__facts">{facts.map((f) => <li key={f}>{f}</li>)}</ul>}
      {manage && (
        <div className="exp-actions">
          <Button variant="secondary" icon={CalendarClock} onClick={manage.change}>{t('exp.res.change')}<span className="visually-hidden"> {i.title}, {t('plan.day', { n: i.day })}</span></Button>
          <Button variant="secondary" icon={X} onClick={manage.cancel}>{t('exp.res.cancel')}<span className="visually-hidden"> {i.title}, {t('plan.day', { n: i.day })}</span></Button>
        </div>
      )}
      {i.kind !== 'spa' && <SendToChat shareRef={`${i.kind === 'dining' ? 'dining' : 'excursion'}:${i.id}`} title={i.title} />}
    </li>
  )
}
