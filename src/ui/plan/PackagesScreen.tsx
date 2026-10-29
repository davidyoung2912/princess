import { useState } from 'react'
import type { AddOnOffer, BuyInput, PackagesView, PersonEntitlements, PurchaseView, UpgradeOffer } from '../../api/types'
import { formatDate } from '../../domain/cruise'
import type { PaymentPart } from '../../domain/fares'
import { ADD_ONS, AVG_DRINK, breakEvenDrinks, DEFAULT_USAGE, drinksWorth, packageWorth, units, type Usage } from '../../domain/packages'
import type { PersonaId } from '../../domain/personas'
import { formatMoney } from '../../domain/pricing'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { Field } from '../Field'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { PayPanel } from '../book/PayPanel'
import { GuestPicker, PlanError, ReadOnly } from './common'
import { names } from './people'

type Buying = { kind: 'addOn'; offer: AddOnOffer } | { kind: 'upgrade'; offer: UpgradeOffer; to: 'plus' | 'premier' }

const PACKAGE_NAMES = { none: 'Standard', plus: 'Princess Plus', premier: 'Princess Premier' } as const

/** Packages and add-ons: what is included for each guest, what can be added, "is it worth it?", and price protection (PRE-06, PRE-16, PRE-17). */
export function PackagesScreen() {
  const view = useMine(() => api.plan.packages.view())
  return (
    <div className="page">
      <h1>{t('route.packages')}</h1>
      <p>{t('pk.intro')}</p>
      <Load state={view}>{(v) => <Body view={v} reload={view.retry} />}</Load>
    </div>
  )
}

