import type { ExcursionsView } from '../../../shared/api/types'
import { formatDate } from '../../../domain/cruise'
import type { PaymentPart } from '../../../domain/fares'
import { formatMoney } from '../../../domain/money'
import { useAction } from '../../../shared/hooks/useAction'
import { t, th } from '../../../shared/i18n'
import { api } from '../../../app/runtime'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { PayPanel } from '../../book/ui/PayPanel'
import { PlanError } from './common'
import { names } from './people'

/** The excursion cart: what is in it, the total with any credit, and the way to pay. Shared by the Excursions page and the Excursions Explorer. */
export function ExcursionCart({ view, reload, headingId = 'cart-h' }: { view: ExcursionsView; reload: () => void; headingId?: string }) {
  const remove = useAction(async (id: string) => { const v = await api.plan.excursions.removeFromCart(id); reload(); return v })
  const pay = useAction(async (parts: PaymentPart[], challenge: string | undefined) => { const v = await api.plan.excursions.checkout(parts, challenge); reload(); return v })
  const due = view.cartTotal - view.creditApplied
  const offerOf = (id: string) => view.offers.find((o) => o.item.id === id)!
  return (
    <>
      <PlanError error={remove.error} />
      {view.cart.length > 0 && (
        <section aria-labelledby={headingId}>
          <h2 id={headingId}>{th('exc.cart')}</h2>
          <ul className="plain-list">
            {view.cart.map((l) => {
              const o = offerOf(l.excursionId)
              return (
                <li key={l.excursionId}>
                  <span><strong>{o.item.name}</strong><br /><span className="muted">{formatDate(o.date)} · {names(l.guests)} · {formatMoney(l.total)}</span></span>
                  <Button variant="tertiary" disabled={remove.busy} onClick={() => void remove.run(l.excursionId)}>{t('exc.remove')}<span className="visually-hidden"> {o.item.name}</span></Button>
                </li>
              )
            })}
          </ul>
          <p><strong>{t('exc.total', { total: formatMoney(view.cartTotal) })}</strong>{view.creditApplied > 0 && ` · ${t('exc.creditUsed', { amount: formatMoney(view.creditApplied) })}`}</p>
          {due > 0 ? <PayPanel due={due} pay={pay} label={t('exc.pay', { amount: formatMoney(due) })} /> : (
            <>
              <PlanError error={pay.error} />
              <Button disabled={pay.busy || !view.canBook} onClick={() => void pay.run([], undefined)}>{pay.busy ? t('pay.paying') : t('exc.bookWithCredit')}</Button>
            </>
          )}
          <p className="muted">{t('exc.cancelRule')}</p>
        </section>
      )}
    </>
  )
}

/** The credit banner, when the party has excursion credit left. */
export function CreditBanner({ view }: { view: ExcursionsView }) {
  if (view.creditLeft <= 0) return null
  return <Banner kind="info" title={t('exc.credit', { amount: formatMoney(view.creditLeft) })}><p>{t('exc.creditBody')}</p></Banner>
}
