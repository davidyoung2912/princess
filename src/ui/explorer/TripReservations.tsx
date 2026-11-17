import { Link } from 'react-router'
import { useMemo } from 'react'
import type { SpaView } from '../../api/spaTypes'
import type { DiningView, ExcursionsView } from '../../api/types'
import { formatTime } from '../../domain/cruise'
import { venueById } from '../../domain/dining'
import { groupByDay, tripClashes, tripItems, type TripItem } from '../../domain/explorer/reservationsByDay'
import { shortDate } from '../../domain/explorer/presentation'
import { itinerary, PORTS, shipZoneOnDate } from '../../domain/sailings'
import { zonedToEpoch } from '../../domain/timezones'
import { useSailing } from '../../hooks/useDemo'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { SendToChat } from '../onboard/SendToChat'
import { StatusBadge } from '../StatusBadge'

const KIND = { dining: 'exp.trip.kind.dining', spa: 'exp.trip.kind.spa', tour: 'exp.trip.kind.tour', event: 'exp.trip.kind.dining' } as const

/**
 * Everything the guest has booked, dinners, treatments and tours, in one list grouped by day, with a warning where two of them overlap.
 * It only shows and links: each row opens the Explorer that owns it, where it is changed or cancelled.
 */
export function TripReservations({ dining, spa, tours }: { dining: DiningView | null; spa: SpaView | null; tours: ExcursionsView | null }) {
  const sailing = useSailing()
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
            <ul className="card-grid">{g.items.map((i) => <Row key={i.id} i={i} clash={clashes.get(i.id) ?? []} />)}</ul>
          </section>
        )
      })}
    </div>
  )
}

function Row({ i, clash }: { i: TripItem; clash: TripItem[] }) {
  return (
    <li className="card">
      <h3 className="card__title"><Link to={i.to}>{i.title}</Link></h3>
      <p><StatusBadge kind="booked" label={t(KIND[i.kind])} /> <strong>{formatTime(i.start)}</strong></p>
      {clash.length > 0 && <Banner kind="warning" title={t('res.trip.clash', { other: clash.map((c) => `${c.title} at ${formatTime(c.start)}`).join(', ') })} />}
      <p>
        <Link to={i.to}>{t('res.trip.open')}<span className="visually-hidden"> {i.title}, {t('plan.day', { n: i.day })}</span></Link>
        {i.kind === 'dining' && <> · <Link to={`/plan/reservations/${i.id}`}>{t('res.trip.details')}<span className="visually-hidden"> {i.title}, {t('plan.day', { n: i.day })}</span></Link></>}
      </p>
      {i.kind !== 'spa' && <SendToChat shareRef={`${i.kind === 'dining' ? 'dining' : 'excursion'}:${i.id}`} title={i.title} />}
    </li>
  )
}
