import { useState } from 'react'
import type { LoyaltyView } from '../../api/finishTypes'
import { TIER_DAYS } from '../../domain/postcruise'
import { formatMoney } from '../../domain/pricing'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { BackLink } from '../onboard/common'

/** Captain's Circle and rewards (POS-05, POS-08): level and progress after this cruise, what the level gives, and a referral code to share. */
export function LoyaltyScreen() {
  const view = useMine(() => api.post.loyalty(), [])
  return (
    <div className="page">
      <h1>{t('route.loyalty')}</h1>
      <p>{t('loy.intro')}</p>
      <Load state={view}>{(v) => <Loyalty v={v} />}</Load>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}

function Loyalty({ v }: { v: LoyaltyView }) {
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
      {s.promoted && <Banner kind="success" title={t('loy.promoted', { tier: t(`me.tier.${s.after}` as StringKey) })}><p>{t('loy.promotedBody')}</p></Banner>}
      <Card hero labelledBy="loy-level-h">
        <h2 id="loy-level-h" className="card__title">{t('loy.level')}</h2>
        <p className="dis__group">{s.after === 'none' ? t('me.noTier') : t('me.tier', { tier: t(`me.tier.${s.after}` as StringKey) })}</p>
        <p>{t('loy.days', { before: s.daysBefore, after: s.daysAfter })}</p>
        {!v.counted && <p className="muted">{t('loy.afterSail')}</p>}
        {s.next ? (
          <>
            <label htmlFor="loy-progress">{t('loy.toward', { tier: t(`me.tier.${s.next}` as StringKey), days: s.daysToNext ?? 0 })}</label>
            <progress id="loy-progress" className="fin-progress" max={target} value={Math.min(s.daysAfter, target)} />
          </>
        ) : <p>{t('loy.top')}</p>}
      </Card>

      <Card labelledBy="loy-perks-h">
        <h2 id="loy-perks-h" className="card__title">{t('loy.perks')}</h2>
        {v.perks.length === 0 && v.wifiDevices === 0 ? <p>{t('loy.noPerks')}</p> : (
          <ul className="plain-bullets">
            {v.wifiDevices > 0 && <li>{t('loy.wifi', { count: v.wifiDevices })}</li>}
            {v.perks.map((p) => <li key={p}>{t(`loy.perk.${p}` as StringKey)}</li>)}
          </ul>
        )}
        <p className="muted">{t('loy.expiry')}</p>
      </Card>

      <Card labelledBy="loy-ref-h">
        <h2 id="loy-ref-h" className="card__title">{t('loy.referral')}</h2>
        <p>{t('loy.referralBody', { amount: formatMoney(v.referral.credit) })}</p>
        <p className="dis__group">{v.referral.code}</p>
        <Button variant="secondary" onClick={() => void share()}>{t('loy.share')}</Button>
        {note && <p role="status">{note}</p>}
        <p>{t('loy.earned', { amount: formatMoney(v.referral.earned) })}</p>
        {v.referral.friends.length > 0 && <ul className="plain-list">{v.referral.friends.map((f) => <li key={f.name}><span>{f.name}</span><span>{t(`loy.friend.${f.state}` as StringKey)}</span></li>)}</ul>}
        <p className="muted">{t('loy.terms')}</p>
      </Card>
    </>
  )
}
