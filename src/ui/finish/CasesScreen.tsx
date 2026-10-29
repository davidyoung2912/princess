import { useState } from 'react'
import type { CaseView, CasesView } from '../../api/finishTypes'
import { CASE_PLACE_MAX, CASE_TEXT_MAX, CLAIM_MAX, type CaseKind } from '../../domain/postcruise'
import { formatMoney } from '../../domain/pricing'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Load } from '../account/parts'
import { ExtraError } from '../extras/common'
import { BackLink } from '../onboard/common'
import { formatDateTime } from '../account/format'
import { Human } from './common'

const NEW_KINDS: readonly CaseKind[] = ['lostItem', 'claim', 'complaint']

/** Lost items, claims and complaints (DEB-06, POS-07): one place to report, with a case number, a due date and what happened. */
export function CasesScreen() {
  const view = useMine(() => api.cases.list(), [])
  return (
    <div className="page">
      <h1>{t('route.cases')}</h1>
      <p>{t('case.intro')}</p>
      <Load state={view}>{(v) => <Cases v={v} reload={view.retry} />}</Load>
      <Human />
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}

function Cases({ v, reload }: { v: CasesView; reload: () => void }) {
  const [kind, setKind] = useState<CaseKind>('lostItem')
  const [summary, setSummary] = useState('')
  const [place, setPlace] = useState('')
  const [amount, setAmount] = useState('')
  const dollars = Number(amount)
  const cents = Math.round(dollars * 100)
  const open = useAction(async () => {
    await api.cases.open({ kind, summary, place, lineId: '', cents: kind === 'claim' ? cents : 0 })
    setSummary(''); setPlace(''); setAmount(''); reload()
  })
  const needsAmount = kind === 'claim'
  const amountBad = needsAmount && (!(dollars > 0) || cents > CLAIM_MAX)
  const bad = summary.trim().length < 5 || (kind === 'lostItem' && place.trim().length === 0) || amountBad
  return (
    <>
      {!v.canOpen && <Banner kind="info" title={t('case.closed')}><p>{t('case.closedBody')}</p></Banner>}
      {v.canOpen && (
        <Card hero labelledBy="case-new-h">
          <h2 id="case-new-h" className="card__title">{t('case.new')}</h2>
          <form onSubmit={(e) => { e.preventDefault(); if (!bad) void open.run() }}>
            <div className="field">
              <label htmlFor="case-kind">{t('case.kind')}</label>
              <select id="case-kind" className="field__input" value={kind} onChange={(e) => setKind(e.target.value as CaseKind)}>
                {NEW_KINDS.map((k) => <option key={k} value={k}>{t(`case.kind.${k}` as StringKey)}</option>)}
              </select>
              <p className="field__hint">{t(`case.kindHint.${kind}` as StringKey)}</p>
            </div>
            <div className="field">
              <label htmlFor="case-summary">{t(`case.summary.${kind}` as StringKey)}</label>
              <textarea id="case-summary" className="field__input" rows={4} maxLength={CASE_TEXT_MAX} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            {kind === 'lostItem' && <Field label={t('case.place')} maxLength={CASE_PLACE_MAX} value={place} onChange={(e) => setPlace(e.target.value)} />}
            {needsAmount && <Field label={t('case.amount')} hint={t('case.amountHint')} type="number" inputMode="decimal" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} error={amountBad && amount !== '' ? t('case.amountBad') : undefined} />}
            <ExtraError error={open.error} />
            <Button type="submit" disabled={open.busy || bad}>{open.busy ? t('account.saving') : t('case.send')}</Button>
          </form>
        </Card>
      )}
      <section aria-labelledby="case-mine-h">
        <h2 id="case-mine-h">{t('case.mine')}</h2>
        {v.cases.length === 0 ? <p className="muted">{t('case.none')}</p> : <ul className="case-list">{v.cases.map((c) => <Case key={c.id} c={c} reload={reload} />)}</ul>}
      </section>
    </>
  )
}

function Case({ c, reload }: { c: CaseView; reload: () => void }) {
  const withdraw = useAction(async () => { await api.cases.withdraw(c.id); reload() })
  return (
    <li className="case">
      <h3 className="case__title">{t(`case.kind.${c.kind}` as StringKey)} · {c.number}</h3>
      <p role="status"><strong>{t(`case.stage.${c.stage}` as StringKey)}</strong>{c.stage !== 'resolved' && c.stage !== 'withdrawn' && <> · {t('case.due', { time: formatDateTime(c.dueAt) })}</>}</p>
      <p>{c.summary}</p>
      {c.place && <p className="muted">{t('case.lastSeen', { place: c.place })}</p>}
      {c.cents > 0 && <p className="muted">{t('case.amountAsked', { amount: formatMoney(c.cents) })}</p>}
      {c.outcome && <p><strong>{t(`case.outcome.${c.outcome}` as StringKey)}</strong></p>}
      {c.refund && <p>{c.refund.sent ? t('case.refundSent', { amount: formatMoney(c.refund.cents) }) : t('case.refundPending', { amount: formatMoney(c.refund.cents), time: formatDateTime(c.refund.expectedBy) })}</p>}
      <ExtraError error={withdraw.error} />
      {c.canWithdraw && <Button variant="tertiary" disabled={withdraw.busy} onClick={() => void withdraw.run()}>{t('case.withdraw')}</Button>}
    </li>
  )
}
