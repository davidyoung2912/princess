import { useState } from 'react'
import { Link } from 'react-router'
import { GIFTS_FOR } from '../../domain/ahead'
import { OCCASIONS } from '../../domain/booking'
import { itemById, itemsIn } from '../../domain/catalogue'
import { formatMoney } from '../../domain/pricing'
import { excursionById } from '../../domain/excursions'
import { isTicketed } from '../../domain/tickets'
import { directoryVenue } from '../../domain/menus'
import { ADD_ONS, isAddOnId } from '../../domain/packages'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { useMine } from '../../hooks/useMine'
import { usePersona } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { MyPicks, ItemList } from '../aboard/common'
import { TopUps, Gratuities } from '../aboard/MoneyScreen'
import { SeatControl, MyTickets, type SeatsInfo } from '../onboard/Tickets'
import { useShipTime } from '../onboard/shipTime'
import { AheadError, Back, ChildNote } from './common'

function Shows() {
  const [day, setDay] = useState(1)
  const me = usePersona()
  const shipTime = useShipTime()
  const program = useAsync(() => api.onboard.program(day), [day])
  const seats = useAsync(() => api.shows.day(day), [day])
  const tickets = useAsync(() => api.shows.mine(), [])
  const party = useAsync(() => api.account.party(), [])
  const info: SeatsInfo | null = seats.data && tickets.data && party.data ? { seats: seats.data, tickets: tickets.data, party: party.data, reload: () => { seats.retry(); tickets.retry() } } : null
  const shows = (program.data?.events ?? []).filter((e) => isTicketed(e.id))
  return (
    <section aria-labelledby="ahead-shows-h">
      <h2 id="ahead-shows-h">{t('ahead.shows')}</h2>
      <p>{t('ahead.showsBody')}</p>
      <div className="field">
        <label htmlFor="ahead-day">{t('ahead.day')}</label>
        <select id="ahead-day" className="field__input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t('plan.day', { n })}</option>)}
        </select>
      </div>
      {shows.length === 0 ? <p className="muted">{t('ahead.noShows')}</p> : (
        <ul className="card-grid">
          {shows.map((e) => (
            <li key={e.id}>
              <Card>
                <h3 className="card__title">{e.title}</h3>
                <p className="muted">{shipTime(e.startAt)}</p>
                {info && <SeatControl e={e} info={info} canEdit={!me?.child} />}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {tickets.data && <MyTickets tickets={tickets.data} />}
    </section>
  )
}

/** Shows, spa, fitness, gifts and celebrations that can be booked before sailing (PRE-04, PRE-05, PRE-07, MNG-13). */
export function BookAheadScreen() {
  const [occasion, setOccasion] = useState<(typeof OCCASIONS)[number]>('none')
  const gifts = itemsIn('gift')
  const suggested = GIFTS_FOR[occasion].map((id) => itemById(id)).filter((i) => !!i)
  return (
    <div className="page">
      <h1>{t('route.ahead')}</h1>
      <p>{t('ahead.intro')}</p>
      <p><Link to="/plan/cart">{t('route.cart')}</Link> · <Link to="/plan/prepay">{t('route.prepay')}</Link> · <Link to="/plan/clubs">{t('route.clubs')}</Link> · <Link to="/plan/upgrades">{t('route.upgrades')}</Link></p>
      <ChildNote />
      <Shows />
      <section aria-labelledby="ahead-spa-h">
        <h2 id="ahead-spa-h">{t('ahead.spa')}</h2>
        <p>{t('ahead.spaBody')}</p>
        <MyPicks groups={['spa', 'fitness']} />
        <ItemList items={[...itemsIn('spa'), ...itemsIn('fitness')]} />
      </section>
      <section aria-labelledby="ahead-gifts-h">
        <h2 id="ahead-gifts-h">{t('ahead.gifts')}</h2>
        <p>{t('ahead.giftsBody')}</p>
        <div className="field">
          <label htmlFor="ahead-occ">{t('ahead.occasion')}</label>
          <select id="ahead-occ" className="field__input" value={occasion} onChange={(e) => setOccasion(e.target.value as typeof occasion)}>
            {OCCASIONS.map((o) => <option key={o} value={o}>{t(`book.occasion.${o}` as StringKey)}</option>)}
          </select>
        </div>
        {suggested.length > 0 && <Banner kind="info" title={t('ahead.suggested')}><p>{suggested.map((i) => i!.title).join(', ')}</p></Banner>}
        <MyPicks groups={['gift']} />
        <ItemList items={[...suggested.filter((i) => !!i), ...gifts.filter((g) => !suggested.includes(g))]} />
      </section>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}

const SAVED_LINK: Record<string, string> = { item: '/plan/ahead', excursion: '/plan/excursions', venue: '/plan/dining', addon: '/me/packages' }

function savedName(key: string): string {
  const [kind, id] = key.split(':')
  if (kind === 'item') return itemById(id)?.title ?? id
  if (kind === 'excursion') return excursionById(id)?.name ?? id
  if (kind === 'venue') return directoryVenue(id)?.name ?? id
  return isAddOnId(id) ? ADD_ONS[id].name : id
}

/** One list of what is saved and what is in the baskets: tours, bookings and gifts (PRE-11). */
export function CartScreen() {
  const saved = useMine(() => api.ahead.saved.list())
  const picks = useMine(() => api.aboard.selections.list())
  const exc = useMine(() => api.plan.excursions.list())
  const remove = useAction(async (key: string) => { await api.ahead.saved.toggle(key); saved.retry() })
  const dropPick = useAction(async (id: string) => { await api.aboard.selections.remove(id); picks.retry() })
  return (
    <div className="page">
      <h1>{t('route.cart')}</h1>
      <p>{t('cart.intro')}</p>
      <AheadError error={remove.error ?? dropPick.error} />
      <section aria-labelledby="cart-now-h">
        <h2 id="cart-now-h">{t('cart.inBasket')}</h2>
        <Load state={exc}>
          {(v) => v.cart.length === 0 ? <p className="muted">{t('cart.noTours')}</p> : (
            <>
              <ul className="plain-bullets">{v.cart.map((l) => <li key={l.excursionId}>{excursionById(l.excursionId)?.name} · {formatMoney(l.total)}</li>)}</ul>
              <p><Link to="/plan/excursions">{t('cart.payTours', { total: formatMoney(v.cartTotal) })}</Link></p>
            </>
          )}
        </Load>
        <Load state={picks}>
          {(list) => list.length === 0 ? <p className="muted">{t('cart.noPicks')}</p> : (
            <>
              <ul className="plain-bullets">
                {list.map((p) => (
                  <li key={p.id}>
                    {itemById(p.item)?.title}{p.qty > 1 ? ` × ${p.qty}` : ''}{p.total > 0 ? ` · ${formatMoney(p.total)}` : ''}{' '}
                    <Button variant="tertiary" disabled={dropPick.busy} onClick={() => void dropPick.run(p.id)}>{t('ab.remove')}<span className="visually-hidden"> {itemById(p.item)?.title}</span></Button>
                  </li>
                ))}
              </ul>
              <p>{t('cart.picksTotal', { total: formatMoney(list.reduce((n, p) => n + p.total, 0)) })} <Link to="/me/bill">{t('route.bill')}</Link></p>
            </>
          )}
        </Load>
      </section>
      <section aria-labelledby="cart-saved-h">
        <h2 id="cart-saved-h">{t('cart.savedTitle')}</h2>
        <Load state={saved}>
          {(keys) => keys.length === 0 ? <p className="muted">{t('cart.noSaved')}</p> : (
            <ul className="card-grid">
              {keys.map((k) => (
                <li key={k}>
                  <Card>
                    <h3 className="card__title">{savedName(k)}</h3>
                    <p className="muted">{t(`cart.kind.${k.split(':')[0]}` as StringKey)}</p>
                    <div className="button-row">
                      <Link to={SAVED_LINK[k.split(':')[0]] ?? '/plan'}>{t('cart.open')}<span className="visually-hidden"> {savedName(k)}</span></Link>
                      <Button variant="tertiary" disabled={remove.busy} onClick={() => void remove.run(k)}>{t('cart.remove')}<span className="visually-hidden"> {savedName(k)}</span></Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Load>
      </section>
      <p className="muted">{t('cart.priceNote')}</p>
      <p><Link to="/plan/dining">{t('route.dining')}</Link> · <Link to="/me/packages">{t('route.packages')}</Link> · <Link to="/plan/ahead">{t('route.ahead')}</Link></p>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}

/** Buy onboard credit and prepay gratuities before sailing, or on board (PRE-10). */
export function PrepayScreen() {
  const view = useMine(() => api.aboard.money.view())
  return (
    <div className="page">
      <h1>{t('route.prepay')}</h1>
      <p>{t('prepay.intro')}</p>
      <ChildNote />
      <Load state={view}>
        {(v) => v.canEdit ? (
          <>
            <TopUps v={v} reload={view.retry} />
            <Gratuities v={v} reload={view.retry} />
          </>
        ) : <p>{t('prepay.child')}</p>}
      </Load>
      <p className="muted">{t('prepay.note')}</p>
      <p><Link to="/me/money">{t('route.money')}</Link> · <Link to="/me/bill">{t('route.bill')}</Link></p>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}
