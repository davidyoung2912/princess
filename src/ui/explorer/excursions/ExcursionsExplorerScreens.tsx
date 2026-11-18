import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { readUrlFilter } from '../../../domain/explorer/urlFilter'
import { tourKey } from '../../../domain/explorer/shortlist'
import { SaveButton } from '../SaveButton'
import type { ExcursionOffer, ExcursionsView, TourBooking } from '../../../api/types'
import { formatDate, formatTime } from '../../../domain/cruise'
import { bookingsOnDay, planKey, filterDayOffers, nearestTourDay, NO_DAY_FILTER, offersOnDay, type DayFilter } from '../../../domain/explorer/excursionDay'
import { ACTIVITIES, formatHours, guestPrice, INTERESTS, type Interest } from '../../../domain/excursions'
import { excursionBookingCard } from '../../../domain/explorer/bookingState'
import { shortDate } from '../../../domain/explorer/presentation'
import { difficultyConcerns } from '../../../domain/planning'
import { itinerary } from '../../../domain/sailings'
import { formatMoney } from '../../../domain/money'
import type { PersonaId } from '../../../domain/people'
import { useAction } from '../../../hooks/useAction'
import { useExplorerDay, type ExplorerDayState } from '../../../hooks/useExplorer'
import { useSailing } from '../../../hooks/useDemo'
import { lockedWhenOver } from '../../../domain/explorer/finished'
import { useExplorerStage } from '../../../hooks/useExplorerStage'
import { useMemory } from '../../../hooks/useMemory'
import { useMine } from '../../../hooks/useMine'
import { useReservationScope } from '../../../hooks/useReservationScope'
import { t, th, headingCase, type StringKey } from '../../../i18n'
import { api } from '../../../runtime'
import { Button, LinkButton } from '../../Button'
import { Card } from '../../Card'
import { Chip } from '../../Chip'
import { StatusBadge } from '../../StatusBadge'
import { Load } from '../../account/parts'
import { StanleyTourCompare } from '../../plan/StanleyTourCompare'
import { TourFit } from './TourFit'
import { BookingCard } from '../BookingCard'
import { ReservationScope } from '../ReservationScope'
import { BackLink } from '../../onboard/common'
import { SendToChat } from '../../onboard/SendToChat'
import { names } from '../../plan/people'
import { PlanError, ReadOnly } from '../../plan/common'
import { CreditBanner, ExcursionCart } from '../../plan/ExcursionCart'
import { CancelDialog, ChangeDialog, GuestDialog } from './TourDialogs'
import { portLabel } from '../../plan/portLabel'
import { PickDateButton } from '../DateControls'
import { ShipClockCard, ShipDayInfo } from '../ShipClockCard'

const BASE = '/excursions-explorer'

/** Add to the cart, asking who is going when the party is more than one. Paying is in the cart on this page. */
function useCart(view: ExcursionsView | null, reload: () => void) {
  const [adding, setAdding] = useState<ExcursionOffer | null>(null)
  const add = useAction(async (id: string, guests: PersonaId[]) => { const v = await api.plan.excursions.addToCart(id, guests); reload(); return v })
  const pick = async (o: ExcursionOffer) => {
    if (view?.party.length === 1) { await add.run(o.item.id, [view.party[0].id]); return }
    setAdding(o)
  }
  const dialog = adding && view && (
    <GuestDialog
      title={t('exc.whoGoing', { name: adding.item.name })} view={view} initial={view.party.filter((g) => g.age >= 18).slice(0, 1).map((g) => g.id)}
      submit={t('exc.addToCart')} error={add.error} busy={add.busy} onClose={() => { setAdding(null); add.clear() }}
      onSubmit={async (guests) => { if (await add.run(adding.item.id, guests)) setAdding(null) }}
    />
  )
  return { pick, busy: add.busy, error: add.error, dialog }
}

type Editing = { kind: 'change' | 'cancel'; booking: TourBooking }

