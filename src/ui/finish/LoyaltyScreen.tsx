import { useState } from 'react'
import { StanleyLoyaltyCoach } from '../ai/StanleyMoney'
import type { LoyaltyReportKind, LoyaltyView } from '../../api/finishTypes'
import { TIER_DAYS } from '../../domain/postcruise'
import { formatMoney } from '../../domain/money'
import { formatDate } from '../../domain/cruise'
import { walletTotals } from '../../domain/wallet'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { LifetimeLine } from '../delights/RememberDelights'
import { Load } from '../account/parts'
import { formatDateTime } from '../account/format'
import { ExtraError } from '../extras/common'
import { BackLink } from '../onboard/common'

/** Captain's Circle and rewards (POS-05, POS-08): level and progress after this cruise, what the level gives, and a referral code to share. */
export function LoyaltyScreen() {
  const view = useMine(() => api.post.loyalty(), [])
  return (
    <div className="page">
      <p>{t('loy.intro')}</p>
      <Load state={view}>{(v) => <Loyalty v={v} reload={view.retry} />}</Load>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}

function Loyalty({ v, reload }: { v: LoyaltyView; reload: () => void }) {
  const s = v.status
  const [note, setNote] = useState('')
  const share = async () => {
    const text = t('loy.shareText', { code: v.referral.code, amount: formatMoney(v.referral.credit) })
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: t('route.loyalty'), text })
      else { await navigator.clipboard.writeText(text); setNote(t('loy.copied')) }
    } catch { setNote(text) }
  }
  const target = s.next ? TIER_DAYS[s.next] : s.daysAfter
  return (
    <>
      <StanleyLoyaltyCoach />
      {s.promoted && <Banner kind="success" title={t('loy.promoted', { tier: t(`me.tier.${s.after}` as StringKey) })}><p>{t('loy.promotedBody')}</p></Banner>}
      <Card hero labelledBy="loy-level-h">
        <h2 id="loy-level-h" className="card__title">{th('loy.level')}</h2>
        <p className="dis__group">{s.after === 'none' ? t('me.noTier') : t('me.tier', { tier: t(`me.tier.${s.after}` as StringKey) })}</p>
        <p>{t('loy.days', { before: s.daysBefore, after: s.daysAfter })}</p>
        <LifetimeLine />
        {!v.counted && <p className="muted">{t('loy.afterSail')}</p>}
        {s.next ? (
          <>
            <label htmlFor="loy-progress">{t('loy.toward', { tier: t(`me.tier.${s.next}` as StringKey), days: s.daysToNext ?? 0 })}</label>
            <progress id="loy-progress" className="fin-progress" max={target} value={Math.min(s.daysAfter, target)} />
          </>
        ) : <p>{t('loy.top')}</p>}
      </Card>

      <Card labelledBy="loy-perks-h">
        <h2 id="loy-perks-h" className="card__title">{th('loy.perks')}</h2>
        {v.perks.length === 0 && v.wifiDevices === 0 ? <p>{t('loy.noPerks')}</p> : (
          <ul className="plain-bullets">
            {v.wifiDevices > 0 && <li>{t('loy.wifi', { count: v.wifiDevices })}</li>}
            {v.perks.map((p) => <li key={p}>{t(`loy.perk.${p}` as StringKey)}</li>)}
          </ul>
        )}
        <p className="muted">{t('loy.expiry')}</p>
      </Card>

      <Wallet v={v} />
      <Report v={v} reload={reload} />

      <Card labelledBy="loy-ref-h">
        <h2 id="loy-ref-h" className="card__title">{th('loy.referral')}</h2>
        <p>{t('loy.referralBody', { amount: formatMoney(v.referral.credit) })}</p>
        <p className="dis__group">{v.referral.code}</p>
        <Button variant="secondary" onClick={() => void share()}>{t('loy.share')}</Button>
        {note && <p role="status">{note}</p>}
        <p>{t('loy.incentive', { amount: formatMoney(v.referral.credit) })}</p>
        <p>{t('loy.earned', { amount: formatMoney(v.referral.earned) })}</p>
        <Friends v={v} reload={reload} />
        <p className="muted">{t('loy.terms')}</p>
      </Card>
      <p className="muted">{t('loy.synced', { time: formatDateTime(v.syncedAt) })}</p>
    </>
  )
}

