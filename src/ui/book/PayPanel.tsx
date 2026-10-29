import { useState, type FormEvent } from 'react'
import { BRAND_NAMES, CARD_BRANDS, validateCard, type Card as SavedCard, type CardBrand } from '../../domain/account'
import { checkParts, SCA_DEMO_CODE, walletSupported, type PaymentPart } from '../../domain/fares'
import { formatMoney, parseMoney } from '../../domain/pricing'
import { dateIn } from '../../domain/timezones'
import { api } from '../../runtime'
import type { Action } from '../../hooks/useAction'
import { useAction } from '../../hooks/useAction'
import { useNow } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { Field } from '../Field'
import { ActionError, Load } from '../account/parts'

type Pay = Action<[PaymentPart[], string | undefined], unknown>

const WALLET = 'wallet'

/**
 * How to pay an amount (BOK-06): a saved card, a new card, the device wallet, or two of them. The bank's code check
 * (3-D Secure) opens only when the bank asks for it. Nothing is charged until the guest presses the pay button.
 */
export function PayPanel({ due, pay, label }: { due: number; pay: Pay; label: string }) {
  const view = useMine(() => api.payments.get())
  return (
    <Load state={view}>
      {(v) => <Methods due={due} pay={pay} label={label} cards={v.cards} canPay={v.canPay} reload={view.retry} />}
    </Load>
  )
}

function Methods({ due, pay, label, cards, canPay, reload }: { due: number; pay: Pay; label: string; cards: SavedCard[]; canPay: boolean; reload: () => void }) {
  const today = dateIn(useNow(), 'America/New_York')
  const usable = cards.filter((c) => !validateCard(c.last4, c.expiry, today))
  const wallet = typeof window !== 'undefined' && walletSupported(window)
  const methods = [...usable.map((c) => ({ key: c.id, label: `${BRAND_NAMES[c.brand]} ${t('pay.ending', { last4: c.last4 })}` })), ...(wallet ? [{ key: WALLET, label: t('book.pay.wallet') }] : [])]
  const [split, setSplit] = useState(false)
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [amount, setAmount] = useState('')
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [problem, setProblem] = useState('')
  const firstKey = methods.find((m) => m.key === first)?.key ?? methods[0]?.key ?? ''
  const secondKey = methods.find((m) => m.key === second && m.key !== firstKey)?.key ?? methods.find((m) => m.key !== firstKey)?.key ?? ''

  const part = (key: string, cents: number): PaymentPart => (key === WALLET ? { method: 'wallet', cents } : { method: 'card', cardId: key, cents })
  const build = (): PaymentPart[] | null => {
    if (!split) return firstKey ? [part(firstKey, due)] : null
    const cents = parseMoney(amount)
    if (cents === null || cents <= 0 || cents >= due || !secondKey) { setProblem(t('book.pay.splitAmount', { max: formatMoney(due - 100) })); return null }
    return [part(firstKey, cents), part(secondKey, due - cents)]
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setProblem('')
    const built = build()
    if (!built) { if (!split) setProblem(t('book.pay.chooseMethod')); return }
    const bad = checkParts(built, due)
    if (bad) { setProblem(t('book.pay.splitAmount', { max: formatMoney(due - 100) })); return }
    await pay.run(built, undefined)
  }

  const code3ds = pay.error?.code === 'challenge'
  const needsCode = code3ds && pay.error?.message === 'required'
  // The bank asked for its code: the check opens, and stays open while the guest retries.
  const checking = code !== null || needsCode
  const typed = code ?? ''

  const retryWithCode = async (e: FormEvent) => {
    e.preventDefault()
    const built = build()
    if (built) await pay.run(built, typed.trim())
  }

  if (!canPay) return <Banner kind="info" title={t('book.pay.supervised')} />

  return (
    <>
    <form onSubmit={(e) => void submit(e)} noValidate>
      {methods.length === 0 && <Banner kind="info" title={t('book.pay.noMethod')} />}
      <fieldset>
        <legend>{split ? t('book.pay.first') : t('book.pay.with')}</legend>
        {methods.map((m) => (
          <label key={m.key} className="choice">
            <input type="radio" name="pay-first" value={m.key} checked={firstKey === m.key} onChange={() => setFirst(m.key)} />
            <span>{m.label}</span>
          </label>
        ))}
        {split && (
          <Field label={t('book.pay.firstAmount')} hint={t('book.pay.firstAmountHint', { total: formatMoney(due) })} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
        )}
      </fieldset>
      {split && (
        <fieldset>
          <legend>{t('book.pay.second')}</legend>
          {methods.filter((m) => m.key !== firstKey).map((m) => (
            <label key={m.key} className="choice">
              <input type="radio" name="pay-second" value={m.key} checked={secondKey === m.key} onChange={() => setSecond(m.key)} />
              <span>{m.label}</span>
            </label>
          ))}
          {methods.length < 2 && <p className="muted">{t('book.pay.needSecond')}</p>}
          <p className="muted">{parseMoney(amount) !== null && parseMoney(amount)! < due ? t('book.pay.secondAmount', { amount: formatMoney(due - parseMoney(amount)!) }) : ''}</p>
        </fieldset>
      )}
      <div className="button-row">
        <Button variant="tertiary" aria-pressed={split} onClick={() => { setSplit(!split); setProblem('') }}>{split ? t('book.pay.oneMethod') : t('book.pay.split')}</Button>
        <Button variant="tertiary" onClick={() => setAdding(true)}>{t('book.pay.addCard')}</Button>
      </div>
      {!wallet && <p className="muted">{t('book.pay.noWallet')}</p>}
      {wallet && <p className="muted">{t('book.pay.walletNote')}</p>}

      {problem && <p role="alert" className="field__error">{problem}</p>}
      {pay.error?.code === 'declined' && <Banner kind="danger" title={t('book.pay.declined', { card: pay.error.message })}><p>{t('book.pay.declinedBody')}</p></Banner>}
      {pay.error?.code === 'invalid' && <Banner kind="warning" title={t('book.pay.invalid')} />}
      {pay.error && !['declined', 'invalid', 'challenge', 'conflict'].includes(pay.error.code) && <ActionError error={pay.error} />}
      <Button type="submit" block disabled={pay.busy || methods.length === 0}>{pay.busy && code === null ? t('pay.paying') : label}</Button>
      <p className="muted">{t('book.pay.demoHint', { code: SCA_DEMO_CODE })}</p>
    </form>

      {checking && (
        <Dialog title={t('book.sca.title')} onClose={() => { setCode(null); pay.clear() }}>
          <form onSubmit={(e) => void retryWithCode(e)} noValidate>
            <p>{t('book.sca.body', { amount: formatMoney(due) })}</p>
            {code3ds && pay.error?.message === 'wrong' && <p role="alert" className="field__error">{t('book.sca.wrong')}</p>}
            <Field label={t('book.sca.code')} hint={t('book.sca.hint', { code: SCA_DEMO_CODE })} inputMode="numeric" autoComplete="one-time-code" value={typed} onChange={(e) => setCode(e.target.value)} />
            {pay.error && !code3ds && <ActionError error={pay.error} />}
            <div className="button-row">
              <Button type="submit" disabled={pay.busy || !typed.trim()}>{pay.busy ? t('pay.paying') : t('book.sca.confirm')}</Button>
              <Button variant="secondary" onClick={() => { setCode(null); pay.clear() }}>{t('book.sca.cancel')}</Button>
            </div>
          </form>
        </Dialog>
      )}
      {adding && <AddCard onClose={() => setAdding(false)} onAdded={(id) => { setFirst(id); reload(); setAdding(false) }} today={today} />}
    </>
  )
}

