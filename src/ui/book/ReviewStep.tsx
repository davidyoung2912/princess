import { Link } from 'react-router'
import { sailingRange } from '../../domain/cruise'
import { FARES } from '../../domain/fares'
import { LEGAL } from '../../domain/policy'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { sailingById } from '../../domain/sailings'
import { categoryById } from '../../domain/ship'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { PriceBreakdown, PriceState } from '../discover/parts'
import { formatDateTime } from '../account/format'
import { ChoiceError } from './ChoiceError'
import { StepSection, type StepProps } from './common'
import { CancellationTable } from './Policy'

/** Step 6: everything in one place before paying (BOK-05, BOK-08, BOK-19): choices with a way to change each, the full price, the payment plan, the cancellation terms, and the documents to accept. */
export function ReviewStep({ draft, update, error }: StepProps) {
  const quote = useAsync(() => api.booking.quote(draft), [draft.sailingId, draft.category, draft.guests, draft.fare])
  const sailing = sailingById(draft.sailingId)
  const category = categoryById(draft.category)
  if (!sailing || !category || !draft.fare) return null
  const rows: { label: StringKey; step: string; value: string }[] = [
    { label: 'book.review.sailing', step: 'sailing', value: sailingRange(sailing) },
    { label: 'book.review.room', step: 'room', value: `${category.name}, ${draft.cabinMode === 'pick' ? t('book.cabin.number', { number: draft.cabinNumber }) : t('book.review.guaranteed')}` },
    { label: 'book.review.fare', step: 'fare', value: FARES[draft.fare].name },
    { label: 'book.review.guests', step: 'guests', value: draft.people.map((g) => `${g.firstName} ${g.lastName}`.trim()).join(', ') },
    { label: 'book.review.dining', step: 'dining', value: `${t(`book.dining.${draft.dining}` as StringKey)}${draft.occasion !== 'none' ? `, ${t(`book.occasion.${draft.occasion}` as StringKey)}` : ''}` },
  ]
  return (
    <StepSection title={t('book.review.title')} intro={t('book.review.intro')}>
      <dl className="summary">
        {rows.map((r) => (
          <div key={r.label} className="summary__row">
            <dt>{t(r.label)}</dt>
            <dd>{r.value} <Link to={`/book/${r.step}`}>{t('book.review.change')}<span className="visually-hidden"> {t(r.label)}</span></Link></dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="price-h">
        <h3 id="price-h">{t('book.review.price')}</h3>
        <PriceState state={quote}>
          {quote.data && (
            <>
              <PriceBreakdown quote={quote.data.quote} />
              <Card info>
                <p>{t('book.review.lock', { time: formatDateTime(quote.data.lockedUntil) })}</p>
                {quote.data.promotions.map((p) => <p key={p.id}><strong>{t('book.review.credit', { amount: formatMoney(p.creditCents) })}</strong> {t('book.review.creditBody')}</p>)}
                <p>
                  {quote.data.pay.options.includes('deposit')
                    ? t('book.review.planDeposit', { deposit: formatMoney(quote.data.pay.deposit), balance: formatMoney(quote.data.quote.total - quote.data.pay.deposit), date: formatDate(quote.data.pay.finalDue) })
                    : t('book.review.planFull', { total: formatMoney(quote.data.quote.total) })}
                </p>
              </Card>
            </>
          )}
        </PriceState>
      </section>

      <section aria-labelledby="cancel-h">
        <h3 id="cancel-h">{t('book.review.cancel')}</h3>
        <CancellationTable />
        <p className="muted">{t('book.cancel.change')}</p>
      </section>

      <section aria-labelledby="legal-h">
        <h3 id="legal-h">{t('book.legal.title')}</h3>
        <p>{t('book.legal.intro')}</p>
        {LEGAL.map((doc) => (
          <fieldset key={doc.id}>
            <legend>{doc.title}</legend>
            <details>
              <summary>{t('book.legal.read')}<span className="visually-hidden"> {doc.title}</span></summary>
              {doc.body.map((p) => <p key={p}>{p}</p>)}
            </details>
            <label className="choice choice--top">
              <input type="checkbox" checked={draft.accepted[doc.id] === true} onChange={(e) => update((d) => ({ ...d, accepted: { ...d.accepted, [doc.id]: e.target.checked } }))} />
              <span>{doc.statement}</span>
            </label>
            <ChoiceError text={error(`accepted.${doc.id}`)} />
          </fieldset>
        ))}
        <p className="muted">{t('book.legal.log')}</p>
      </section>
    </StepSection>
  )
}
