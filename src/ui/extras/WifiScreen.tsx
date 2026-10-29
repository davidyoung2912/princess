import { useState } from 'react'
import type { WifiDeviceView, WifiView } from '../../api/types'
import { formatMoney } from '../../domain/pricing'
import { MAX_DAYS, PLANS, planById, type WifiPlan } from '../../domain/wifi'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Load } from '../account/parts'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { ExtraError, NotAboard } from './common'

/** Ship Wi-Fi (NET-02): devices, a usage meter, upgrades and sign-in help. The app itself needs no paid plan (NET-01). */
export function WifiScreen() {
  const view = useMine(() => api.wifi.view(), [])
  return (
    <div className="page">
      <h1>{t('route.wifi')}</h1>
      <Banner kind="success" title={t('wifi.free')}><p>{t('wifi.freeBody')}</p></Banner>
      <Load state={view}>{(v) => <Wifi v={v} reload={view.retry} />}</Load>
      <section aria-labelledby="wifi-help-h">
        <h2 id="wifi-help-h">{t('wifi.help')}</h2>
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
  return (
    <>
      <NotAboard open={v.canBuy || v.devices.length > 0} />
      <p>{v.includedLeft > 0 ? t('wifi.includedLeft', { count: v.includedLeft }) : t('wifi.noneIncluded')}</p>
      {v.devices.length === 0 ? <p className="muted">{t('wifi.noDevices')}</p> : <ul className="order-list">{v.devices.map((d) => <Device key={d.id} d={d} canBuy={v.canBuy} reload={reload} />)}</ul>}
      {v.canBuy && (
        <Card labelledBy="wifi-add-h">
          <h2 id="wifi-add-h" className="card__title">{t('wifi.add')}</h2>
          <form onSubmit={(e) => { e.preventDefault(); void add.run() }}>
            <Field label={t('wifi.deviceName')} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
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
      <ExtraError error={up.error ?? remove.error} />
      {canBuy && (
        <div className="button-row">
          {!d.expired && PLANS.filter((p) => p.rank > rank).map((p) => <Button key={p.id} variant="secondary" disabled={up.busy} onClick={() => void up.run(p.id)}>{t('wifi.upgradeTo', { plan: t(`wifi.plan.${p.id}` as StringKey) })}</Button>)}
          <Button variant="tertiary" disabled={remove.busy} onClick={() => void remove.run()}>{t('wifi.remove')}<span className="visually-hidden"> {d.name}</span></Button>
        </div>
      )}
    </li>
  )
}