/** One booked tour with Change guests and Cancel; the dialogs open from `edit`. */
function BookedTour({ view, booking: b, offer: o, day, link, edit }: { view: ExcursionsView; booking: TourBooking; offer: ExcursionOffer; day: number; link: boolean; edit: (e: Editing) => void }) {
  return (
    <li className="card">
      <h3 className="card__title">{link ? <Link className="exp-card__link" to={`${BASE}/${o.item.id}?day=${day}`}>{o.item.name}</Link> : o.item.name}</h3>
      <p><StatusBadge kind="booked" label={t('exc.status.booked')} /></p>
      <ul className="tour__facts">
        <li>{formatTime(o.item.start)} · {portLabel(o.item.port)} · {t('exc.backBy', { time: formatTime(o.backBy) })}</li>
        <li>{names(b.guests)} · {b.credit > 0 && b.credit === b.total ? t('exc.paidCredit', { total: formatMoney(b.total) }) : formatMoney(b.total)}</li>
      </ul>
      <SendToChat shareRef={`excursion:${b.id}`} title={o.item.name} />
      {view.canBook && (
        <div className="button-row">
          {b.guests.length > 1 && <Button variant="secondary" onClick={() => edit({ kind: 'change', booking: b })}>{t('exc.changeGuests')}<span className="visually-hidden"> {o.item.name}</span></Button>}
          <Button variant="tertiary" onClick={() => edit({ kind: 'cancel', booking: b })}>{t('exc.cancel')}<span className="visually-hidden"> {o.item.name}</span></Button>
        </div>
      )}
    </li>
  )
}

function EditDialogs({ view, editing, reload, close }: { view: ExcursionsView; editing: Editing | null; reload: () => void; close: () => void }) {
  if (editing?.kind === 'change') return <ChangeDialog booking={editing.booking} view={view} reload={reload} onClose={close} />
  if (editing?.kind === 'cancel') return <CancelDialog booking={editing.booking} offer={view.offers.find((o) => o.item.id === editing.booking.excursionId)!} reload={reload} onClose={close} />
  return null
}

/** The guest's own excursions for the day, with Change guests and Cancel; and a link to the cart when something waits there. */
function MyDay({ view, day, reload, only }: { view: ExcursionsView; day: number; reload: () => void; only?: string }) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const mine = bookingsOnDay(view, day).filter((x) => !only || x.offer.item.id === only)
  return (
    <section aria-labelledby="exx-mine-h">
      <h2 id="exx-mine-h">{headingCase(only ? t('exx.mineHere') : t('exx.mine'))}</h2>
      {mine.length === 0 ? <p className="muted">{only ? t('exx.noneHere') : t('exx.none')}</p> : (
        <ul className="card-grid">
          {mine.map(({ booking, offer }) => <BookedTour key={booking.id} view={view} booking={booking} offer={offer} day={day} link={!only} edit={setEditing} />)}
        </ul>
      )}
      <EditDialogs view={view} editing={editing} reload={reload} close={() => setEditing(null)} />
    </section>
  )
}

/**
 * Whole trip: every day of the cruise with the tours booked on it and a way to see what runs there. Before sailing this is the page for tours,
 * so the cart, the credit and Pay sit above it exactly as on a single day.
 */
function TripTours({ view, state, reload }: { view: ExcursionsView; state: ExplorerDayState; reload: () => void }) {
  const sailing = useSailing()
  const days = itinerary(sailing)
  const [editing, setEditing] = useState<Editing | null>(null)
  const active = view.booked.filter((b) => b.status === 'booked')
  const past = view.booked.filter((b) => b.status === 'cancelled')
  const offerOf = (id: string) => view.offers.find((o) => o.item.id === id)!
  const tourDays = [...new Set([...view.offers.map((o) => o.day), ...active.map((b) => offerOf(b.excursionId).day)])].sort((a, b) => a - b)
  const [, setScope] = useReservationScope()
  const open = (n: number) => { state.setDay(n); setScope('day') }
  return (
    <section aria-labelledby="exx-trip-h">
      <h2 id="exx-trip-h">{headingCase(t('exp.trip.title'))}</h2>
      {active.length === 0 && <p className="muted">{t('exc.none')}</p>}
      {tourDays.map((n) => {
        const here = bookingsOnDay(view, n)
        const offers = offersOnDay(view.offers, n)
        const heading = `${t('plan.day', { n })} · ${shortDate(days[n - 1]?.date ?? days[0].date)}${offers[0] ? ` · ${portLabel(offers[0].item.port)}` : ''}`
        return (
          <div key={n} className="exp-trip__day">
            <h3 id={`exx-trip-${n}`}>{heading}</h3>
            {here.length > 0 && <ul className="card-grid">{here.map(({ booking, offer }) => <BookedTour key={booking.id} view={view} booking={booking} offer={offer} day={n} link edit={setEditing} />)}</ul>}
            {offers.length > 0 && (
              <p className="exp-trip__none">
                <span className="muted">{t('exp.trip.toursIn', { count: offers.length, port: portLabel(offers[0].item.port) })}</span>
                <Button variant="secondary" onClick={() => open(n)}>{t('exp.trip.bookTour')}<span className="visually-hidden"> {heading}</span></Button>
              </p>
            )}
          </div>
        )
      })}
      {past.length > 0 && (
        <>
          <h3>{th('exc.cancelled')}</h3>
          <ul className="plain-list">{past.map((b) => <li key={b.id}><span>{offerOf(b.excursionId).item.name}</span><span className="muted">{b.cancel.fee > 0 ? t('exc.feeKept', { fee: formatMoney(b.cancel.fee) }) : t('exc.refunded', { amount: formatMoney(b.cancel.refund) })}</span></li>)}</ul>
        </>
      )}
      <EditDialogs view={view} editing={editing} reload={reload} close={() => setEditing(null)} />
    </section>
  )
}

