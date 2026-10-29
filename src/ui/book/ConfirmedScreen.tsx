import { Link, useParams } from 'react-router'
import type { BookingView } from '../../api/types'
import { buildIcs } from '../../domain/calendar'
import { CRUISE, formatDate, sailingRange } from '../../domain/cruise'
import { FARES } from '../../domain/fares'
import { formatMoney } from '../../domain/pricing'
import { legalById } from '../../domain/policy'
import { sailingById } from '../../domain/sailings'
import { SHIP } from '../../domain/ship'
import { dateIn } from '../../domain/timezones'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { isApiError } from '../../api/errors'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Download, Printer } from '../icons'
import { formatDateTime } from '../account/format'
import { Load } from '../account/parts'

/** Booking confirmation (BOK-07): the number, what was booked and paid, where the messages went, and the documents to keep. */
export function ConfirmedScreen() {
  const { id = '' } = useParams()
  const booking = useMine(() => api.booking.get(id), [id])
  if (booking.status === 'error' && isApiError(booking.error) && booking.error.code === 'notFound' && !booking.data) {
    return (
      <div className="page">
        <h1>{t('route.bookConfirmed')}</h1>
        <Banner kind="warning" title={t('trip.notFound')} action={<LinkButton to="/me/trips" variant="secondary">{t('route.trips')}</LinkButton>}><p>{t('trip.notFoundBody')}</p></Banner>
      </div>
    )
  }
  return (
    <div className="page">
      <h1>{t('route.bookConfirmed')}</h1>
      <Load state={booking}>{(b) => <Confirmation b={b} />}</Load>
    </div>
  )
}

function calendarLink(b: BookingView): string {
  const ics = buildIcs({
    uid: `${b.number}@princess.concept`, summary: `${CRUISE.name} on ${SHIP.name}`, start: b.departure, end: b.returnDate, stamp: b.createdAt, location: CRUISE.homePort,
    description: `Booking ${b.number}. Sail from ${CRUISE.homePort} on ${formatDate(b.departure)} and return on ${formatDate(b.returnDate)}.`,
  })
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
}

function Confirmation({ b }: { b: BookingView }) {
  const sailing = sailingById(b.sailingId)!
  const cancelled = b.status === 'cancelled'
  return (
    <>
      {cancelled
        ? <Banner kind="warning" title={t('book.done.cancelled')}><p>{t('book.done.cancelledBody', { refund: formatMoney(b.cancelled?.refund ?? 0) })}</p></Banner>
        : <Banner kind="success" title={t('book.done.title')}><p>{t('book.done.body', { email: b.notified.find((n) => n.via === 'email')?.to ?? '' })}</p></Banner>}
      <Card hero>
        <p className="eyebrow">{t('book.done.number')}</p>
        <p className="booking-number">{b.number}</p>
        <p>{sailingRange(sailing)} · {b.categoryName}</p>
      </Card>

      <section aria-labelledby="sum-h">
        <h2 id="sum-h">{t('book.done.summary')}</h2>
        <dl className="summary">
          <div className="summary__row"><dt>{t('book.review.sailing')}</dt><dd>{formatDate(b.departure)} {t('book.done.to')} {formatDate(b.returnDate)}</dd></div>
          <div className="summary__row"><dt>{t('book.review.room')}</dt><dd>{b.categoryName}, {b.cabin ? t('book.cabin.number', { number: b.cabin }) : t('book.done.assigned')}</dd></div>
          <div className="summary__row"><dt>{t('book.review.fare')}</dt><dd>{FARES[b.fare].name}</dd></div>
          <div className="summary__row"><dt>{t('book.review.guests')}</dt><dd>{b.people.map((g) => `${g.firstName} ${g.lastName}`.trim()).join(', ')}</dd></div>
          <div className="summary__row"><dt>{t('book.review.dining')}</dt><dd>{t(`book.dining.${b.dining}` as StringKey)}{b.occasion !== 'none' ? `, ${t(`book.occasion.${b.occasion}` as StringKey)}` : ''}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="money-h">
        <h2 id="money-h">{t('book.done.money')}</h2>
        <p>{t('trip.total', { total: formatMoney(b.total) })} · {t('book.done.paidSoFar', { paid: formatMoney(b.paid) })}</p>
        {!cancelled && (b.balance > 0
          ? <Banner kind="info" title={t('book.done.balance', { balance: formatMoney(b.balance), date: formatDate(b.finalDue) })} action={<LinkButton to={`/book/pay/${b.number}`} variant="secondary">{t('trip.next.payDue.go')}</LinkButton>} />
          : <p>{t('trip.payment.paid')}</p>)}
        <ul className="plain-list">
          {b.receipts.map((r) => (
            <li key={r.id}>
              <span><strong>{t(`book.receipt.${r.label}` as StringKey)}</strong> · {formatMoney(Math.abs(r.cents))}<br /><span className="muted">{formatDateTime(r.at)} · {r.methods.join(' + ')} · {t('pay.receiptNo', { id: r.id })}</span></span>
            </li>
          ))}
        </ul>
        <p className="muted">{t('book.done.promo')}</p>
      </section>

      {!cancelled && (
        <section aria-labelledby="docs-h">
          <h2 id="docs-h">{t('book.done.docs')}</h2>
          <p>{t('book.done.sent')}</p>
          <ul className="plain-bullets">{b.notified.map((n) => <li key={n.via}>{t(`book.done.via.${n.via}` as StringKey, { to: n.to })}</li>)}</ul>
          <div className="button-row">
            <Button variant="secondary" onClick={() => window.print()}><Printer aria-hidden="true" /> {t('book.done.print')}</Button>
            <a className="btn btn--secondary" href={calendarLink(b)} download={`sun-princess-${b.number}.ics`}><Download aria-hidden="true" /> {t('book.done.calendar')}</a>
          </div>
          <Card info><p>{t('book.done.wallet', { date: formatDate(dateIn(sailingStart(b), 'America/New_York')) })}</p></Card>
        </section>
      )}

      <section aria-labelledby="acc-h">
        <h2 id="acc-h">{t('book.done.accepted')}</h2>
        <ul className="plain-bullets">
          {b.accepted.map((a) => <li key={a.id}>{legalById(a.id)?.title} · {t('book.done.version', { version: a.version })} · {formatDateTime(a.at)}</li>)}
        </ul>
      </section>

      <p><Link to={`/me/trips/${b.number}`}>{t('book.done.manage')}</Link> · <Link to="/me/trips">{t('route.trips')}</Link></p>
    </>
  )
}

/** Check-in opens three days before sailing; shown as a date. */
const sailingStart = (b: BookingView): number => Date.parse(`${b.departure}T12:00:00Z`) - 3 * 86_400_000
