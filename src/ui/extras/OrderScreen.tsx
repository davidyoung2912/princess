import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { OrderGuest, OrderMenuView, OrderView } from '../../api/types'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { placeName } from '../../domain/family'
import {
  DELIVERY_ZONES, DRINKING_AGE, MAX_PER_LINE, MENU_GROUPS, TIPS, itemById, locationProblem, menuFor, priceOrder,
  type Choice, type Location, type MenuItem, type OrderKind, type OrderLine,
} from '../../domain/orders'
import { itinerary } from '../../domain/sailings'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useSailing } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { ExtraError, NotAboard } from './common'

const KINDS: readonly OrderKind[] = ['delivery', 'room', 'breakfast']

/** Order food and drinks to the stateroom or a spot on deck, room service and scheduled breakfast (DIN-04, DIN-05, DIN-11). */
export function OrderScreen() {
  const menu = useMine(() => api.orders.menu(), [])
  const orders = useMine(() => api.orders.list(), [])
  // Orders move while the screen is open, so look again every so often (the demo clock may run fast).
  useEffect(() => {
    const id = setInterval(orders.retry, 10_000)
    return () => clearInterval(id)
  }, [orders.retry])
  return (
    <div className="page">
      <h1>{t('route.order')}</h1>
      <p>{t('ord.intro')}</p>
      <Load state={menu}>
        {(m) => (
          <>
            <NotAboard open={m.open} />
            {m.isolating && <Banner kind="info" title={t('ord.isolating')}><p>{t('ord.isolatingBody')}</p></Banner>}
            {m.canOrder && <Builder menu={m} placed={orders.retry} />}
            {m.open && !m.canOrder && <Banner kind="info" title={t('plan.readOnly.title')}><p>{t('plan.readOnly.body')}</p></Banner>}
          </>
        )}
      </Load>
      <section aria-labelledby="mine-h">
        <h2 id="mine-h">{t('ord.mine')}</h2>
        <Load state={orders}>{(list) => (list.length === 0 ? <p className="muted">{t('ord.none')}</p> : <ul className="order-list">{list.map((o) => <OrderCard key={o.id} o={o} guests={menu.data?.guests ?? []} reload={orders.retry} />)}</ul>)}</Load>
      </section>
      <p className="muted">{t('ord.tipPolicy')}</p>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

function Builder({ menu, placed }: { menu: OrderMenuView; placed: () => void }) {
  const s = useSailing()
  const [kind, setKind] = useState<OrderKind>('delivery')
  const [lines, setLines] = useState<OrderLine[]>([])
  const [guest, setGuest] = useState(menu.guests[0]?.id ?? 'gerald')
  const [where, setWhere] = useState<'cabin' | 'zone' | 'other'>('cabin')
  const [zone, setZone] = useState(DELIVERY_ZONES[0])
  const [text, setText] = useState('')
  const [tip, setTip] = useState(0)
  const [at, setAt] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const location: Location = where === 'cabin' ? { kind: 'cabin' } : where === 'zone' ? { kind: 'zone', placeId: zone } : { kind: 'other', text }
  const deliverAt = at ? Number(at) : undefined
  const priced = useMemo(() => priceOrder(lines, { kind, location, tip, guests: menu.guests, free: menu.isolating }), [lines, kind, where, zone, text, tip, menu.guests, menu.isolating]) // oxlint-disable-line react-hooks/exhaustive-deps -- `location` is built from these
  const place = useAction(async () => {
    const o = await api.orders.place({ kind, lines, location, tip, ...(kind === 'breakfast' ? { deliverAt } : {}) })
    setLines([])
    setDone(o.id)
    placed()
  })
  const switchKind = (k: OrderKind) => { setKind(k); setLines([]); setDone(null); if (k === 'room' || k === 'breakfast') setWhere('cabin') }
  const bad = locationProblem(location) !== null
  const why = lines.length === 0 ? t('ord.addFirst') : bad ? t('ord.pickWhere') : kind === 'breakfast' && !deliverAt ? t('ord.pickTime') : ''
  const guestOf = (id: string): OrderGuest | undefined => menu.guests.find((g) => g.id === id)

  return (
    <>
      <fieldset className="plain-fieldset">
        <legend>{t('ord.kind')}</legend>
        <div className="chip-row">
          {KINDS.map((k) => (
            <label key={k} className="choice choice--pill">
              <input type="radio" name="ord-kind" checked={kind === k} onChange={() => switchKind(k)} />
              <span>{t(`ord.kind.${k}` as StringKey)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="muted">{t(`ord.kindHelp.${kind}` as StringKey)}</p>

      <div className="field">
        <label htmlFor="ord-guest">{t('ord.for')}</label>
        <select id="ord-guest" className="field__input" value={guest} onChange={(e) => setGuest(e.target.value as typeof guest)}>
          {menu.guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {MENU_GROUPS.filter((g) => menuFor(kind).some((m) => m.group === g)).map((g) => (
        <section key={g} aria-labelledby={`grp-${g}`}>
          <h2 id={`grp-${g}`}>{t(`ord.group.${g}` as StringKey)}</h2>
          <ul className="dish-list">
            {menuFor(kind).filter((m) => m.group === g).map((m) => <Dish key={m.id} item={m} out={menu.outOfStock.includes(m.id)} guest={guestOf(guest)} onAdd={(l) => { setLines([...lines, { ...l, guest }]); setDone(null) }} />)}
          </ul>
        </section>
      ))}

      <Card hero labelledBy="cart-h">
        <h2 id="cart-h" className="card__title">{t('ord.yours')}</h2>
        {lines.length === 0 ? <p>{t('ord.empty')}</p> : (
          <ul className="plain-bullets">
            {priced.lines.map((l, i) => (
              <li key={i}>
                {l.qty} × {l.name} ({guestOf(l.guest)?.name.split(' ')[0]}), {l.charge === 0 && l.gross > 0 ? t(l.coveredBy === 'package' ? 'ord.coveredPackage' : 'ord.coveredFare') : formatMoney(l.charge)}
                {lines[i].extras.length > 0 && <small className="muted"> ({lines[i].extras.map((e) => itemById(l.itemId)?.extras.find((x) => x.id === e)?.label).join(', ')})</small>}
                {' '}<Button variant="tertiary" onClick={() => setLines(lines.filter((_, j) => j !== i))}>{t('ord.remove')}<span className="visually-hidden"> {l.name}</span></Button>
              </li>
            ))}
          </ul>
        )}

        {kind === 'breakfast' ? (
          <div className="field">
            <label htmlFor="ord-at">{t('ord.when')}</label>
            <select id="ord-at" className="field__input" value={at} onChange={(e) => setAt(e.target.value)}>
              <option value="">{t('ord.chooseTime')}</option>
              {menu.mornings.map((m) => (
                <optgroup key={m.date} label={`${t('plan.day', { n: m.day })}, ${formatDate(itinerary(s)[m.day - 1].date)}`}>
                  {m.slots.map((x) => <option key={x.at} value={x.at}>{x.time}</option>)}
                </optgroup>
              ))}
            </select>
            {menu.mornings.length === 0 && <p className="muted">{t('ord.noMornings')}</p>}
          </div>
        ) : null}

        {kind === 'delivery' && (
          <fieldset className="plain-fieldset">
            <legend>{t('ord.where')}</legend>
            <label className="choice"><input type="radio" name="ord-where" checked={where === 'cabin'} onChange={() => setWhere('cabin')} /><span>{t('ord.whereCabin', { cabin: menu.cabin })}</span></label>
            <label className="choice"><input type="radio" name="ord-where" checked={where === 'zone'} onChange={() => setWhere('zone')} /><span>{t('ord.whereZone')}</span></label>
            {where === 'zone' && (
              <div className="field">
                <label htmlFor="ord-zone">{t('ord.zone')}</label>
                <select id="ord-zone" className="field__input" value={zone} onChange={(e) => setZone(e.target.value)}>{DELIVERY_ZONES.map((z) => <option key={z} value={z}>{placeName(z)}</option>)}</select>
              </div>
            )}
            <label className="choice"><input type="radio" name="ord-where" checked={where === 'other'} onChange={() => setWhere('other')} /><span>{t('ord.whereOther')}</span></label>
            {where === 'other' && (
              <div className="field">
                <label htmlFor="ord-other">{t('ord.otherText')}</label>
                <input id="ord-other" className="field__input" value={text} maxLength={80} onChange={(e) => setText(e.target.value)} />
                <p className="field__hint">{t('ord.otherHint')}</p>
              </div>
            )}
          </fieldset>
        )}

        <fieldset className="plain-fieldset">
          <legend>{t('ord.tip')}</legend>
          <div className="chip-row">
            {TIPS.map((c) => (
              <label key={c} className="choice choice--pill"><input type="radio" name="ord-tip" checked={tip === c} onChange={() => setTip(c)} /><span>{c === 0 ? t('ord.noTip') : formatMoney(c)}</span></label>
            ))}
          </div>
        </fieldset>

        <dl className="plain-dl">
          {priced.fee > 0 && <div><dt>{t('ord.fee')}</dt><dd>{formatMoney(priced.fee)}</dd></div>}
          {priced.service > 0 && <div><dt>{t('ord.service')}</dt><dd>{formatMoney(priced.service)}</dd></div>}
          {priced.covered > 0 && <div><dt>{t('ord.covered')}</dt><dd>{formatMoney(priced.covered)}</dd></div>}
          <div><dt>{t('ord.total')}</dt><dd>{formatMoney(priced.total)}</dd></div>
        </dl>
        <p className="muted">{t('ord.charged')}</p>
        <ExtraError error={place.error} />
        <Button block disabled={place.busy || !!why} onClick={() => void place.run()}>{place.busy ? t('account.saving') : t('ord.place')}</Button>
        {why && <p className="muted">{why}</p>}
        {done && <Banner kind="success" title={t('ord.placed')}><p>{t('ord.placedBody')}</p></Banner>}
      </Card>
    </>
  )
}

function Dish({ item, out, guest, onAdd }: { item: MenuItem; out: boolean; guest: OrderGuest | undefined; onAdd: (l: Omit<OrderLine, 'guest'>) => void }) {
  const [qty, setQty] = useState(1)
  const [extras, setExtras] = useState<string[]>([])
  const sub = item.substitute ? itemById(item.substitute) : undefined
  const underage = item.alcohol && (guest?.age ?? 0) < DRINKING_AGE
  const covered = item.packaged && (guest?.drinkCapUsd ?? 0) > 0
  return (
    <li className="dish">
      <p className="dish__name"><strong>{item.name}</strong> <span>{item.cents === 0 ? t('x.free') : formatMoney(item.cents)}</span></p>
      {item.contains.length > 0 && <p className="muted">{t('ord.contains', { list: item.contains.map((c) => t(`ven.c.${c}` as StringKey)).join(', ') })}</p>}
      {covered && <p className="muted">{t('ord.packageNote', { cap: guest!.drinkCapUsd })}</p>}
      {out ? (
        <Banner kind="warning" title={t('ord.out', { name: item.name })}>
          {sub ? <Button variant="secondary" onClick={() => onAdd({ itemId: sub.id, qty: 1, extras: [] })}>{t('ord.addInstead', { name: sub.name })}</Button> : <p>{t('ord.noInstead')}</p>}
        </Banner>
      ) : underage ? (
        <p className="muted">{t('ord.underage')}</p>
      ) : (
        <>
          {item.extras.length > 0 && (
            <fieldset className="plain-fieldset">
              <legend className="visually-hidden">{t('ord.extrasFor', { name: item.name })}</legend>
              {item.extras.map((e) => (
                <label key={e.id} className="choice">
                  <input type="checkbox" checked={extras.includes(e.id)} onChange={() => setExtras(extras.includes(e.id) ? extras.filter((x) => x !== e.id) : [...extras, e.id])} />
                  <span>{e.label}{e.cents > 0 ? ` (+${formatMoney(e.cents)})` : ''}</span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="button-row">
            <label className="visually-hidden" htmlFor={`qty-${item.id}`}>{t('ord.qty', { name: item.name })}</label>
            <select id={`qty-${item.id}`} className="field__input field__input--short" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
              {Array.from({ length: Math.min(MAX_PER_LINE, 6) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Button variant="secondary" onClick={() => { onAdd({ itemId: item.id, qty, extras }); setQty(1); setExtras([]) }}>{t('ord.add')}<span className="visually-hidden"> {item.name}</span></Button>
          </div>
        </>
      )}
    </li>
  )
}

function OrderCard({ o, guests, reload }: { o: OrderView; guests: OrderGuest[]; reload: () => void }) {
  const shipTime = useShipTime()
  const [choices, setChoices] = useState<Record<number, Choice>>({})
  const [zone, setZone] = useState<string>(o.location.kind === 'zone' ? o.location.placeId : DELIVERY_ZONES[0])
  const [sure, setSure] = useState(false)
  const [told, setTold] = useState(false)
  const resolve = useAction(async () => { await api.orders.resolve(o.id, choices); reload() })
  const cancel = useAction(async () => { await api.orders.cancel(o.id); setSure(false); reload() })
  const move = useAction(async (loc: Location) => { await api.orders.moveTo(o.id, loc); reload() })
  const contact = useAction(async () => { await api.orders.contact(o.id); setTold(true); reload() })
  const name = (id: string) => guests.find((g) => g.id === id)?.name.split(' ')[0] ?? id
  const open = o.stage !== 'delivered' && o.stage !== 'cancelled'
  return (
    <li className="order">
      <h3 className="order__title">{t(`ord.kind.${o.kind}` as StringKey)}, {shipTime(o.placedAt)}</h3>
      <p className={`order__stage order__stage--${o.stage}`} role="status"><strong>{t(`ord.stage.${o.stage}` as StringKey)}</strong>{o.etaAt !== null && open && <> · {t('ord.eta', { time: shipTime(o.etaAt) })}</>}</p>
      <ol className="order__steps" aria-label={t('ord.steps')}>
        {(['received', 'preparing', 'onTheWay', 'delivered'] as const).map((s) => <li key={s} aria-current={o.stage === s ? 'step' : undefined} className={o.stage === s ? 'is-current' : ''}>{t(`ord.step.${s}` as StringKey)}</li>)}
      </ol>
      <ul className="plain-bullets">
        {o.lines.map((l) => (
          <li key={l.index} className={l.removed ? 'is-removed' : ''}>
            {l.qty} × {l.name} ({name(l.guest)})
            {l.substitutedFor && <small className="muted"> {t('ord.swapped', { name: itemById(l.substitutedFor)?.name ?? '' })}</small>}
            {l.removed && <small className="muted"> {t('ord.removed')}</small>}
            {l.coveredBy && !l.removed && <small className="muted"> {t(l.coveredBy === 'package' ? 'ord.coveredPackage' : 'ord.coveredFare')}</small>}
          </li>
        ))}
      </ul>
      <p>{o.location.kind === 'cabin' ? t('ord.toCabin') : o.location.kind === 'zone' ? t('ord.toZone', { place: placeName(o.location.placeId) }) : t('ord.toOther', { text: o.location.text })}
        {o.deliverAt !== null && <> · {t('ord.deliverAt', { time: shipTime(o.deliverAt) })}</>}</p>
      <p><strong>{t('ord.total')}: {o.total === 0 ? t('x.free') : formatMoney(o.total)}</strong>{o.stage === 'cancelled' && o.refund > 0 && <> · {t('ord.refund', { amount: formatMoney(o.refund) })}</>}</p>

      {o.unavailable.length > 0 && (
        <Banner kind="warning" title={t('ord.ranOut')}>
          <p>{t('ord.ranOutBody')}</p>
          {o.unavailable.map((i) => {
            const l = o.lines[i]
            const original = itemById(l.substitutedFor ?? l.itemId)!
            const sub = original.substitute ? itemById(original.substitute) : undefined
            return (
              <fieldset key={i} className="plain-fieldset">
                <legend>{t('ord.ranOutItem', { name: original.name })}</legend>
                {sub && <label className="choice"><input type="radio" name={`res-${o.id}-${i}`} checked={choices[i] === 'substitute'} onChange={() => setChoices({ ...choices, [i]: 'substitute' })} /><span>{t('ord.swapFor', { name: sub.name })}</span></label>}
                <label className="choice"><input type="radio" name={`res-${o.id}-${i}`} checked={choices[i] === 'remove'} onChange={() => setChoices({ ...choices, [i]: 'remove' })} /><span>{t('ord.takeOff')}</span></label>
              </fieldset>
            )
          })}
          <ExtraError error={resolve.error} />
          <Button disabled={resolve.busy || !o.unavailable.every((i) => choices[i])} onClick={() => void resolve.run()}>{t('ord.confirmChoice')}</Button>
          <p className="muted">{t('ord.restKept')}</p>
        </Banner>
      )}

      {o.canMove && o.kind === 'delivery' && (
        <div className="field">
          <label htmlFor={`mv-${o.id}`}>{t('ord.moveTo')}</label>
          <div className="button-row">
            <select id={`mv-${o.id}`} className="field__input field__input--short" value={zone} onChange={(e) => setZone(e.target.value)}>{DELIVERY_ZONES.map((z) => <option key={z} value={z}>{placeName(z)}</option>)}</select>
            <Button variant="secondary" disabled={move.busy} onClick={() => void move.run({ kind: 'zone', placeId: zone })}>{t('ord.moveHere')}</Button>
            {o.location.kind !== 'cabin' && <Button variant="tertiary" disabled={move.busy} onClick={() => void move.run({ kind: 'cabin' })}>{t('ord.moveCabin')}</Button>}
          </div>
          <ExtraError error={move.error} />
          {o.stage === 'onTheWay' && <p className="muted">{t('ord.moveLate')}</p>}
        </div>
      )}

      {open && (
        <div className="button-row">
          <Button variant="secondary" disabled={contact.busy} onClick={() => void contact.run()}>{t('ord.contact')}</Button>
          {o.canCancel && !sure && <Button variant="tertiary" onClick={() => setSure(true)}>{t('ord.cancel')}</Button>}
        </div>
      )}
      {told && <p role="status" className="muted">{t('ord.contacted')} <Link to="/chat">{t('route.chat')}</Link></p>}
      {sure && o.canCancel && (
        <Banner kind="warning" title={t('ord.cancelSure')} action={<div className="button-row"><Button variant="danger" disabled={cancel.busy} onClick={() => void cancel.run()}>{t('ord.cancelYes')}</Button><Button variant="tertiary" onClick={() => setSure(false)}>{t('ord.cancelNo')}</Button></div>}>
          <p>{t('ord.cancelBody', { amount: formatMoney(o.total) })}</p>
        </Banner>
      )}
      <ExtraError error={cancel.error} />
      {open && !o.canCancel && <p className="muted">{t('ord.noCancel')}</p>}
    </li>
  )
}
