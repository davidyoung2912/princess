import { Link } from 'react-router'
import type { TripView } from '../../api/types'
import { formatDate, sailingRange } from '../../domain/cruise'
import { sailingById } from '../../domain/sailings'
import type { NextActionId, PaymentState } from '../../domain/trip'
import { t, type StringKey } from '../../i18n'
import { Banner, type BannerKind } from '../Banner'
import { countdown, NEXT_LINK } from './format'
import { LinkButton } from '../Button'
import { StatusBadge, type BadgeKind } from '../StatusBadge'

const PAYMENT_BADGE: Record<PaymentState, BadgeKind> = { paid: 'booked', upcoming: 'ready', dueSoon: 'waitlist', overdue: 'changed' }

/** Payment status as word + icon + colour. */
export function PaymentBadge({ trip }: { trip: TripView }) {
  return <StatusBadge kind={PAYMENT_BADGE[trip.payment]} label={t(`trip.payment.${trip.payment}` as StringKey, { date: formatDate(trip.plan.finalDue) })} />
}

const NEXT_KIND: Record<NextActionId, BannerKind> = { payOverdue: 'danger', documents: 'warning', payDue: 'warning', checkin: 'info', allSet: 'success' }

/** The one next best action for a trip (MNG-02), as a message with a button to do it. */
export function NextStep({ trip }: { trip: TripView }) {
  const to = NEXT_LINK[trip.next]
  const params = { date: formatDate(trip.plan.finalDue), count: trip.documents?.missing ?? 0 }
  return (
    <Banner kind={NEXT_KIND[trip.next]} title={t(`trip.next.${trip.next}` as StringKey, params)} action={to && trip.kind === 'current' ? <LinkButton to={to} variant="secondary">{t(`trip.next.${trip.next}.go` as StringKey)}</LinkButton> : undefined}>
      {trip.next === 'checkin' && <p>{t('trip.next.checkin.body')}</p>}
    </Banner>
  )
}

/** One booking in a list: dates, countdown, payment, and a link to its page. */
export function TripCard({ trip }: { trip: TripView }) {
  const range = sailingRange(sailingById(trip.sailingId)!)
  return (
    <li className="card">
      <h3 className="card__title"><Link to={`/me/trips/${trip.number}`}>{range}</Link></h3>
      <p className="muted">{t('trip.booking', { number: trip.number })} · {trip.categoryName} · {t('trip.guests', { count: trip.guests })}</p>
      <p><strong>{countdown(trip.daysToDeparture)}</strong> <PaymentBadge trip={trip} /></p>
      {trip.agent && <p className="muted">{t('trip.agent', { agent: trip.agent })}</p>}
    </li>
  )
}