/** Adds an excursion to Today's Plan (as not booked yet) or takes it off again. Booking it puts it there for good. */
function PlanToggle({ offer, view }: { offer: ExcursionOffer; view: ExcursionsView }) {
  const saved = useMine(() => api.ahead.saved.list())
  const key = planKey(offer.item.id)
  const toggle = useAction(async () => { await api.ahead.saved.toggle(key); saved.retry() })
  const booked = view.booked.some((b) => b.excursionId === offer.item.id && b.status === 'booked')
  if (booked) return null
  const on = saved.data?.includes(key) ?? false
  return (
    <Button variant="tertiary" aria-pressed={on} disabled={toggle.busy || saved.status !== 'ready'} onClick={() => void toggle.run()}>
      {on ? t('exx.inPlan') : t('exx.addPlan')}<span className="visually-hidden"> {offer.item.name}</span>
    </Button>
  )
}

/** One line of what is bookable: the badge for places left, and whether it is booked or in the cart. */
function Availability({ offer, view }: { offer: ExcursionOffer; view: ExcursionsView }) {
  const bookedBy = view.booked.filter((b) => b.excursionId === offer.item.id && b.status === 'booked').flatMap((b) => b.guests)
  return (
    <p>
      {offer.spots === 0 ? <StatusBadge kind="soldOut" label={t('exc.soldOut')} /> : offer.spots <= 8 ? <StatusBadge kind="waitlist" label={t('exc.fewLeft', { count: offer.spots })} /> : <StatusBadge kind="ready" label={t('exc.available')} />}
      {bookedBy.length > 0 && <> <StatusBadge kind="booked" label={t('exc.youBooked', { names: names(bookedBy) })} /></>}
    </p>
  )
}

function DayHeading({ state }: { state: ExplorerDayState }) {
  return (
    <>
      <ShipClockCard state={state} />
      <PickDateButton state={state} />
    </>
  )
}

/** The Excursions Explorer: your shore excursions for the day you pick, then what runs in port that day. */
export function ExcursionsExplorerScreen() {
  const state = useExplorerDay()
  const { stage } = useExplorerStage()
  const view = useMine(() => api.plan.excursions.list())
  return (
    <div className="page">
      <DayHeading state={state} />
      <Load state={view}>{(v) => <List view={lockedWhenOver(v, stage)} state={state} reload={view.retry} />}</Load>
    </div>
  )
}

