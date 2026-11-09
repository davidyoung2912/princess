import { useState } from 'react'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/money'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Button } from '../Button'

/**
 * Pay in instalments (H19): a schedule of equal monthly payments the guest can follow. It charges nothing and sets nothing up;
 * each payment is made later with the normal pay button. It stays out of the way when no plan fits.
 */
export function InstalmentPlanner({ number }: { number: string }) {
  const options = useMine(() => api.booking.instalments(number), [number])
  const [count, setCount] = useState<number | null>(null)
  const plans = options.data?.plans ?? []
  if (plans.length === 0) return null
  const chosen = plans.find((p) => p.count === count) ?? null
  return (
    <section className="card" aria-labelledby="instalments-h">
      <h2 id="instalments-h">{t('book.instalments.title')}</h2>
      <p className="muted">{t('book.instalments.intro')}</p>
      <div role="group" aria-label={t('book.instalments.choose')} className="actions">
        {plans.map((p) => (
          <Button key={p.count} variant={p.count === chosen?.count ? 'primary' : 'secondary'} aria-pressed={p.count === chosen?.count} onClick={() => setCount(p.count === chosen?.count ? null : p.count)}>
            {t('book.instalments.option', { count: String(p.count) })}
          </Button>
        ))}
      </div>
      {chosen && (
        <ol>
          {chosen.payments.map((p) => (
            <li key={p.date}>{t('book.instalments.line', { date: formatDate(p.date), amount: formatMoney(p.cents) })}</li>
          ))}
        </ol>
      )}
      <p className="muted">{t('book.instalments.note')}</p>
    </section>
  )
}
