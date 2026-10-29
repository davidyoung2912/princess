import { useState } from 'react'
import { SaveButton } from '../ahead/common'
import type { ExcursionOffer, ExcursionsView, TourBooking } from '../../api/types'
import type { PaymentPart } from '../../domain/fares'
import { formatDate, formatTime } from '../../domain/cruise'
import { ACTIVITIES, filterExcursions, formatHours, guestPrice, INTERESTS, NO_FILTER, type ExcursionPort, type Filter, type Interest } from '../../domain/excursions'
import type { PersonaId } from '../../domain/personas'
import { formatMoney } from '../../domain/pricing'
import { PORT_GUIDES } from '../../domain/ports'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { Dialog } from '../Dialog'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { PayPanel } from '../book/PayPanel'
import { Back, GuestPicker, PlanError, ReadOnly } from './common'
import { names } from './people'

const PORTS: readonly ExcursionPort[] = ['cozumel', 'belize', 'roatan']
const PRICES = [50, 75, 100]

/** Shore excursions: the catalogue, a cart, and what is booked, with clash and all-aboard checks (PRE-01, PRE-02). */
export function ExcursionsScreen() {
  const view = useMine(() => api.plan.excursions.list())
  return (
    <div className="page">
      <h1>{t('route.excursions')}</h1>
      <p>{t('exc.intro')}</p>
      <Load state={view}>{(v) => <Body view={v} reload={view.retry} />}</Load>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}

function Body({ view, reload }: { view: ExcursionsView; reload: () => void }) {
  const [filter, setFilter] = useState<Filter>(NO_FILTER)
  const [adding, setAdding] = useState<ExcursionOffer | null>(null)
  const [changing, setChanging] = useState<TourBooking | null>(null)
  const [cancelling, setCancelling] = useState<TourBooking | null>(null)
  const add = useAction(async (id: string, guests: PersonaId[]) => { const v = await api.plan.excursions.addToCart(id, guests); reload(); return v })
  const remove = useAction(async (id: string) => { const v = await api.plan.excursions.removeFromCart(id); reload(); return v })
  const pay = useAction(async (parts: PaymentPart[], challenge: string | undefined) => { const v = await api.plan.excursions.checkout(parts, challenge); reload(); return v })

  const offerOf = (id: string) => view.offers.find((o) => o.item.id === id)!
  const shown = filterExcursions(view.offers.map((o) => o.item), filter).map((x) => offerOf(x.id))
  const active = view.booked.filter((b) => b.status === 'booked')
  const past = view.booked.filter((b) => b.status === 'cancelled')
  const due = view.cartTotal - view.creditApplied
  const set = (change: Partial<Filter>) => setFilter({ ...filter, ...change })
  const toggle = (i: Interest) => set({ interests: filter.interests.includes(i) ? filter.interests.filter((x) => x !== i) : [...filter.interests, i] })

  const pick = async (o: ExcursionOffer) => {
    if (view.party.length === 1) { await add.run(o.item.id, [view.party[0].id]); return }
    setAdding(o)
  }

  return (
    <>
      <ReadOnly canDo={view.canBook} />
      {view.creditLeft > 0 && <Banner kind="info" title={t('exc.credit', { amount: formatMoney(view.creditLeft) })}><p>{t('exc.creditBody')}</p></Banner>}
      <PlanError error={add.error ?? remove.error} />

      {view.cart.length > 0 && (
        <section aria-labelledby="cart-h">
          <h2 id="cart-h">{t('exc.cart')}</h2>
          <ul className="plain-list">
            {view.cart.map((l) => {
              const o = offerOf(l.excursionId)
              return (
                <li key={l.excursionId}>
                  <span><strong>{o.item.name}</strong><br /><span className="muted">{formatDate(o.date)} · {names(l.guests)} · {formatMoney(l.total)}</span></span>
                  <Button variant="tertiary" disabled={remove.busy} onClick={() => void remove.run(l.excursionId)}>{t('exc.remove')}<span className="visually-hidden"> {o.item.name}</span></Button>
                </li>
              )
            })}
          </ul>
          <p><strong>{t('exc.total', { total: formatMoney(view.cartTotal) })}</strong>{view.creditApplied > 0 && ` · ${t('exc.creditUsed', { amount: formatMoney(view.creditApplied) })}`}</p>
          {due > 0 ? <PayPanel due={due} pay={pay} label={t('exc.pay', { amount: formatMoney(due) })} /> : (
            <>
              <PlanError error={pay.error} />
              <Button disabled={pay.busy || !view.canBook} onClick={() => void pay.run([], undefined)}>{pay.busy ? t('pay.paying') : t('exc.bookWithCredit')}</Button>
            </>
          )}
          <p className="muted">{t('exc.cancelRule')}</p>
        </section>
      )}

      <section aria-labelledby="mine-h">
        <h2 id="mine-h">{t('exc.booked')}</h2>
        {active.length === 0 ? <p className="muted">{t('exc.none')}</p> : (
          <ul className="card-grid">
            {active.map((b) => {
              const o = offerOf(b.excursionId)
              return (
                <li key={b.id} className="card">
                  <h3 className="card__title">{o.item.name}</h3>
                  <p><StatusBadge kind="booked" label={t('exc.status.booked')} /></p>
                  <ul className="tour__facts">
                    <li>{formatDate(o.date)} · {formatTime(o.item.start)} · {PORT_GUIDES[o.item.port].short}</li>
                    <li>{names(b.guests)}</li>
                    <li>{b.credit > 0 && b.credit === b.total ? t('exc.paidCredit', { total: formatMoney(b.total) }) : `${formatMoney(b.total)}${b.methods.length > 0 ? ` · ${b.methods.join(', ')}` : ''}`}</li>
                    <li>{t('exc.backBy', { time: formatTime(o.backBy) })}</li>
                  </ul>
                  {view.canBook && (
                    <div className="button-row">
                      {b.guests.length > 1 && <Button variant="secondary" onClick={() => setChanging(b)}>{t('exc.changeGuests')}<span className="visually-hidden"> {o.item.name}</span></Button>}
                      <Button variant="tertiary" onClick={() => setCancelling(b)}>{t('exc.cancel')}<span className="visually-hidden"> {o.item.name}</span></Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {past.length > 0 && (
          <>
            <h3>{t('exc.cancelled')}</h3>
            <ul className="plain-list">{past.map((b) => <li key={b.id}><span>{offerOf(b.excursionId).item.name}</span><span className="muted">{b.cancel.fee > 0 ? t('exc.feeKept', { fee: formatMoney(b.cancel.fee) }) : t('exc.refunded', { amount: formatMoney(b.cancel.refund) })}</span></li>)}</ul>
          </>
        )}
      </section>

      <section aria-labelledby="cat-h">
        <h2 id="cat-h">{t('exc.catalogue')}</h2>
        <div className="filters">
          <div className="field">
            <label htmlFor="f-port">{t('exc.f.port')}</label>
            <select id="f-port" value={filter.port ?? ''} onChange={(e) => set({ port: (e.target.value || null) as ExcursionPort | null })}>
              <option value="">{t('exc.f.all')}</option>
              {PORTS.map((p) => <option key={p} value={p}>{PORT_GUIDES[p].short}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-level">{t('exc.f.level')}</label>
            <select id="f-level" value={filter.maxActivity ?? ''} onChange={(e) => set({ maxActivity: (e.target.value || null) as Filter['maxActivity'] })}>
              <option value="">{t('exc.f.any')}</option>
              {ACTIVITIES.map((a) => <option key={a} value={a}>{t(`exc.level.up.${a}` as never)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-price">{t('exc.f.price')}</label>
            <select id="f-price" value={filter.maxPrice ?? ''} onChange={(e) => set({ maxPrice: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t('exc.f.any')}</option>
              {PRICES.map((p) => <option key={p} value={p}>{t('exc.f.under', { amount: `$${p}` })}</option>)}
            </select>
          </div>
        </div>
        <fieldset className="chip-row">
          <legend className="visually-hidden">{t('exc.f.interests')}</legend>
          {INTERESTS.map((i) => <Chip key={i} pressed={filter.interests.includes(i)} onToggle={() => toggle(i)}>{t(`exc.interest.${i}` as never)}</Chip>)}
          <Chip pressed={filter.family} onToggle={() => set({ family: !filter.family })}>{t('exc.f.family')}</Chip>
          <Chip pressed={filter.accessible} onToggle={() => set({ accessible: !filter.accessible })}>{t('exc.f.accessible')}</Chip>
        </fieldset>
        <p className="muted" role="status">{t('exc.count', { count: shown.length })}</p>
        {PORTS.map((p) => {
          const list = shown.filter((o) => o.item.port === p)
          if (list.length === 0) return null
          return (
            <section key={p} aria-labelledby={`port-${p}`}>
              <h3 id={`port-${p}`}>{PORT_GUIDES[p].short}</h3>
              <p className="muted">{list[0].tender ? t('exc.tender') : t('exc.pier')}</p>
              <ul className="card-grid">
                {list.map((o) => <Tour key={o.item.id} offer={o} view={view} busy={add.busy} onAdd={() => void pick(o)} />)}
              </ul>
            </section>
          )
        })}
      </section>

      {adding && (
        <GuestDialog
          title={t('exc.whoGoing', { name: adding.item.name })}
          view={view}
          initial={view.party.filter((g) => g.age >= 18).slice(0, 1).map((g) => g.id)}
          submit={t('exc.addToCart')}
          error={add.error}
          busy={add.busy}
          onClose={() => { setAdding(null); add.clear() }}
          onSubmit={async (guests) => { if (await add.run(adding.item.id, guests)) setAdding(null) }}
        />
      )}
      {changing && (
        <ChangeDialog booking={changing} view={view} reload={reload} onClose={() => setChanging(null)} />
      )}
      {cancelling && <CancelDialog booking={cancelling} offer={offerOf(cancelling.excursionId)} reload={reload} onClose={() => setCancelling(null)} />}
    </>
  )
}

function Tour({ offer, view, busy, onAdd }: { offer: ExcursionOffer; view: ExcursionsView; busy: boolean; onAdd: () => void }) {
  const x = offer.item
  const inCart = view.cart.some((l) => l.excursionId === x.id)
  const bookedBy = view.booked.filter((b) => b.excursionId === x.id && b.status === 'booked').flatMap((b) => b.guests)
  const soldOut = offer.spots === 0
  const child = guestPrice(x, 8)
  return (
    <li className="card tour">
      <h4 className="card__title">{x.name}</h4>
      <p>{x.summary}</p>
      <p className="tour__price">{formatMoney(x.price)} <span className="muted">{t('exc.perAdult')}{child < x.price ? ` · ${t('exc.child', { price: formatMoney(child) })}` : ''}</span></p>
      <ul className="tour__facts">
        <li>{formatDate(offer.date)} · {t('exc.start', { time: formatTime(x.start) })} · {formatHours(x.hours)}</li>
        <li>{t('exc.backBy', { time: formatTime(offer.backBy) })}</li>
        <li>{t(`exc.level.${x.activity}` as never)}{x.wheelchair ? ` · ${t('exc.wheelchair')}` : ` · ${t('exc.noWheelchair')}`}</li>
        <li>{t('exc.rating', { rating: x.rating.toFixed(1), reviews: x.reviews.toLocaleString('en-US') })}</li>
        <li>{x.meeting}</li>
      </ul>
      <p>
        {soldOut ? <StatusBadge kind="soldOut" label={t('exc.soldOut')} /> : offer.spots <= 8 ? <StatusBadge kind="waitlist" label={t('exc.fewLeft', { count: offer.spots })} /> : <StatusBadge kind="ready" label={t('exc.available')} />}
        {bookedBy.length > 0 && <> <StatusBadge kind="booked" label={t('exc.youBooked', { names: names(bookedBy) })} /></>}
      </p>
      {offer.timing && <p className="field__error">{t(`exc.timing.${offer.timing}` as never)}</p>}
      {view.canBook && !soldOut && !offer.timing && (
        <Button variant="secondary" disabled={busy || inCart} onClick={onAdd}>{inCart ? t('exc.inCart') : t('exc.add')}<span className="visually-hidden"> {x.name}</span></Button>
      )}
      <SaveButton saveKey={`excursion:${x.id}`} name={x.name} />
    </li>
  )
}

function GuestDialog({ title, view, initial, submit, error, busy, onClose, onSubmit }: { title: string; view: ExcursionsView; initial: PersonaId[]; submit: string; error: ReturnType<typeof useAction>['error']; busy: boolean; onClose: () => void; onSubmit: (guests: PersonaId[]) => Promise<void> }) {
  const [guests, setGuests] = useState<PersonaId[]>(initial)
  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void onSubmit(guests) }}>
        <GuestPicker legend={t('exc.who')} party={view.party} value={guests} onChange={setGuests} hint={t('exc.whoHint')} />
        <PlanError error={error} />
        <div className="button-row">
          <Button type="submit" disabled={busy || guests.length === 0}>{submit}</Button>
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
        </div>
      </form>
    </Dialog>
  )
}

function ChangeDialog({ booking, view, reload, onClose }: { booking: TourBooking; view: ExcursionsView; reload: () => void; onClose: () => void }) {
  const change = useAction(async (guests: PersonaId[]) => { const v = await api.plan.excursions.changeGuests(booking.id, guests); reload(); return v })
  const here = view.party.filter((g) => booking.guests.includes(g.id))
  return (
    <GuestDialog
      title={t('exc.changeTitle')}
      view={{ ...view, party: here }}
      initial={booking.guests}
      submit={t('exc.saveGuests')}
      error={change.error}
      busy={change.busy}
      onClose={onClose}
      onSubmit={async (guests) => { if (await change.run(guests)) onClose() }}
    />
  )
}

function CancelDialog({ booking, offer, reload, onClose }: { booking: TourBooking; offer: ExcursionOffer; reload: () => void; onClose: () => void }) {
  const cancel = useAction(async () => { const v = await api.plan.excursions.cancel(booking.id); reload(); return v })
  const free = booking.cancel.free
  return (
    <Dialog title={t('exc.cancelTitle', { name: offer.item.name })} onClose={onClose}>
      {free ? <p>{t('exc.cancelFree', { amount: formatMoney(booking.cancel.refund) })}</p> : <Banner kind="warning" title={t('exc.cancelLate', { fee: formatMoney(booking.cancel.fee) })}><p>{t('exc.cancelLateBody')}</p></Banner>}
      <PlanError error={cancel.error} />
      <div className="button-row">
        <Button variant="danger" disabled={cancel.busy} onClick={async () => { if (await cancel.run()) onClose() }}>{cancel.busy ? t('account.saving') : t('exc.cancelConfirm')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('exc.keep')}</Button>
      </div>
    </Dialog>
  )
}