/** A small form to add a card without leaving the booking. Only the last four digits and the expiry are kept. */
function AddCard({ onClose, onAdded, today }: { onClose: () => void; onAdded: (id: string) => void; today: string }) {
  const [brand, setBrand] = useState<CardBrand>('visa')
  const [last4, setLast4] = useState('')
  const [expiry, setExpiry] = useState('')
  const [problem, setProblem] = useState('')
  const add = useAction((b: CardBrand, l: string, e: string) => api.payments.addCard(b, l, e))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const bad = validateCard(last4, expiry, today)
    if (bad) { setProblem(t(`pay.err.${bad}` as StringKey)); return }
    setProblem('')
    const cards = await add.run(brand, last4, expiry)
    if (cards) onAdded(cards[cards.length - 1].id)
  }
  return (
    <Dialog title={t('book.pay.addCard')} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor="add-brand">{t('pay.brand')}</label>
          <select id="add-brand" value={brand} onChange={(e) => setBrand(e.target.value as CardBrand)}>
            {CARD_BRANDS.map((b) => <option key={b} value={b}>{BRAND_NAMES[b]}</option>)}
          </select>
        </div>
        <Field label={t('pay.last4')} hint={t('pay.last4Hint')} inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value)} autoComplete="off" />
        <Field label={t('pay.expiry')} hint={t('pay.expiryHint')} value={expiry} maxLength={5} onChange={(e) => setExpiry(e.target.value)} autoComplete="off" />
        {problem && <p role="alert" className="field__error">{problem}</p>}
        <ActionError error={add.error} />
        <div className="button-row">
          <Button type="submit" disabled={add.busy}>{add.busy ? t('account.saving') : t('pay.addButton')}</Button>
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
