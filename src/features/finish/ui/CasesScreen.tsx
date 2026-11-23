import { useState } from 'react'
import type { CaseView, CasesView } from '../../../shared/api/finishTypes'
import { answerDays, CASE_OWNER, caseSteps, CASE_PLACE_MAX, CASE_TEXT_MAX, CLAIM_MAX, type CaseKind } from '../../../domain/postcruise'
import { formatMoney } from '../../../domain/money'
import { api } from '../../../app/runtime'
import { useAction } from '../../../shared/hooks/useAction'
import { useMine } from '../../../shared/hooks/useMine'
import { t, th, type StringKey, headingCase } from '../../../shared/i18n'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { Stepper } from '../../../shared/ui/Stepper'
import { Field } from '../../../shared/ui/Field'
import { Load } from '../../account/ui/parts'
import { ExtraError } from '../../extras/ui/common'
import { BackLink } from '../../onboard/ui/common'
import { formatDateTime } from '../../account/ui/format'
import { useMyMedia } from '../../../shared/hooks/useMedia'
import { KeptPicture, PicturePicker } from '../../media/ui/Pictures'
import { Human } from './common'
import { HandoffCases } from '../../stanley/ui/HandoffCases'

const NEW_KINDS: readonly CaseKind[] = ['lostItem', 'claim', 'complaint']

/** Lost items, claims and complaints (DEB-06, POS-07): one place to report, with a case number, a due date and what happened. */
export function CasesScreen() {
  const view = useMine(() => api.cases.list(), [])
  return (
    <div className="page">
      <p>{t('case.intro')}</p>
      <Load state={view}>{(v) => <Cases v={v} reload={view.retry} />}</Load>
      <HandoffCases />
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
          <h2 id="case-new-h" className="card__title">{th('case.new')}</h2>
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
            <p className="muted">{t('case.owner', { team: t(`case.team.${CASE_OWNER[kind as 'lostItem' | 'claim' | 'complaint']}` as StringKey), days: answerDays(kind) })}</p>
            <p className="muted">{t('case.noReversal')}</p>
            <Button type="submit" disabled={open.busy || bad}>{open.busy ? t('account.saving') : t('case.send')}</Button>
          </form>
        </Card>
      )}
      <section aria-labelledby="case-mine-h">
        <h2 id="case-mine-h">{th('case.mine')}</h2>
        {v.cases.length === 0 ? <p className="muted">{t('case.none')}</p> : <ul className="case-list">{v.cases.map((c) => <Case key={c.id} c={c} reload={reload} />)}</ul>}
      </section>
    </>
  )
}

function Case({ c, reload }: { c: CaseView; reload: () => void }) {
  const withdraw = useAction(async () => { await api.cases.withdraw(c.id); reload() })
  return (
    <li className="case">
      <h3 className="case__title">{th(`case.kind.${c.kind}` as StringKey)} · {c.number}</h3>
      {(c.kind === 'lostItem' || c.kind === 'claim' || c.kind === 'complaint') && <p className="muted">{t('case.ownedBy', { team: t(`case.team.${CASE_OWNER[c.kind]}` as StringKey) })}</p>}
      <p role="status"><strong>{t(`case.stage.${c.stage}` as StringKey)}</strong>{c.stage !== 'resolved' && c.stage !== 'withdrawn' && <> · {t('case.due', { time: formatDateTime(c.dueAt) })}</>}</p>
      <Stepper label={t('case.track')} steps={caseSteps(c.stage).map((x) => ({ id: x.id, state: x.state, label: t(`case.step.${x.id}` as StringKey) }))} />
      <p>{c.summary}</p>
      {c.place && <p className="muted">{t('case.lastSeen', { place: c.place })}</p>}
      {c.cents > 0 && <p className="muted">{t('case.amountAsked', { amount: formatMoney(c.cents) })}</p>}
      {c.outcome && <p><strong>{t(`case.outcome.${c.outcome}` as StringKey)}</strong></p>}
      {c.refund && <p>{c.refund.sent ? t('case.refundSent', { amount: formatMoney(c.refund.cents) }) : t('case.refundPending', { amount: formatMoney(c.refund.cents), time: formatDateTime(c.refund.expectedBy) })}</p>}
      {(c.kind === 'lostItem' || c.kind === 'claim') && c.stage !== 'withdrawn' && <CasePictures number={c.number} kind={c.kind} />}
      <ExtraError error={withdraw.error} />
      {c.canWithdraw && <Button variant="tertiary" disabled={withdraw.busy} onClick={() => void withdraw.run()}>{t('case.withdraw')}</Button>}
    </li>
  )
}

/** Photos kept with a case: a lost item, or the receipt for a claim. They are the guest's own and are only shown to them. */
function CasePictures({ number, kind }: { number: string; kind: CaseKind }) {
  const mine = useMyMedia('case')
  const here = mine.list.filter((m) => m.ref === number)
  return (
    <div className="case__pictures">
      <h4>{headingCase(t(`case.pictures.${kind === 'claim' ? 'claim' : 'lostItem'}` as StringKey))}</h4>
      {here.map((m) => <KeptPicture key={m.id} media={m} alt={t('case.pictures.alt', { number })} onDeleted={mine.reload} />)}
      <PicturePicker purpose="case" reference={number} ready camera onSaved={mine.reload} />
    </div>
  )
}
