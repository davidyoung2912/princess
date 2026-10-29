import { Link, useParams } from 'react-router'
import { isApiError } from '../../api/errors'
import { formatDate } from '../../domain/cruise'
import type { PaymentPart } from '../../domain/fares'
import { formatMoney } from '../../domain/pricing'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
import { Load } from '../account/parts'
import { PayPanel } from './PayPanel'

/** Pay what is left on a booking made here (BOK-05, BOK-06). */
export function BalanceScreen() {
  const { id = '' } = useParams()
  const booking = useMine(() => api.booking.get(id), [id])
  const pay = useAction(async (parts: PaymentPart[], challenge: string | undefined) => {
    const result = await api.booking.payBalance(id, parts, challenge)
    booking.retry()
    return result
  })
  if (booking.status === 'error' && isApiError(booking.error) && booking.error.code === 'notFound' && !booking.data) {
    return (
      <div className="page">
        <h1>{t('route.bookPay')}</h1>
        <Banner kind="warning" title={t('trip.notFound')} action={<LinkButton to="/me/trips" variant="secondary">{t('route.trips')}</LinkButton>}><p>{t('trip.notFoundBody')}</p></Banner>
      </div>
    )
  }
  return (
    <div className="page">
      <h1>{t('route.bookPay')}</h1>
      <Load state={booking}>
        {(b) => (
          <>
            <p className="muted">{t('trip.booking', { number: b.number })} · {t('trip.total', { total: formatMoney(b.total) })} · {t('book.done.paidSoFar', { paid: formatMoney(b.paid) })}</p>
            {b.status === 'cancelled' ? (
              <Banner kind="warning" title={t('book.done.cancelled')} />
            ) : b.balance === 0 ? (
              <Banner kind="success" title={t('book.balance.paid')} action={<LinkButton to={`/book/confirmed/${b.number}`} variant="secondary">{t('book.balance.receipt')}</LinkButton>} />
            ) : (
              <>
                {b.payment === 'overdue'
                  ? <Banner kind="danger" title={t('pay.overdue', { date: formatDate(b.finalDue) })}><p>{t('pay.overdueBody')}</p></Banner>
                  : <Banner kind="info" title={t('book.balance.due', { balance: formatMoney(b.balance), date: formatDate(b.finalDue) })} />}
                {pay.error?.code === 'conflict' && <Banner kind="info" title={t('book.balance.nothing')} />}
                <PayPanel due={b.balance} pay={pay} label={t('pay.payButton', { amount: formatMoney(b.balance) })} />
              </>
            )}
            <p><Link to={`/me/trips/${b.number}`}>{t('book.done.manage')}</Link></p>
          </>
        )}
      </Load>
    </div>
  )
}