function List({ view, state, reload }: { view: ExcursionsView; state: ExplorerDayState; reload: () => void }) {
  const [params] = useSearchParams()
  const [start] = useState(() => readUrlFilter(params))
  const [filter, setFilter] = useState<DayFilter>(() => ({ ...NO_DAY_FILTER, interest: (INTERESTS as readonly string[]).includes(start.type ?? '') ? (start.type as Interest) : null }))
  const [suits, setSuits] = useState(false)
  const { state: mem } = useMemory()
  const { stage } = useExplorerStage()
  const [scope, setScope] = useReservationScope()
  const sailing = useSailing()
  const cart = useCart(view, reload)
  const today = offersOnDay(view.offers, state.day)
  const shown = filterDayOffers(today, filter).filter((x) => !suits || difficultyConcerns(x.item, mem.access).length === 0)
  const set = (change: Partial<DayFilter>) => setFilter({ ...filter, ...change })
  const other = today.length === 0 ? nearestTourDay(view.offers, state.day) : null
  return (
    <>
      <ReadOnly canDo={view.canBook} />
      <PlanError error={cart.error} />
      <CreditBanner view={view} />
      <BookingCard model={excursionBookingCard(view, stage)} labelledBy="exx-book-h" />
      <StanleyTourCompare sailingId={sailing.id} />
      <ExcursionCart view={view} reload={reload} headingId="exx-cart-h" />
      <TourFit view={view} busy={cart.busy} onAdd={(o) => void cart.pick(o)} />
      <ReservationScope scope={scope} onChange={setScope} />
      {scope === 'trip' ? <TripTours view={view} state={state} reload={reload} /> : <MyDay view={view} day={state.day} reload={reload} />}
      {scope === 'day' && <section aria-labelledby="exx-list-h">
        <h2 id="exx-list-h">{headingCase(t('exx.list'))}</h2>
        {today.length === 0 ? (
          <>
            <p className="muted">{t('exx.noTours')}</p>
            {other !== null && <p><Button variant="secondary" onClick={() => state.setDay(other)}>{t('exx.goToDay', { day: other })}</Button></p>}
          </>
        ) : (
          <>
            <p className="muted">{portLabel(today[0].item.port)} · {today[0].tender ? t('exc.tender') : t('exc.pier')}</p>
            <fieldset className="chip-row">
              <legend className="visually-hidden">{t('exc.f.interests')}</legend>
              {INTERESTS.map((i: Interest) => <Chip key={i} pressed={filter.interest === i} onToggle={() => set({ interest: filter.interest === i ? null : i })}>{t(`exc.interest.${i}` as StringKey)}</Chip>)}
              <Chip pressed={filter.maxActivity === ACTIVITIES[0]} onToggle={() => set({ maxActivity: filter.maxActivity ? null : ACTIVITIES[0] })}>{t('exx.easyOnly')}</Chip>
              <Chip pressed={filter.family} onToggle={() => set({ family: !filter.family })}>{t('exc.f.family')}</Chip>
              <Chip pressed={filter.accessible} onToggle={() => set({ accessible: !filter.accessible })}>{t('exc.f.accessible')}</Chip>
              <Chip pressed={suits} onToggle={() => setSuits(!suits)}>{t('exc.f.suits')}</Chip>
            </fieldset>
            <p className="muted" role="status">{t('exc.count', { count: shown.length })}</p>
            <ul className="card-grid">
              {shown.map((o) => <OfferCard key={o.item.id} offer={o} view={view} day={state.day} busy={cart.busy} concerns={difficultyConcerns(o.item, mem.access)} onAdd={() => void cart.pick(o)} />)}
            </ul>
          </>
        )}
      </section>}
      {cart.dialog}
    </>
  )
}

function OfferCard({ offer, view, day, busy, onAdd, concerns }: { offer: ExcursionOffer; view: ExcursionsView; day: number; busy: boolean; onAdd: () => void; concerns: string[] }) {
  const x = offer.item
  const inCart = view.cart.some((l) => l.excursionId === x.id)
  return (
    <li className="card exp-card">
      <h3 className="card__title"><Link className="exp-card__link" to={`${BASE}/${x.id}?day=${day}`}>{x.name}</Link></h3>
      <p className="muted">{portLabel(x.port)} · {formatTime(x.start)} · {formatHours(x.hours)}</p>
      <p>{x.summary}</p>
      <p className="tour__price">{formatMoney(x.price)} <span className="muted">{t('exc.perAdult')}</span></p>
      {concerns.length > 0 && (
        <div className="explain">
          <p><strong>{t('exc.concerns')}</strong></p>
          <ul className="plain-bullets">{concerns.map((c) => <li key={c}>{t(`diff.concern.${c}` as StringKey)}</li>)}</ul>
        </div>
      )}
      <Availability offer={offer} view={view} />
      {offer.timing && <p className="field__error">{t(`exc.timing.${offer.timing}` as StringKey)}</p>}
      <div className="button-row">
        {view.canBook && offer.spots > 0 && !offer.timing && (
          <Button variant="secondary" disabled={busy || inCart} onClick={onAdd}>{inCart ? t('exc.inCart') : t('exc.add')}<span className="visually-hidden"> {x.name}</span></Button>
        )}
        <PlanToggle offer={offer} view={view} />
        <SaveButton itemKey={tourKey(x.id)} title={x.name} />
      </div>
    </li>
  )
}

