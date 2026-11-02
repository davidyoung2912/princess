import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { formatMoney } from '../../domain/pricing'
import { CURRENCIES, CASH_DESK_MIN, GRATUITY_REASON_MIN, TOPUP_MAX, TOPUP_MIN, TOPUP_TOTAL_MAX } from '../../domain/services'
import { inCurrencyAt, rateAgeDays, ratesStale } from '../../domain/rates'
import { PIN_DESK_MIN } from '../../domain/pinReset'
import { CHARGE_CHECKS } from '../../domain/moneyShield'
import { useSettings } from '../../hooks/useSettings'
import { useRates } from '../../hooks/useRates'
import { useNow } from '../../hooks/useDemo'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useShipTime } from '../onboard/shipTime'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field, TextArea } from '../Field'
import { Load } from '../account/parts'
import { StatusBadge } from '../StatusBadge'
import { AboardError, Back, ChildNote } from './common'
import type { MoneyView } from '../../api/aboardTypes'

const AMOUNTS: readonly number[] = [TOPUP_MIN, 50, 100, 200, 500, TOPUP_MAX]

/** Money on board (ACC-03, ACC-05, ACC-07): top up the account, set or reset the account PIN, prepay or query gratuities, and see amounts in another currency. */
export function MoneyScreen() {
  const view = useMine(() => api.aboard.money.view())
  return (
    <div className="page">
      <h1>{t('route.money')}</h1>
      <p>{t('money.intro')}</p>
      <ChildNote />
      <Load state={view}>
        {(v) => (
          <>
            <Currency v={v} reload={view.retry} />
            <ChargeChecks />
            {v.canEdit && (
              <>
                <TopUps v={v} reload={view.retry} />
                <Pin v={v} reload={view.retry} />
                <Gratuities v={v} reload={view.retry} />
              </>
            )}
          </>
        )}
      </Load>
      <p><Link to="/me/bill">{t('route.bill')}</Link> · <Link to="/me/payments">{t('route.payments')}</Link></p>
      <Back to="/me" label={t('route.me')} />
    </div>
  )
}

/** The bill total in the chosen currency, as a plain note; nothing when the currency is dollars. */
export function InCurrency({ cents }: { cents: number }) {
  const view = useMine(() => api.aboard.money.view())
  const { table } = useRates()
  if (!view.data || view.data.currency === 'USD') return null
  return <p className="muted">{t('money.about', { amount: inCurrencyAt(cents, view.data.currency, table), code: view.data.currency })}</p>
}

/** When to be asked before an optional charge (XT-03), and the promise that nothing renews by itself (XT-06). */
function ChargeChecks() {
  const [settings, update] = useSettings()
  return (
    <section aria-labelledby="chk-h">
      <h2 id="chk-h">{t('money.checks')}</h2>
      <p>{t('money.checksBody')}</p>
      <div className="field">
        <label htmlFor="chk">{t('money.checksLabel')}</label>
        <select id="chk" className="field__input" value={settings.chargeCheck} onChange={(e) => update({ chargeCheck: e.target.value as typeof settings.chargeCheck })}>
          {CHARGE_CHECKS.map((c) => <option key={c} value={c}>{t(`money.check.${c}` as StringKey)}</option>)}
        </select>
      </div>
      <p className="muted">{t('money.checksNote')}</p>
      <Card info><p><strong>{t('money.noRenew')}</strong> {t('money.noRenewBody')}</p></Card>
    </section>
  )
}

