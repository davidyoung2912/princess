import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeAutoActs, normalizeAutoStanding, type AutoActs, type AutoStanding } from '../../ai/stanleyAuto'
import { t, th, type StringKey } from '../../i18n'
import { stanleyAuto } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'

type Which = 'dinners' | 'timings' | 'orders'

/**
 * Rung 4 classes that touch a booking or the crew (phase P10c): free reservations I always want (AUT-04), keep my timings (AUT-08) and my standing order (AUT-09). Each runs only when the guest taps its button, and the server
 * does something only if the guest has switched that class on. Every word of what was done comes from the server; the guest's usual dinner time and standing order are chosen here.
 */
export function StanleyAutoBookingCard() {
  const [choice, setChoice] = useState<AutoStanding | null>(null)
  const [result, setResult] = useState<{ which: Which; acts: AutoActs } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    stanleyAuto.standing().then((raw) => { if (live.current) setChoice(normalizeAutoStanding(raw)) }, () => undefined)
    return () => { live.current = false }
  }, [])

  const run = (which: Which) => {
    live.current = true
    setBusy(true)
    setSaved(false)
    stanleyAuto[which]().then(
      (raw) => { if (live.current) { const acts = normalizeAutoActs(raw); setResult(acts ? { which, acts } : null); setFailed(acts ? null : 'error'); setBusy(false) } },
      () => { if (live.current) { setFailed('error'); setBusy(false) } },
    )
  }

  const save = (next: { usualDinner: string; orderItem: string; orderTime: string }) => {
    live.current = true
    setBusy(true)
    setSaved(false)
    stanleyAuto.setStanding(next).then(
      (raw) => { if (live.current) { const c = normalizeAutoStanding(raw); if (c) setChoice(c); setFailed(c ? null : 'error'); setSaved(c !== null); setBusy(false) } },
      () => { if (live.current) { setFailed('standingError'); setBusy(false) } },
    )
  }

  const cur = choice ?? { usualDinner: '', orderItem: '', orderTime: '', dinnerTimes: [], orderItems: [], notChecked: [] }
  const mine = { usualDinner: cur.usualDinner, orderItem: cur.orderItem, orderTime: cur.orderTime }
  const notChecked = result?.acts.notChecked ?? cur.notChecked

  return (
    <Card labelledBy="autobook-h">
      <h2 id="autobook-h" className="card__title">{th('stanleyAutoBook.title')}</h2>
      <p>{t('stanleyAutoBook.intro')}</p>

      <div className="field">
        <label htmlFor="autobook-usual">{t('stanleyAutoBook.usual')}</label>
        <select id="autobook-usual" className="field__input" value={cur.usualDinner} disabled={busy || choice === null} onChange={(e) => save({ ...mine, usualDinner: e.target.value })}>
          <option value="">{t('stanleyAutoBook.none')}</option>
          {cur.dinnerTimes.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="autobook-item">{t('stanleyAutoBook.item')}</label>
        <select id="autobook-item" className="field__input" value={cur.orderItem} disabled={busy || choice === null} onChange={(e) => save({ ...mine, orderItem: e.target.value, orderTime: e.target.value ? cur.orderTime || '19:00' : '' })}>
          <option value="">{t('stanleyAutoBook.none')}</option>
          {cur.orderItems.map((x) => <option key={x} value={x}>{t(`stanleyAutoBook.item.${x}` as StringKey)}</option>)}
        </select>
        {cur.orderItems.length === 0 && <p className="field__hint">{t('stanleyAutoBook.itemHint')}</p>}
      </div>
      {cur.orderItem && (
        <div className="field">
          <label htmlFor="autobook-time">{t('stanleyAutoBook.time')}</label>
          <input id="autobook-time" type="time" className="field__input" value={cur.orderTime} disabled={busy} onChange={(e) => { if (/^\d\d:\d\d$/.test(e.target.value)) save({ ...mine, orderTime: e.target.value }) }} />
        </div>
      )}

      <div className="button-row">
        <Button onClick={() => run('dinners')} disabled={busy}>{t('stanleyAutoBook.dinners')}</Button>{' '}
        <Button variant="secondary" onClick={() => run('timings')} disabled={busy}>{t('stanleyAutoBook.timings')}</Button>{' '}
        <Button variant="secondary" onClick={() => run('orders')} disabled={busy}>{t('stanleyAutoBook.orders')}</Button>
      </div>
      <div aria-live="polite">
        {busy && <p role="status">{t('stanleyAuto.working')}</p>}
        {saved && <p role="status">{t('stanleyAutoBook.saved')}</p>}
        {failed && <p role="alert" className="field__error">{t(failed === 'standingError' ? 'stanleyAutoBook.standingError' : 'stanleyAuto.error')}</p>}
        {result && !result.acts.on && <p>{t(`stanleyAutoBook.off.${result.which}` as StringKey)}</p>}
        {result?.acts.on && result.acts.made.length === 0 && result.acts.waiting.length === 0 && <p role="status">{t('stanleyAutoBook.none.done')}</p>}
      </div>
      {result?.acts.on && result.acts.made.length > 0 && (
        <section aria-labelledby="autobook-made">
          <h3 id="autobook-made">{th('stanleyAutoBook.made')}</h3>
          <ul>{result.acts.made.map((m) => <li key={m.key}>{m.text} ({m.receipt})</li>)}</ul>
          <p><Link to="/me/stanley-activity">{t('stanleyAuto.undo')}</Link></p>
        </section>
      )}
      {result?.acts.on && result.acts.waiting.length > 0 && (
        <section aria-labelledby="autobook-wait">
          <h3 id="autobook-wait">{th('stanleyAuto.waiting')}</h3>
          <ul>{result.acts.waiting.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      )}
      {notChecked.length > 0 && (
        <section aria-labelledby="autobook-not">
          <h3 id="autobook-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
    </Card>
  )
}