/** One excursion: when and where, what it asks of you, the price, your booking and the way to add it to the cart. */
export function ExcursionsVenueScreen() {
  const { venueId = '' } = useParams()
  const state = useExplorerDay()
  const { stage } = useExplorerStage()
  const view = useMine(() => api.plan.excursions.list())
  return (
    <div className="page">
      <Load state={view}>{(v) => {
        const offer = v.offers.find((o) => o.item.id === venueId)
        return offer ? <Detail offer={offer} view={lockedWhenOver(v, stage)} state={state} reload={view.retry} /> : <Gone state={state} />
      }}</Load>
      <BackLink to={`${BASE}?day=${state.day}`} label={t('route.excursionsExplorer')} />
    </div>
  )
}

function Gone({ state }: { state: ExplorerDayState }) {
  return (
    <>
      <DayHeading state={state} />
      <p>{t('exx.gone')}</p>
      <LinkButton to={BASE} variant="secondary">{t('route.excursionsExplorer')}</LinkButton>
    </>
  )
}

function Detail({ offer, view, state, reload }: { offer: ExcursionOffer; view: ExcursionsView; state: ExplorerDayState; reload: () => void }) {
  const x = offer.item
  const cart = useCart(view, reload)
  const inCart = view.cart.some((l) => l.excursionId === x.id)
  const child = guestPrice(x, 8)
  return (
    <>
      <Card hero labelledBy="exx-h">
        <h2 id="exx-h" className="card__title">{x.name}</h2>
        <p className="muted">{portLabel(x.port)} · {formatDate(offer.date)}</p>
        <ShipDayInfo state={state} />
      </Card>
      <PickDateButton state={state} />
      <ReadOnly canDo={view.canBook} />
      <PlanError error={cart.error} />
      <CreditBanner view={view} />
      <ExcursionCart view={view} reload={reload} headingId="exx-cart-h" />
      <MyDay view={view} day={offer.day} reload={reload} only={x.id} />
      <section aria-labelledby="exx-about-h">
        <h2 id="exx-about-h">{headingCase(t('exx.about'))}</h2>
        <p>{x.summary}</p>
        <p className="tour__price">{formatMoney(x.price)} <span className="muted">{t('exc.perAdult')}{child < x.price ? ` · ${t('exc.child', { price: formatMoney(child) })}` : ''}</span></p>
        <Availability offer={offer} view={view} />
        <ul className="tour__facts">
          <li>{t('exc.start', { time: formatTime(x.start) })} · {formatHours(x.hours)} · {t('exc.backBy', { time: formatTime(offer.backBy) })}</li>
          <li>{offer.tender ? t('exc.tender') : t('exc.pier')}</li>
          <li>{t('exc.exertion', { level: t(`exc.level.${x.activity}` as StringKey) })}{x.wheelchair ? ` · ${t('exc.wheelchair')}` : ` · ${t('exc.noWheelchair')}`}</li>
          {x.wheelchair && x.confirmAccess && <li>{t('exc.confirmAccess')}</li>}
          <li>{t('exc.rating', { rating: x.rating.toFixed(1), reviews: x.reviews.toLocaleString('en-US') })}</li>
          <li>{x.meeting}</li>
        </ul>
        {offer.timing && <p className="field__error">{t(`exc.timing.${offer.timing}` as StringKey)}</p>}
        {view.canBook && offer.spots > 0 && !offer.timing && (
          <Button disabled={cart.busy || inCart} onClick={() => void cart.pick(offer)}>{inCart ? t('exc.inCart') : t('exc.add')}<span className="visually-hidden"> {x.name}</span></Button>
        )}
        <PlanToggle offer={offer} view={view} />
      </section>
      {cart.dialog}
    </>
  )
}
