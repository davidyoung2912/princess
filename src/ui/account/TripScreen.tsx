import { Link, useParams } from 'react-router'
import { isApiError } from '../../api/errors'
import { dateIn } from '../../domain/timezones'
import { formatDate, sailingRange } from '../../domain/cruise'
import { sailingById } from '../../domain/sailings'
import { formatMoney } from '../../domain/pricing'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { ManageBooking } from '../book/ManageBooking'
import { Load } from './parts'
import { countdown } from './format'
import { NextStep, PaymentBadge } from './tripParts'

/** One booking's dashboard (MNG-02): countdown, payment, documents, check-in, and the next best action. */
export function TripScreen() {
  const { id = '' } = useParams()
  const trip = useMine(() => api.trips.get(id), [id])
  if (trip.status === 'error' && isApiError(trip.error) && trip.error.code === 'notFound' && !trip.data) {
    return (
      <div className="page">
        <h1>{t('route.trip')}</h1>
        <Banner kind="warning" title={t('trip.notFound')} action={<LinkButton to="/me/trips" variant="secondary">{t('route.trips')}</LinkButton>}><p>{t('trip.notFoundBody')}</p></Banner>
      </div>
    )
  }
  return (
    <div className="page">
      <h1>{trip.data ? sailingRange(sailingById(trip.data.sailingId)!) : t('route.trip')}</h1>
      <Load state={trip}>
        {(x) => (
          <>
            <p className="muted">{t('trip.booking', { number: x.number })} · {x.categoryName} · {t('trip.guests', { count: x.guests })}</p>
            <p className="trip-count" aria-live="polite">{countdown(x.daysToDeparture)}</p>
            <NextStep trip={x} />

            <section aria-labelledby="status-h">
              <h2 id="status-h">{t('trip.status')}</h2>
              <ul className="card-grid">
                <li className="card">
                  <h3 className="card__title">{t('trip.payments')}</h3>
                  <p><PaymentBadge trip={x} /></p>
                  <p className="muted">{t('trip.total', { total: formatMoney(x.plan.total) })}{x.plan.balance > 0 && x.payment !== 'paid' ? ` · ${t('trip.balance', { balance: formatMoney(x.plan.balance), date: formatDate(x.plan.finalDue) })}` : ''}</p>
                  {x.kind === 'current' && <Link to="/me/payments">{t('route.payments')}</Link>}
                  {x.kind === 'booked' && x.payment !== 'paid' && <Link to={`/book/pay/${x.number}`}>{t('trip.next.payDue.go')}</Link>}
                </li>
                <li className="card">
                  <h3 className="card__title">{t('trip.documents')}</h3>
                  {x.documents ? (
                    <>
                      <p>{x.documents.missing === 0 ? t('trip.documents.ready') : t('trip.documents.missing', { count: x.documents.missing })}</p>
                      <Link to="/me/documents">{t('route.documents')}</Link>
                    </>
                  ) : x.kind === 'booked' ? <p className="muted">{t('trip.documents.booked')}</p> : <p className="muted">{t('trip.documents.agent', { agent: x.agent ?? '' })}</p>}
                </li>
                <li className="card">
                  <h3 className="card__title">{t('trip.checkin')}</h3>
                  <p>{x.checkin.state === 'done' ? t('trip.checkin.done') : x.checkin.state === 'open' ? t('trip.checkin.open') : x.checkin.state === 'closed' ? t('trip.checkin.closed') : t('trip.checkin.opens', { date: formatDate(dateIn(x.checkin.opensAt, 'America/New_York')) })}</p>
                  {x.kind === 'current' && <Link to="/home/check-in">{t('route.checkin')}</Link>}
                </li>
              </ul>
            </section>

            {x.kind === 'current' && <Card info><p>{t('trip.planNote')} <Link to="/plan">{t('route.plan')}</Link></p></Card>}
            {x.kind === 'booked' && <ManageBooking number={x.number} onChanged={trip.retry} />}
            <Card info><p>{t('trip.sailingNote')} <Link to={`/home/sailings/${x.sailingId}`}>{t('trip.sailingLink')}</Link></p></Card>
            <p><Link to="/me/trips">{t('route.trips')}</Link></p>
          </>
        )}
      </Load>
    </div>
  )
}
