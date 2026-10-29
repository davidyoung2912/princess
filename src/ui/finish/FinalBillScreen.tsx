import { useState } from 'react'
import { Link } from 'react-router'
import { asFolioView } from '../../api/guards'
import type { FinalBillView } from '../../api/finishTypes'
import type { FolioView } from '../../api/types'
import { TIP_KEEP, tipCredit } from '../../domain/disembark'
import { CASE_TEXT_MAX } from '../../domain/postcruise'
import { folioTotals } from '../../domain/folio'
import { formatMoney } from '../../domain/pricing'
import { personaById } from '../../domain/personas'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Load, SupervisedNote } from '../account/parts'
import { ExtraError } from '../extras/common'
import { BackLink, Saved } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { Human } from './common'

/** The final bill and receipts (DEB-03): what is owed and to which card, the gratuity deadline, a way to query a charge, and receipts to print or email. */
export function FinalBillScreen() {
  const me = usePersona()
  const folio = useSavedCopy('folio', me?.booker ?? 'none', () => api.onboard.folio(), asFolioView, [me?.id])
  const bill = useMine(() => api.disembark.finalBill(), [])
  return (
    <div className="page">
      <h1>{t('route.finalBill')}</h1>
      <p>{t('fb.intro')}</p>
      {me?.child ? <SupervisedNote booker={personaById(me.booker)?.firstName ?? ''} /> : (
        <Saved copy={folio}>{(f) => <Load state={bill}>{(b) => <FinalBill f={f} b={b} reload={() => { bill.retry(); folio.retry() }} />}</Load>}</Saved>
      )}
      <BackLink to="/me/bill" label={t('route.bill')} />
    </div>
  )
}

function FinalBill({ f, b, reload }: { f: FolioView; b: FinalBillView; reload: () => void }) {
  const shipTime = useShipTime()
  const total = folioTotals(f.lines)
  const [keep, setKeep] = useState(b.tip.keepPercent)
  const adjust = useAction(async () => { await api.disembark.adjustTip(keep); reload() })
  const email = useAction(async () => { await api.disembark.emailReceipt(); reload() })
  const charges = f.lines.filter((l) => l.cents > 0)
  const [line, setLine] = useState('')
  const [why, setWhy] = useState('')
  const picked = charges.find((l) => l.id === line)
  const query = useAction(async () => {
    if (!picked) return
    await api.cases.open({ kind: 'billing', summary: why, place: '', lineId: picked.id, cents: picked.cents })
    setLine(''); setWhy(''); reload()
  })
  return (
    <>
      <Card hero labelledBy="fb-owe-h">
        <h2 id="fb-owe-h" className="card__title">{t('fb.owe')}</h2>
        <p className="bill__big">{total.balance < 0 ? t('bill.credit', { amount: formatMoney(-total.balance) }) : formatMoney(total.balance)}</p>
        {b.card ? <p>{t('fb.charged', { card: b.card })}</p> : <Banner kind="warning" title={t('fb.noCard')} action={<Link to="/me/payments">{t('route.payments')}</Link>}><p>{t('fb.noCardBody')}</p></Banner>}
        <p className="muted">{b.settled ? t('fb.settled') : t('fb.notSettled')}</p>
      </Card>

      {b.tip.charged > 0 && (
        <Card labelledBy="fb-tip-h">
          <h2 id="fb-tip-h" className="card__title">{t('fb.tip')}</h2>
          <p>{t('fb.tipBody', { amount: formatMoney(b.tip.charged), time: shipTime(b.tip.by) })}</p>
          <form onSubmit={(e) => { e.preventDefault(); void adjust.run() }}>
            <fieldset disabled={!b.tip.canAdjust}>
              <legend>{t('fb.tipKeep')}</legend>
              {TIP_KEEP.map((k) => (
                <label key={k} className="choice">
                  <input type="radio" name="tip-keep" checked={keep === k} onChange={() => setKeep(k)} />
                  <span>{t(k === 100 ? 'fb.keepAll' : k === 0 ? 'fb.keepNone' : 'fb.keepSome', { percent: k })}<small>{k === 100 ? t('fb.noChange') : t('fb.credit', { amount: formatMoney(tipCredit(b.tip.charged, k)) })}</small></span>
                </label>
              ))}
            </fieldset>
            <ExtraError error={adjust.error} />
            {b.tip.canAdjust ? <Button type="submit" disabled={adjust.busy || keep === b.tip.keepPercent}>{adjust.busy ? t('account.saving') : t('fb.tipSave')}</Button> : <p className="muted">{t('fb.tipClosed')}</p>}
          </form>
        </Card>
      )}

      <section aria-labelledby="fb-query-h">
        <h2 id="fb-query-h">{t('fb.query')}</h2>
        <p>{t('fb.queryBody')}</p>
        {b.queries.length > 0 && (
          <ul className="plain-list">{b.queries.map((q) => <li key={q.id}><span>{f.lines.find((l) => l.id === q.lineId)?.description ?? q.lineId} · {formatMoney(q.cents)}</span><span>{q.number} · {t(`case.stage.${q.stage}` as StringKey)}</span></li>)}</ul>
        )}
        <form onSubmit={(e) => { e.preventDefault(); void query.run() }}>
          <div className="field">
            <label htmlFor="fb-line">{t('fb.whichCharge')}</label>
            <select id="fb-line" className="field__input" value={line} onChange={(e) => setLine(e.target.value)}>
              <option value="">{t('fb.chooseCharge')}</option>
              {charges.map((l) => <option key={l.id} value={l.id}>{l.description} · {formatMoney(l.cents)}</option>)}
            </select>
          </div>
          <Field label={t('fb.why')} maxLength={CASE_TEXT_MAX} value={why} onChange={(e) => setWhy(e.target.value)} />
          <ExtraError error={query.error} />
          <Button type="submit" variant="secondary" disabled={query.busy || !picked || why.trim().length < 5}>{query.busy ? t('account.saving') : t('fb.send')}</Button>
        </form>
        <Human />
      </section>

      <section aria-labelledby="fb-rec-h">
        <h2 id="fb-rec-h">{t('fb.receipts')}</h2>
        <ul className="plain-list">{b.receipts.map((r) => <li key={r.id}><span>{t(`fb.receipt.${r.id}` as StringKey)}</span><span className="muted">{r.available ? t('fb.ready') : t('fb.later')}</span></li>)}</ul>
        <div className="button-row">
          <Button variant="secondary" onClick={() => window.print()}>{t('fb.print')}</Button>
          <Button variant="secondary" disabled={email.busy} onClick={() => void email.run()}>{email.busy ? t('account.saving') : t('fb.email')}</Button>
        </div>
        <ExtraError error={email.error} />
        {b.emailedAt !== null && b.emailedTo && <p role="status">{t('fb.emailed', { time: shipTime(b.emailedAt), to: b.emailedTo })}</p>}
      </section>
    </>
  )
}