function Body({ view, reload }: { view: PackagesView; reload: () => void }) {
  const [buying, setBuying] = useState<Buying | null>(null)
  const claim = useAction(async (id: string) => { await api.plan.packages.claimDrop(id); reload() })
  const cancel = useAction(async (id: string) => { await api.plan.packages.cancel(id); reload() })
  const active = view.purchases.filter((p) => p.status === 'active')
  const gone = view.purchases.filter((p) => p.status === 'cancelled')

  return (
    <>
      <ReadOnly canDo={view.canBuy} />
      <section aria-labelledby="incl-h">
        <h2 id="incl-h">{t('pk.included')}</h2>
        <p className="muted">{t('pk.includedHint')}</p>
        <ul className="card-grid">{view.people.map((p) => <Included key={p.id} p={p} />)}</ul>
        {view.credit.total > 0 && (
          <Card info>
            <h3 className="card__title">{t('pk.credit')}</h3>
            <p>{t('pk.creditLine', { remaining: formatMoney(view.credit.remaining), total: formatMoney(view.credit.total) })}</p>
            <progress className="meter" max={view.credit.total} value={view.credit.used} aria-label={t('pk.creditUsed', { used: formatMoney(view.credit.used), total: formatMoney(view.credit.total) })} />
          </Card>
        )}
      </section>

      {view.upgrades.length > 0 && (
        <section aria-labelledby="up-h">
          <h2 id="up-h">{t('pk.upgrades')}</h2>
          <p className="muted">{t('pk.upgradesHint')}</p>
          <ul className="card-grid">
            {view.upgrades.map((u) => (
              <li key={u.guest} className="card">
                <h3 className="card__title">{u.name}</h3>
                <p className="muted">{t('pk.now', { name: PACKAGE_NAMES[u.from] })}</p>
                {u.options.map((o) => (
                  <div key={o.to}>
                    <p className="tour__price">{PACKAGE_NAMES[o.to]}: {formatMoney(o.price)}</p>
                    <RiseNote price={o.price} later={o.changesTo} on={o.changeOn} days={view.daysToDeparture} />
                    {view.canBuy && <Button variant="secondary" onClick={() => setBuying({ kind: 'upgrade', offer: u, to: o.to })}>{t('pk.buy')}<span className="visually-hidden"> {PACKAGE_NAMES[o.to]}, {u.name}</span></Button>}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="add-h">
        <h2 id="add-h">{t('pk.addons')}</h2>
        <ul className="card-grid">
          {view.addOns.map((a) => (
            <li key={a.id} className="card">
              <h3 className="card__title">{ADD_ONS[a.id].name}</h3>
              <p>{ADD_ONS[a.id].blurb}</p>
              <p className="tour__price">{formatMoney(a.price)} <span className="muted">{t(`pk.unit.${a.unit}` as never)}</span></p>
              {a.changeOn && <RiseNote price={a.price} later={a.changesTo} on={a.changeOn} days={view.daysToDeparture} />}
              {a.eligible.length === 0 ? <p className="muted">{t('pk.nobody')}</p> : view.canBuy && <Button variant="secondary" onClick={() => setBuying({ kind: 'addOn', offer: a })}>{t('pk.buy')}<span className="visually-hidden"> {ADD_ONS[a.id].name}</span></Button>}
            </li>
          ))}
        </ul>
      </section>

      <Worth view={view} />

      <section aria-labelledby="own-h">
        <h2 id="own-h">{t('pk.mine')}</h2>
        <PlanError error={claim.error ?? cancel.error} />
        {active.length === 0 ? <p className="muted">{t('pk.none')}</p> : (
          <ul className="card-grid">
            {active.map((p) => <Purchase key={p.id} p={p} canAct={view.canBuy} busy={claim.busy || cancel.busy} onClaim={() => void claim.run(p.id)} onCancel={() => void cancel.run(p.id)} />)}
          </ul>
        )}
        {gone.length > 0 && <ul className="plain-list">{gone.map((p) => <li key={p.id}><span>{purchaseName(p)}</span><span className="muted">{t('pk.cancelled', { amount: formatMoney(p.total) })}</span></li>)}</ul>}
      </section>

      {buying && <BuyDialog view={view} what={buying} reload={reload} onClose={() => setBuying(null)} />}
    </>
  )
}

const purchaseName = (p: PurchaseView): string => (p.kind === 'addOn' ? ADD_ONS[p.item as keyof typeof ADD_ONS].name : PACKAGE_NAMES[p.item as 'plus' | 'premier'])

function RiseNote({ price, later, on, days }: { price: number; later: number; on: string; days: number }) {
  if (price === later) return null
  const before = days >= 0 && formatDate(on) && later > price
  return <p className="price-note muted">{before ? t('pk.rises', { price: formatMoney(later), date: formatDate(on) }) : later < price ? t('pk.falls', { price: formatMoney(later), date: formatDate(on) }) : t('pk.rose', { date: formatDate(on) })}</p>
}

function Included({ p }: { p: PersonEntitlements }) {
  const e = p.entitlements
  const meals = p.balances.specialtyMeals
  return (
    <li className="card">
      <h3 className="card__title">{p.name}</h3>
      <p><StatusBadge kind={p.package === 'none' ? 'ready' : 'booked'} label={PACKAGE_NAMES[p.package]} /></p>
      <ul className="tour__facts">
        <li>{e.drinkCapUsd > 0 ? t('pk.in.drinks', { cap: e.drinkCapUsd }) : t('pk.in.noDrinks')}</li>
        <li>{e.wifiDevices > 0 ? t('pk.in.wifi', { count: e.wifiDevices }) : t('pk.in.noWifi')}</li>
        <li>{meals.total > 0 ? t('pk.in.meals', { remaining: meals.remaining, total: meals.total }) : t('pk.in.noMeals')}</li>
        <li>{e.gratuitiesIncluded ? t('pk.in.gratuities') : t('pk.in.noGratuities')}</li>
        <li>{e.diningWindow === 'atBooking' ? t('pk.in.windowEarly') : t('pk.in.windowLate')}</li>
        {e.perks.map((x) => <li key={x}>{t(`pk.perk.${x}` as never)}</li>)}
      </ul>
      {meals.total > 0 && <progress className="meter" max={meals.total} value={meals.used} aria-label={t('pk.in.mealsUsed', { used: meals.used, total: meals.total })} />}
    </li>
  )
}

function Purchase({ p, canAct, busy, onClaim, onCancel }: { p: PurchaseView; canAct: boolean; busy: boolean; onClaim: () => void; onCancel: () => void }) {
  const owed = p.price.total - p.credited
  return (
    <li className="card">
      <h3 className="card__title">{purchaseName(p)}</h3>
      <p>{names(p.guests)}</p>
      <p>{t('pk.paid', { total: formatMoney(p.total), unit: formatMoney(p.unit) })}</p>
      {p.price.state === 'locked' && <p><StatusBadge kind="booked" label={t('pk.locked')} /> <span className="muted">{t('pk.lockedBody', { saving: formatMoney(p.price.total) })}</span></p>}
      {p.price.state === 'dropped' && (owed > 0
        ? <><p><StatusBadge kind="changed" label={t('pk.dropped')} /> <span className="muted">{t('pk.droppedBody', { amount: formatMoney(owed) })}</span></p>{canAct && <Button variant="secondary" disabled={busy} onClick={onClaim}>{t('pk.claim', { amount: formatMoney(owed) })}<span className="visually-hidden"> {purchaseName(p)}</span></Button>}</>
        : <p><StatusBadge kind="booked" label={t('pk.credited', { amount: formatMoney(p.credited) })} /></p>)}
      {canAct && p.canCancel && <Button variant="tertiary" disabled={busy} onClick={onCancel}>{t('pk.cancel')}<span className="visually-hidden"> {purchaseName(p)}</span></Button>}
      {!p.canCancel && <p className="muted">{t('pk.cantCancel')}</p>}
    </li>
  )
}

function BuyDialog({ view, what, reload, onClose }: { view: PackagesView; what: Buying; reload: () => void; onClose: () => void }) {
  const eligible = what.kind === 'addOn' ? what.offer.eligible.map((g) => g.id) : [what.offer.guest]
  const [guests, setGuests] = useState<PersonaId[]>(eligible.slice(0, 1))
  const [done, setDone] = useState(false)
  const unit = what.kind === 'addOn' ? what.offer.price : what.offer.options.find((o) => o.to === what.to)!.price
  const count = what.kind === 'addOn' ? units(what.offer.unit, guests.length) : guests.length
  const total = unit * count
  const title = what.kind === 'addOn' ? ADD_ONS[what.offer.id].name : PACKAGE_NAMES[what.to]
  const pay = useAction(async (parts: PaymentPart[], challenge: string | undefined) => {
    const input: BuyInput = what.kind === 'addOn' ? { kind: 'addOn', item: what.offer.id, guests } : { kind: 'upgrade', to: what.to, guests }
    const v = await api.plan.packages.buy(input, parts, challenge)
    reload()
    setDone(true)
    return v
  })
  const picker = what.kind === 'addOn' ? view.party.filter((g) => eligible.includes(g.id)) : view.party.filter((g) => g.id === what.offer.guest)

  return (
    <Dialog title={t('pk.buyTitle', { name: title })} onClose={onClose}>
      {done ? (
        <>
          <Banner kind="success" title={t('pk.bought', { name: title })} />
          <Button onClick={onClose}>{t('common.close')}</Button>
        </>
      ) : (
        <>
          {what.kind === 'addOn' && <GuestPicker legend={t('pk.who')} party={picker} value={guests} onChange={setGuests} />}
          {what.kind === 'upgrade' && <p>{t('pk.upgradeFor', { name: what.offer.name })}</p>}
          <p aria-live="polite"><strong>{guests.length === 0 ? t('pk.chooseGuest') : t('pk.totalLine', { total: formatMoney(total), units: count, unit: formatMoney(unit) })}</strong></p>
          <PlanError error={pay.error?.code === 'conflict' || pay.error?.code === 'invalid' ? pay.error : null} />
          {guests.length > 0 && <PayPanel due={total} pay={pay} label={t('pay.payButton', { amount: formatMoney(total) })} />}
        </>
      )}
    </Dialog>
  )
}

/** "Is it worth it?" (PRE-06): the same facts the guest would weigh, with the sums done. */
function Worth({ view }: { view: PackagesView }) {
  const [use, setUse] = useState<Usage>(DEFAULT_USAGE)
  const num = (v: string, max: number) => Math.min(max, Math.max(0, Number(v) || 0))
  const drinks = view.addOns.find((a) => a.id === 'drinks')!
  const wifi = view.addOns.find((a) => a.id === 'wifi')!
  const dw = drinksWorth(drinks.price, use)
  const first = view.upgrades[0]
  return (
    <section aria-labelledby="worth-h">
      <h2 id="worth-h">{t('pk.worth')}</h2>
      <p>{t('pk.worthIntro')}</p>
      <div className="calc-grid">
        <Field label={t('pk.w.drinks')} type="number" inputMode="decimal" min={0} max={20} value={use.drinksPerDay} onChange={(e) => setUse({ ...use, drinksPerDay: num(e.target.value, 20) })} />
        <Field label={t('pk.w.avg')} hint={t('pk.w.avgHint', { price: formatMoney(AVG_DRINK) })} type="number" inputMode="decimal" min={4} max={30} value={use.avgDrink / 100} onChange={(e) => setUse({ ...use, avgDrink: Math.round(num(e.target.value, 30) * 100) })} />
        <Field label={t('pk.w.dinners')} type="number" inputMode="numeric" min={0} max={7} value={use.specialtyDinners} onChange={(e) => setUse({ ...use, specialtyDinners: Math.round(num(e.target.value, 7)) })} />
        <Field label={t('pk.w.tours')} type="number" inputMode="numeric" min={0} max={1000} value={use.excursionSpend} onChange={(e) => setUse({ ...use, excursionSpend: Math.round(num(e.target.value, 1000)) })} />
      </div>
      <label className="choice"><input type="checkbox" checked={use.wifi} onChange={() => setUse({ ...use, wifi: !use.wifi })} /><span>{t('pk.w.wifi')}</span></label>
      <div aria-live="polite">
        <Card>
          <h3 className="card__title">{ADD_ONS.drinks.name}</h3>
          <p className={dw.worthIt ? 'verdict' : ''}>{dw.worthIt ? t('pk.w.yes', { amount: formatMoney(dw.savings) }) : t('pk.w.no', { amount: formatMoney(-dw.savings) })}</p>
          <p className="muted">{t('pk.w.breakEven', { drinks: breakEvenDrinks(drinks.price, use.avgDrink) })}</p>
        </Card>
        {first && first.options.map((o) => {
          const w = packageWorth(first.from, o.to, o.price, use, wifi.price)
          return (
            <Card key={o.to}>
              <h3 className="card__title">{PACKAGE_NAMES[o.to]}</h3>
              <p className={w.worthIt ? 'verdict' : ''}>{w.worthIt ? t('pk.w.yes', { amount: formatMoney(w.savings) }) : t('pk.w.no', { amount: formatMoney(-w.savings) })}</p>
              <p className="muted">{t('pk.w.compare', { without: formatMoney(w.without), cost: formatMoney(w.cost) })}</p>
            </Card>
          )
        })}
      </div>
      <p className="muted">{t('pk.w.note')}</p>
    </section>
  )
}
