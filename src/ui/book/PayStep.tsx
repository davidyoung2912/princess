import { useState } from 'react'
import { Link } from 'react-router'
import type { BookingView } from '../../api/types'
import type { Draft } from '../../domain/booking'
import { dueNow, type PayOption, type PaymentPart } from '../../domain/fares'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { PriceState } from '../discover/parts'
import { StepSection } from './common'
import { PayPanel } from './PayPanel'

/** Why a booking was refused when the answer is not about the payment itself. */
export function BookingConflict({ message, onRefresh }: { message: string; onRefresh: () => void }) {
  if (message === 'priceChanged') return <Banner kind="warning" title={t('book.conflict.price')} action={<Button variant="secondary" onClick={onRefresh}>{t('book.conflict.showPrice')}</Button>}><p>{t('book.conflict.priceBody')}</p></Banner>
  if (message === 'cabinTaken') return <Banner kind="warning" title={t('book.conflict.cabin')}><p>{t('book.conflict.cabinBody')} <Link to="/book/room">{t('book.conflict.chooseRoom')}</Link></p></Banner>
  if (message === 'closed') return <Banner kind="warning" title={t('book.conflict.closed')}><p><Link to="/book/sailing">{t('book.conflict.chooseDate')}</Link></p></Banner>
  return <Banner kind="warning" title={t('book.conflict.other')} />
}

/** Step 7: how much to pay now, and how (BOK-05, BOK-06). */
export function PayStep({ draft, onBooked }: { draft: Draft; onBooked: (booking: BookingView) => void }) {
  const quote = useAsync(() => api.booking.quote(draft), [draft.sailingId, draft.category, draft.guests, draft.fare])
  const [choice, setChoice] = useState<PayOption>('deposit')
  const plan = quote.data?.pay
  const option: PayOption = plan && plan.options.includes(choice) ? choice : (plan?.options[0] ?? 'full')
  const due = plan ? dueNow(plan, option) : 0
  const book = useAction(async (parts: PaymentPart[], challenge: string | undefined) => {
    const booking = await api.booking.book({ draft, expectedTotal: quote.data!.quote.total, option, parts, challenge })
    onBooked(booking)
    return booking
  })
  return (
    <StepSection title={t('book.pay.title')} intro={t('book.pay.intro')}>
      <PriceState state={quote}>
        {quote.data && plan && (
          <>
            <p className="trip-count">{t('book.pay.total', { total: formatMoney(quote.data.quote.total) })}</p>
            {plan.options.length > 1 ? (
              <fieldset>
                <legend>{t('book.pay.option')}</legend>
                <label className="choice choice--top">
                  <input type="radio" name="pay-option" checked={option === 'deposit'} onChange={() => setChoice('deposit')} />
                  <span>{t('book.pay.deposit', { amount: formatMoney(plan.deposit) })}<small>{t('book.pay.depositBody', { balance: formatMoney(plan.total - plan.deposit), date: formatDate(plan.finalDue) })}</small></span>
                </label>
                <label className="choice choice--top">
                  <input type="radio" name="pay-option" checked={option === 'full'} onChange={() => setChoice('full')} />
                  <span>{t('book.pay.full', { amount: formatMoney(plan.total) })}<small>{t('book.pay.fullBody')}</small></span>
                </label>
              </fieldset>
            ) : <Banner kind="info" title={t('book.pay.fullOnly', { date: formatDate(plan.finalDue) })} />}
            {book.error?.code === 'conflict' && <BookingConflict message={book.error.message} onRefresh={() => { book.clear(); quote.retry() }} />}
            {book.error?.code === 'invalid' && book.error.message.startsWith('Some answers') && <Banner kind="warning" title={t('book.pay.incomplete')} action={<Link to="/book">{t('book.pay.fix')}</Link>} />}
            <PayPanel due={due} pay={book} label={t('book.pay.button', { amount: formatMoney(due) })} />
          </>
        )}
      </PriceState>
    </StepSection>
  )
}