/** Invited friends by first name only (REM-14); an invitation can be taken back until the friend has booked. */
function Friends({ v, reload }: { v: LoyaltyView; reload: () => void }) {
  const [name, setName] = useState('')
  const add = useAction(async () => { await api.post.invite(name.trim()); setName(''); reload() })
  const revoke = useAction(async (id: string) => { await api.post.revokeInvite(id); reload() })
  return (
    <>
      {v.referral.friends.length > 0 && (
        <ul className="plain-list">
          {v.referral.friends.map((f) => (
            <li key={f.id}>
              <span>{f.name}</span>
              <span>{t(`loy.friend.${f.state}` as StringKey)}</span>
              {f.state === 'invited' && <Button variant="tertiary" disabled={revoke.busy} onClick={() => void revoke.run(f.id)}>{t('loy.invite.revoke')}<span className="visually-hidden"> {f.name}</span></Button>}
            </li>
          ))}
        </ul>
      )}
      <ExtraError error={add.error ?? revoke.error} />
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) void add.run() }}>
        <div className="field">
          <label htmlFor="loy-friend">{t('loy.invite.name')}</label>
          <input id="loy-friend" className="field__input" maxLength={40} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" disabled={add.busy || !name.trim()}>{add.busy ? t('account.saving') : t('loy.invite.add')}</Button>
      </form>
      <p className="muted">{t('loy.invite.privacy')}</p>
    </>
  )
}

/** Credits with their source, expiry and eligibility, and what has been used (REM-10). */
function Wallet({ v }: { v: LoyaltyView }) {
  const totals = walletTotals(v.credits, v.used)
  return (
    <Card labelledBy="loy-wallet-h">
      <h2 id="loy-wallet-h" className="card__title">{th('loy.walletH')}</h2>
      {v.credits.length === 0 ? <p>{t('loy.walletNone')}</p> : (
        <>
          <p>{t('loy.wallet.usable', { amount: formatMoney(totals.usable), currency: v.currency })}</p>
          {totals.lapsed > 0 && <p className="muted">{t('loy.wallet.lapsed', { amount: formatMoney(totals.lapsed) })}</p>}
          <ul className="order-list">
            {v.credits.map((c) => (
              <li key={c.id} className="order">
                <p><strong>{t('loy.credit.left', { left: formatMoney(c.remaining), original: formatMoney(c.original) })}</strong></p>
                <p>{t('loy.credit.source', { source: c.source })}</p>
                <p>{c.expired ? t('loy.credit.expired', { date: formatDate(c.expiresOn) }) : t('loy.credit.expires', { date: formatDate(c.expiresOn) })}</p>
                <p className="muted">{t(`loy.credit.eligible.${c.eligible}` as StringKey)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>{t('loy.history')}</h3>
      {v.used.length === 0 ? <p>{t('loy.historyNone')}</p> : <ul className="plain-list">{v.used.map((u) => <li key={`${u.at}-${u.what}`}><span>{u.what} · {formatDateTime(u.at)}</span><span>{formatMoney(u.amount)}</span></li>)}</ul>}
      <p className={totals.reconciles ? 'muted' : undefined} role={totals.reconciles ? undefined : 'status'}>
        {totals.reconciles ? t('loy.reconciles') : t('loy.noReconcile', { spent: formatMoney(totals.spent), used: formatMoney(totals.redeemed) })}
      </p>
    </Card>
  )
}

const KINDS: readonly LoyaltyReportKind[] = ['tier', 'days', 'credit', 'other']

/** Tell us what looks wrong (REM-07): kept for a person to answer; the figures above do not change. */
function Report({ v, reload }: { v: LoyaltyView; reload: () => void }) {
  const [what, setWhat] = useState<LoyaltyReportKind>('days')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const send = useAction(async () => { await api.post.reportLoyalty(what, note.trim()); setNote(''); setSent(true); reload() })
  return (
    <Card labelledBy="loy-report-h">
      <h2 id="loy-report-h" className="card__title">{th('loy.reportH')}</h2>
      <p>{t('loy.reportBody')}</p>
      <form onSubmit={(e) => { e.preventDefault(); setSent(false); void send.run() }}>
        <div className="field">
          <label htmlFor="loy-what">{t('loy.report.what')}</label>
          <select id="loy-what" className="field__input" value={what} onChange={(e) => setWhat(e.target.value as LoyaltyReportKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{t(`loy.report.${k}` as StringKey)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="loy-note">{t('loy.report.note')}</label>
          <textarea id="loy-note" className="field__input" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ExtraError error={send.error} />
        <Button type="submit" variant="secondary" disabled={send.busy}>{send.busy ? t('account.saving') : t('loy.report.send')}</Button>
        {sent && !send.error && <p role="status">{t('loy.report.sent')}</p>}
      </form>
      {v.reports.length > 0 && (
        <>
          <h3>{t('loy.reports')}</h3>
          <ul className="plain-list">{v.reports.map((r) => <li key={r.id}><span>{t(`loy.report.${r.what}` as StringKey)} · {formatDateTime(r.at)}</span><span>{t(`loy.report.${r.status}` as StringKey)}</span></li>)}</ul>
        </>
      )}
    </Card>
  )
}
