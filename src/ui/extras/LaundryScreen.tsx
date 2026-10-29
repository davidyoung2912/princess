import { useState } from 'react'
import type { LaundryRequest, LaundryView } from '../../api/types'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { LAUNDRY_NOTE_MAX, SERVICES, serviceById, type LaundryService } from '../../domain/laundry'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { ExtraError, NotAboard } from './common'

/** Laundry, pressing and dry cleaning (SHP-03): request a pick-up, follow it, cancel before it is collected. */
export function LaundryScreen() {
  const view = useMine(() => api.laundry.view(), [])
  return (
    <div className="page">
      <h1>{t('route.laundry')}</h1>
      <p>{t('lau.intro')}</p>
      <Load state={view}>{(v) => <Laundry v={v} reload={view.retry} />}</Load>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

function Laundry({ v, reload }: { v: LaundryView; reload: () => void }) {
  const shipTime = useShipTime()
  const [service, setService] = useState<LaundryService>('washFold')
  const [qty, setQty] = useState(1)
  const [pickup, setPickup] = useState('')
  const [note, setNote] = useState('')
  const svc = serviceById(service)!
  const send = useAction(async () => { await api.laundry.request({ service, qty, pickupAt: Number(pickup), note }); setPickup(''); setNote(''); reload() })
  const options = v.pickups[service]
  return (
    <>
      <NotAboard open={v.canRequest || v.requests.length > 0} />
      {v.freeBagLeft && <Banner kind="success" title={t('lau.freeBag')}><p>{t('lau.freeBagBody')}</p></Banner>}
      {v.canRequest && (
        <Card hero labelledBy="lau-new-h">
          <h2 id="lau-new-h" className="card__title">{t('lau.new')}</h2>
          <form onSubmit={(e) => { e.preventDefault(); void send.run() }}>
            <div className="field">
              <label htmlFor="lau-svc">{t('lau.service')}</label>
              <select id="lau-svc" className="field__input" value={service} onChange={(e) => { setService(e.target.value as LaundryService); setQty(1); setPickup('') }}>
                {SERVICES.map((s) => <option key={s.id} value={s.id}>{t(`lau.svc.${s.id}` as StringKey)}, {formatMoney(s.cents)} {t(`lau.per.${s.unit}` as StringKey)}</option>)}
              </select>
              <p className="field__hint">{t('lau.turnaround', { hours: svc.hours })}</p>
            </div>
            <div className="field">
              <label htmlFor="lau-qty">{t(`lau.qty.${svc.unit}` as StringKey)}</label>
              <select id="lau-qty" className="field__input" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                {Array.from({ length: svc.maxQty }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="lau-pick">{t('lau.pickup')}</label>
              <select id="lau-pick" className="field__input" value={pickup} onChange={(e) => setPickup(e.target.value)}>
                <option value="">{t('lau.choosePickup')}</option>
                {options.map((o) => <option key={o.at} value={o.at}>{t('plan.day', { n: o.day })} · {formatDate(o.date)} · {shipTime(o.at)}</option>)}
              </select>
              {options.length === 0 && <p className="muted">{t('lau.noPickup')}</p>}
            </div>
            <div className="field">
              <label htmlFor="lau-note">{t('lau.note')}</label>
              <input id="lau-note" className="field__input" value={note} maxLength={LAUNDRY_NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
            </div>
            <ExtraError error={send.error} />
            <Button type="submit" disabled={send.busy || !pickup}>{send.busy ? t('account.saving') : t('lau.send')}</Button>
            {!pickup && <p className="muted">{t('lau.pick')}</p>}
          </form>
        </Card>
      )}
      <section aria-labelledby="lau-mine-h">
        <h2 id="lau-mine-h">{t('lau.mine')}</h2>
        {v.requests.length === 0 ? <p className="muted">{t('lau.none')}</p> : <ul className="order-list">{v.requests.map((r) => <Request key={r.id} r={r} reload={reload} />)}</ul>}
      </section>
    </>
  )
}

function Request({ r, reload }: { r: LaundryRequest; reload: () => void }) {
  const shipTime = useShipTime()
  const cancel = useAction(async () => { await api.laundry.cancel(r.id); reload() })
  return (
    <li className="order">
      <h3 className="order__title">{r.qty} × {t(`lau.svc.${r.service}` as StringKey)}</h3>
      <p role="status"><strong>{t(`lau.stage.${r.stage}` as StringKey)}</strong></p>
      <p>{t('lau.pickupAt', { time: shipTime(r.pickupAt) })} · {t('lau.returnBy', { time: shipTime(r.returnAt) })}</p>
      <p>{r.total === 0 ? t('x.free') : formatMoney(r.total)}{r.free > 0 && <> · {t('lau.freeApplied', { amount: formatMoney(r.free) })}</>}</p>
      {r.note && <p className="muted">{r.note}</p>}
      <ExtraError error={cancel.error} />
      {r.stage === 'requested' && <Button variant="tertiary" disabled={cancel.busy} onClick={() => void cancel.run()}>{t('lau.cancel')}</Button>}
    </li>
  )
}
