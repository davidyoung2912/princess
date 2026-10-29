import { useState, type FormEvent } from 'react'
import { BRAND_NAMES, CARD_BRANDS, validateCard, type Card as SavedCard, type CardBrand, type CardProblem } from '../../domain/account'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { dateIn } from '../../domain/timezones'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { Field } from '../Field'
import { formatMoment } from './format'
import { ActionError, Load, SupervisedNote } from './parts'
import { PaymentBadge } from './tripParts'
import { usePersona, useNow } from '../../hooks/useDemo'
import { personaById } from '../../domain/personas'

/** Payments (MNG-03): what is owed and when, pay the balance, receipts, and the cards on file. */
export function PaymentsScreen() {
  const view = useMine(() => api.payments.get())
  const me = usePersona()
  const now = useNow()
  const today = dateIn(now, 'America/New_York')
  const [confirming, setConfirming] = useState(false)
  const [cardId, setCardId] = useState('')
  const [paidNote, setPaidNote] = useState(false)
  const pay = useAction((id: string) => api.payments.payBalance(id))
  const remove = useAction((id: string) => api.payments.removeCard(id))

  return (
    <div className="page">
      <h1>{t('route.payments')}</h1>
      <Load state={view}>
        {(v) => {
          const { trip } = v
          const usable = v.cards.filter((c) => !validateCard(c.last4, c.expiry, today))
          const chosen = usable.find((c) => c.id === cardId) ?? usable[0]
          const owing = trip.payment !== 'paid'
          const confirm = async () => {
            if (chosen && (await pay.run(chosen.id))) { setConfirming(false); setPaidNote(true); view.retry() }
          }
          return (
            <>
              {!v.canPay && me && <SupervisedNote booker={personaById(me.booker)!.firstName} />}
              <Card labelledBy="summary-h">
                <h2 id="summary-h">{t('pay.summary')}</h2>
                <dl className="facts">
                  <div><dt>{t('pay.total')}</dt><dd>{formatMoney(trip.plan.total)}</dd></div>
                  <div><dt>{t('pay.deposit')}</dt><dd>{formatMoney(trip.plan.deposit)}</dd></div>
                  <div><dt>{t('pay.balance')}</dt><dd>{formatMoney(trip.plan.balance)}</dd></div>
                  <div><dt>{t('pay.due')}</dt><dd>{formatDate(trip.plan.finalDue)}</dd></div>
                </dl>
                <p><PaymentBadge trip={trip} /></p>
                <p className="muted">{t('pay.estimateNote')}</p>
              </Card>
              <p role="status">{paidNote ? t('pay.paidNote') : ''}</p>

              {owing && v.canPay && (
                <section aria-labelledby="pay-h">
                  <h2 id="pay-h">{t('pay.payBalance')}</h2>
                  {trip.payment === 'overdue' && <Banner kind="danger" title={t('pay.overdue', { date: formatDate(trip.plan.finalDue) })}><p>{t('pay.overdueBody')}</p></Banner>}
                  {chosen ? (
                    <>
                      <fieldset>
                        <legend>{t('pay.chooseCard')}</legend>
                        {usable.map((c) => <label key={c.id} className="choice"><input type="radio" name="card" checked={chosen.id === c.id} onChange={() => setCardId(c.id)} /><span>{BRAND_NAMES[c.brand]} {t('pay.ending', { last4: c.last4 })}</span></label>)}
                      </fieldset>
                      <Button onClick={() => setConfirming(true)}>{t('pay.payButton', { amount: formatMoney(trip.plan.balance) })}</Button>
                    </>
                  ) : <Banner kind="warning" title={t('pay.noCard')} />}
                </section>
              )}
              {confirming && chosen && (
                <Dialog title={t('pay.confirmTitle')} onClose={() => setConfirming(false)}>
                  <p>{t('pay.confirmBody', { amount: formatMoney(trip.plan.balance), card: `${BRAND_NAMES[chosen.brand]} ${t('pay.ending', { last4: chosen.last4 })}` })}</p>
                  <ActionError error={pay.error} />
                  <div className="button-row">
                    <Button disabled={pay.busy} onClick={() => void confirm()}>{pay.busy ? t('pay.paying') : t('pay.confirm')}</Button>
                    <Button variant="secondary" onClick={() => setConfirming(false)}>{t('data.cancel')}</Button>
                  </div>
                </Dialog>
              )}

              <section aria-labelledby="rec-h">
                <h2 id="rec-h">{t('pay.receipts')}</h2>
                <ul className="plain-list">
                  {v.receipts.map((r) => (
                    <li key={r.id}>
                      <span><strong>{t(`pay.receipt.${r.label}` as StringKey)}</strong> · {formatMoney(r.cents)}<br /><span className="muted">{formatMoment(r.at)} · {r.method} · {t('pay.receiptNo', { id: r.id })}</span></span>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="cards-h">
                <h2 id="cards-h">{t('pay.cards')}</h2>
                <ActionError error={remove.error} />
                {v.cards.length === 0 && <p className="muted">{t('pay.noCards')}</p>}
                <ul className="plain-list">
                  {v.cards.map((c) => <CardRow key={c.id} card={c} expired={!!validateCard(c.last4, c.expiry, today)} canEdit={v.canPay && !remove.busy} onRemove={async () => { if (await remove.run(c.id)) view.retry() }} />)}
                </ul>
                {v.canPay && <AddCard today={today} onAdded={view.retry} />}
                <p className="muted">{t('pay.cardPrivacy')}</p>
              </section>
            </>
          )
        }}
      </Load>
    </div>
  )
}

function CardRow({ card, expired, canEdit, onRemove }: { card: SavedCard; expired: boolean; canEdit: boolean; onRemove: () => Promise<void> }) {
  const name = `${BRAND_NAMES[card.brand]} ${t('pay.ending', { last4: card.last4 })}`
  return (
    <li>
      <span>{name} <span className="muted">· {t('pay.expires', { date: card.expiry })}</span> {expired && <span className="tag tag--alert">{t('pay.expired')}</span>}</span>
      <Button variant="tertiary" disabled={!canEdit} onClick={() => void onRemove()}>{t('pay.remove')}<span className="visually-hidden"> {name}</span></Button>
    </li>
  )
}

function AddCard({ today, onAdded }: { today: string; onAdded: () => void }) {
  const [brand, setBrand] = useState<CardBrand>('visa')
  const [last4, setLast4] = useState('')
  const [expiry, setExpiry] = useState('')
  const [problem, setProblem] = useState<CardProblem | null>(null)
  const [done, setDone] = useState(false)
  const add = useAction((b: CardBrand, l: string, e: string) => api.payments.addCard(b, l, e))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setDone(false)
    const found = validateCard(last4, expiry, today)
    setProblem(found)
    if (found) return
    if (await add.run(brand, last4, expiry)) { setLast4(''); setExpiry(''); setDone(true); onAdded() }
  }
  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-labelledby="add-card-h">
      <h3 id="add-card-h">{t('pay.addCard')}</h3>
      <div className="field">
        <label htmlFor="brand">{t('pay.brand')}</label>
        <select id="brand" value={brand} onChange={(e) => setBrand(e.target.value as CardBrand)}>{CARD_BRANDS.map((b) => <option key={b} value={b}>{BRAND_NAMES[b]}</option>)}</select>
      </div>
      <Field label={t('pay.last4')} hint={t('pay.last4Hint')} inputMode="numeric" maxLength={4} autoComplete="off" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} error={problem === 'last4' ? t('pay.err.last4') : undefined} />
      <Field label={t('pay.expiry')} hint={t('pay.expiryHint')} placeholder="MM/YY" maxLength={5} autoComplete="off" value={expiry} onChange={(e) => setExpiry(e.target.value)} error={problem === 'expiry' ? t('pay.err.expiry') : problem === 'expired' ? t('pay.err.expired') : undefined} />
      <ActionError error={add.error} />
      <Button type="submit" variant="secondary" disabled={add.busy}>{add.busy ? t('account.saving') : t('pay.addButton')}</Button>
      <p role="status" className="muted">{done ? t('pay.cardAdded') : ''}</p>
    </form>
  )
}