function Currency({ v, reload }: { v: MoneyView; reload: () => void }) {
  const set = useAction(async (code: string) => { await api.aboard.money.setCurrency(code); reload() })
  const { table, refresh } = useRates()
  const now = useNow()
  const stale = ratesStale(table, now)
  return (
    <section aria-labelledby="cur-h">
      <h2 id="cur-h">{t('money.currency')}</h2>
      <div className="field">
        <label htmlFor="cur">{t('money.showIn')}</label>
        <select id="cur" className="field__input" value={v.currency} onChange={(e) => void set.run(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
        </select>
      </div>
      <AboardError error={set.error} />
      <table className="rates">
        <caption>{t('money.rates', { date: table.asOf })}</caption>
        <thead><tr><th scope="col">{t('money.usd')}</th><th scope="col">{v.currency}</th></tr></thead>
        <tbody>{[10, 50, 100].map((n) => <tr key={n}><td>{formatMoney(n * 100)}</td><td>{inCurrencyAt(n * 100, v.currency, table)}</td></tr>)}</tbody>
      </table>
      <p className="muted">{t('money.currencyNote')}</p>
      {stale && <p role="status">{t('money.ratesOld', { days: Number.isFinite(rateAgeDays(table, now)) ? rateAgeDays(table, now) : 0 })}</p>}
      <Button variant="secondary" onClick={() => refresh(now)}>{t('money.ratesUpdate')}</Button>
    </section>
  )
}

export function TopUps({ v, reload }: { v: MoneyView; reload: () => void }) {
  const shipTime = useShipTime()
  const [dollars, setDollars] = useState(100)
  const [source, setSource] = useState<'card' | 'cash'>(v.hasCard ? 'card' : 'cash')
  const go = useAction(async () => { await api.aboard.money.topUp(dollars, source); reload() })
  return (
    <section aria-labelledby="top-h">
      <h2 id="top-h">{t('money.topUp')}</h2>
      <p>{t('money.topUpBody', { max: TOPUP_TOTAL_MAX })}</p>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void go.run() }}>
        <div className="field">
          <label htmlFor="amt">{t('money.amount')}</label>
          <select id="amt" className="field__input" value={dollars} onChange={(e) => setDollars(Number(e.target.value))}>
            {AMOUNTS.map((n) => <option key={n} value={n}>${n}</option>)}
          </select>
        </div>
        <fieldset className="plain-fieldset">
          <legend>{t('money.how')}</legend>
          <label className="choice"><input type="radio" name="src" checked={source === 'card'} onChange={() => setSource('card')} /><span>{t('money.card')}</span></label>
          <label className="choice"><input type="radio" name="src" checked={source === 'cash'} onChange={() => setSource('cash')} /><span>{t('money.cash', { minutes: CASH_DESK_MIN })}</span></label>
        </fieldset>
        <AboardError error={go.error} />
        <Button type="submit" disabled={go.busy}>{t('money.topUpGo', { amount: dollars })}</Button>
      </form>
      {v.topUps.length > 0 && (
        <ul className="plain-bullets">
          {v.topUps.map((x) => (
            <li key={x.id}>
              ${x.dollars} · {t(`money.src.${x.source}` as StringKey)} · {x.reference} · {shipTime(x.at)}{' '}
              <StatusBadge kind={x.settledAt === null ? 'waitlist' : 'booked'} label={x.settledAt === null ? t('money.waitingDesk') : t('money.added')} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Pin({ v, reload }: { v: MoneyView; reload: () => void }) {
  const shipTime = useShipTime()
  const reset = v.pinReset ?? null
  const ready = reset?.stage === 'ready'
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const save = useAction(async () => { await api.aboard.money.setPin(next, v.pinSet && !ready ? current : undefined); setCurrent(''); setNext(''); reload() })
  const forgot = useAction(async () => { await api.aboard.money.forgotPin(); reload() })
  return (
    <section aria-labelledby="pin-h">
      <h2 id="pin-h">{t('money.pin')}</h2>
      <p>{v.pinSet ? t('money.pinSet') : t('money.pinNone')}</p>
      {reset && (
        <Banner kind={reset.stage === 'ready' ? 'success' : 'info'} title={t(`money.reset.${reset.stage}` as StringKey)}>
          <p>{reset.stage === 'waiting' ? t('money.reset.waitingBody', { minutes: PIN_DESK_MIN, time: shipTime(reset.readyAt) }) : reset.stage === 'ready' ? t('money.reset.readyBody', { time: shipTime(reset.expiresAt) }) : t('money.reset.expiredBody')}</p>
        </Banner>
      )}
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save.run() }}>
        {v.pinSet && !ready && <Field label={t('money.pinCurrent')} type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={current} onChange={(e) => setCurrent(e.target.value)} />}
        <Field label={t('money.pinNew')} hint={t('money.pinHint')} type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={next} onChange={(e) => setNext(e.target.value)} />
        <AboardError error={save.error ?? forgot.error} />
        <div className="button-row">
          <Button type="submit" disabled={save.busy || next.length !== 4 || (v.pinSet && !ready && current.length !== 4)}>{v.pinSet ? t('money.pinChange') : t('money.pinSave')}</Button>
          {v.pinSet && !ready && reset?.stage !== 'waiting' && <Button variant="tertiary" disabled={forgot.busy} onClick={() => void forgot.run()}>{t('money.pinForgot')}</Button>}
        </div>
      </form>
      <p className="muted">{t('money.pinDesk')}</p>
    </section>
  )
}

export function Gratuities({ v, reload }: { v: MoneyView; reload: () => void }) {
  const g = v.gratuity
  const [reason, setReason] = useState('')
  const [asking, setAsking] = useState(false)
  const pay = useAction(async () => { await api.aboard.money.gratuity('prepaid'); reload() })
  const remove = useAction(async () => { await api.aboard.money.gratuity('removal', reason); setAsking(false); reload() })
  return (
    <section aria-labelledby="grat-h">
      <h2 id="grat-h">{t('money.grat')}</h2>
      <p className="muted">{t('money.gratPrivate')}</p>
      {g.due === 0 ? <p>{t('money.gratIncluded')}</p> : (
        <>
          <p>{t('money.gratBody', { amount: formatMoney(g.due) })}</p>
          {g.choice === 'prepaid' && <Banner kind="success" title={t('money.gratPaid')}><p>{t('money.gratPaidBody', { amount: formatMoney(g.due) })}</p></Banner>}
          {g.choice === 'removal' && <Banner kind="info" title={t('money.gratReview')}><p>{t('money.gratReviewBody')} “{g.reason}”</p></Banner>}
          <AboardError error={pay.error ?? remove.error} />
          {g.canChange && (
            <Card>
              <div className="button-row">
                <Button variant="secondary" disabled={pay.busy || !v.hasCard} onClick={() => void pay.run()}>{t('money.gratPay', { amount: formatMoney(g.due) })}</Button>
                <Button variant="tertiary" onClick={() => setAsking(!asking)} aria-expanded={asking}>{t('money.gratAsk')}</Button>
              </div>
              {!v.hasCard && <p className="muted">{t('money.gratNoCard')}</p>}
              {asking && (
                <form onSubmit={(e: FormEvent) => { e.preventDefault(); void remove.run() }}>
                  <p>{t('money.gratPolicy')}</p>
                  <TextArea label={t('money.gratReason')} hint={t('money.gratReasonHint', { count: GRATUITY_REASON_MIN })} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                  <Button type="submit" disabled={remove.busy || reason.trim().length < GRATUITY_REASON_MIN}>{t('money.gratSend')}</Button>
                </form>
              )}
            </Card>
          )}
          {!g.canChange && g.choice === 'standard' && <p className="muted">{t('money.gratClosed')}</p>}
        </>
      )}
    </section>
  )
}
