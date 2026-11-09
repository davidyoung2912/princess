import { useState } from 'react'
import { Link } from 'react-router'
import type { WifiDeviceView, WifiView } from '../../api/types'
import { formatMoney } from '../../domain/money'
import { MAX_DAYS, PLANS, planById, type WifiPlan } from '../../domain/wifi'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Load } from '../account/parts'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { ExtraError, NotAboard } from './common'
import { useConfirmCharge } from '../ConfirmCharge'
import { wifiAdvice } from '../../domain/phoneSetup'
import { useNow } from '../../hooks/useDemo'
import { WifiQrCard } from '../delights/EmbarkDelights'

/** Ship Wi-Fi (NET-02): devices, a usage meter, upgrades and sign-in help. The app itself needs no paid plan (NET-01). */
export function WifiScreen() {
  const view = useMine(() => api.wifi.view(), [])
  return (
    <div className="page">
      <Banner kind="success" title={t('wifi.free')}><p>{t('wifi.freeBody')}</p></Banner>
      <Banner kind="info" title={t('phone.guard')}><p>{t('phone.guardBody')} <Link to="/plan/phone">{t('route.phone')}</Link></p></Banner>
      <WifiQrCard />
      <Load state={view}>{(v) => <Wifi v={v} reload={view.retry} />}</Load>
      <section aria-labelledby="wifi-help-h">
        <h2 id="wifi-help-h">{th('wifi.help')}</h2>
        <ol className="plain-bullets">{(['network', 'forget', 'portal', 'device', 'desk'] as const).map((k) => <li key={k}>{t(`wifi.step.${k}` as StringKey)}</li>)}</ol>
      </section>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

function Wifi({ v, reload }: { v: WifiView; reload: () => void }) {
  const [name, setName] = useState('')
  const [plan, setPlan] = useState<WifiPlan>('messaging')
  const [days, setDays] = useState(1)
  const add = useAction(async () => { await api.wifi.add({ name, plan, days }); setName(''); reload() })
  const sure = useConfirmCharge()
  const cost = v.includedLeft > 0 && (planById(plan)?.rank ?? 9) <= 2 ? 0 : (planById(plan)?.perDay ?? 0) * days
  return (
    <>
      {sure.dialog}
      <NotAboard open={v.canBuy || v.devices.length > 0} />
      <p>{v.includedLeft > 0 ? t('wifi.includedLeft', { count: v.includedLeft }) : t('wifi.noneIncluded')}</p>
      {v.devices.length === 0 ? <p className="muted">{t('wifi.noDevices')}</p> : <ul className="order-list">{v.devices.map((d) => <Device key={d.id} d={d} canBuy={v.canBuy} reload={reload} />)}</ul>}
      {v.canBuy && (
        <Card labelledBy="wifi-add-h">
          <h2 id="wifi-add-h" className="card__title">{th('wifi.add')}</h2>
          <form onSubmit={(e) => { e.preventDefault(); sure.ask(cost, t('wifi.confirmWhat'), () => void add.run()) }}>
            <Field label={t('wifi.deviceName')} help={t('helptip.deviceName')} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
            <div className="field">
              <label htmlFor="wifi-plan">{t('wifi.plan')}</label>
              <select id="wifi-plan" className="field__input" value={plan} onChange={(e) => setPlan(e.target.value as WifiPlan)}>
                {PLANS.map((p) => <option key={p.id} value={p.id}>{t(`wifi.plan.${p.id}` as StringKey)}, {formatMoney(p.perDay)} {t('wifi.perDay')}</option>)}
              </select>
              <p className="field__hint">{t(`wifi.planHelp.${plan}` as StringKey)}</p>
            </div>
            <div className="field">
              <label htmlFor="wifi-days">{t('wifi.days')}</label>
              <select id="wifi-days" className="field__input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t('wifi.dayCount', { count: n })}</option>)}
              </select>
            </div>
            <p>{v.includedLeft > 0 && (planById(plan)?.rank ?? 9) <= 2 ? t('wifi.willBeFree') : t('wifi.cost', { amount: formatMoney((planById(plan)?.perDay ?? 0) * days) })}</p>
            <ExtraError error={add.error} />
            <Button type="submit" disabled={add.busy || name.trim().length < 2}>{add.busy ? t('account.saving') : t('wifi.addButton')}</Button>
          </form>
        </Card>
      )}
    </>
  )
}

function Device({ d, canBuy, reload }: { d: WifiDeviceView; canBuy: boolean; reload: () => void }) {
  const shipTime = useShipTime()
  const up = useAction(async (to: WifiPlan) => { await api.wifi.upgrade(d.id, to); reload() })
  const sure = useConfirmCharge()
  const now = useNow()
  const advice = wifiAdvice(d.plan, d.usedMb)
  const daysLeft = Math.max(1, Math.ceil((d.expiresAt - now) / 86_400_000))
  const upgradeCents = (to: WifiPlan) => Math.max(0, (planById(to)?.perDay ?? 0) - (planById(d.plan)?.perDay ?? 0)) * daysLeft
  const remove = useAction(async () => { await api.wifi.remove(d.id); reload() })
  const rank = planById(d.plan)?.rank ?? 0
  return (
    <li className="order">
      <h3 className="order__title">{d.name}</h3>
      <p>{t(`wifi.plan.${d.plan}` as StringKey)}{d.included && <> · {t('wifi.includedTag')}</>} · {d.expired ? t('wifi.expired') : t('wifi.until', { time: shipTime(d.expiresAt) })}</p>
      {d.capMb === null ? <p>{t('wifi.usedNoCap', { used: d.usedMb })}</p> : (
        <>
          <p>{t('wifi.used', { used: d.usedMb, cap: d.capMb })}</p>
          <progress className="photo__progress" max={d.capMb} value={Math.min(d.usedMb, d.capMb)} aria-label={t('wifi.meter', { name: d.name })} />
        </>
      )}
      {!d.expired && advice.level !== 'fine' && advice.level !== 'unlimited' && <p role="status">{t(`wifi.coach.${advice.level}` as StringKey, { percent: advice.percent, plan: advice.upgradeTo ? t(`wifi.plan.${advice.upgradeTo}` as StringKey) : '' })}</p>}
      {sure.dialog}
      <ExtraError error={up.error ?? remove.error} />
      {canBuy && (
        <div className="button-row">
          {!d.expired && PLANS.filter((p) => p.rank > rank).map((p) => <Button key={p.id} variant="secondary" disabled={up.busy} onClick={() => sure.ask(upgradeCents(p.id), t('wifi.confirmUpgrade'), () => void up.run(p.id))}>{t('wifi.upgradeTo', { plan: t(`wifi.plan.${p.id}` as StringKey) })}</Button>)}
          <Button variant="tertiary" disabled={remove.busy} onClick={() => void remove.run()}>{t('wifi.remove')}<span className="visually-hidden"> {d.name}</span></Button>
        </div>
      )}
    </li>
  )
}
