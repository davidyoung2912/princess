import { useEffect, useState } from 'react'
import type { HelpedGuest } from '../../api/types'
import { BRAND_NAMES, validateCard } from '../../domain/account'
import { formatDate } from '../../domain/cruise'
import { folioTotals } from '../../domain/folio'
import { formatMoney } from '../../domain/money'
import { dateIn } from '../../domain/timezones'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useNow } from '../../hooks/useDemo'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { LoadError } from '../discover/parts'
import { ActionError } from './parts'

/** People you help (BM8): the guests who made you their helper, and, with their Payments permission, paying their balance with their own saved card. Shown only when someone has. */
export function HelpingCard() {
  const list = useMine(() => api.helping.list())
  const { retry } = list
  useEffect(() => {
    window.addEventListener('princess:helping-changed', retry)
    return () => window.removeEventListener('princess:helping-changed', retry)
  }, [retry])
  if (!list.data || list.data.length === 0) return null
  return (
    <Card labelledBy="helping-h">
      <h2 id="helping-h">{th('helping.title')}</h2>
      <p>{t('helping.intro')}</p>
      <ul className="plain-list">{list.data.map((g) => <li key={g.guestId}><Guest guest={g} /></li>)}</ul>
    </Card>
  )
}

function Guest({ guest }: { guest: HelpedGuest }) {
  const [open, setOpen] = useState(false)
  const [folio, setFolio] = useState(false)
  const canPay = guest.permissions.includes('payments')
  const canFolio = guest.permissions.includes('folio')
  const canCheckin = guest.permissions.includes('checkin')
  const [checkin, setCheckin] = useState(false)
  const canTrip = guest.permissions.includes('trip')
  const [trip, setTrip] = useState(false)
  return (
    <>
      <strong>{guest.name}</strong> <span className="muted">{guest.relationship}</span>
      {guest.booking && canPay && <div><Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{t(open ? 'helping.hide' : 'helping.open', { name: guest.name })}</Button></div>}
      {open && guest.booking && canPay && <GuestPayments guest={guest} booking={guest.booking} />}
      {guest.booking && canFolio && <div><Button variant="secondary" aria-expanded={folio} onClick={() => setFolio(!folio)}>{t(folio ? 'helping.folioHide' : 'helping.folioOpen', { name: guest.name })}</Button></div>}
      {folio && guest.booking && canFolio && <GuestFolio guest={guest} booking={guest.booking} />}
      {guest.booking && canCheckin && <div><Button variant="secondary" aria-expanded={checkin} onClick={() => setCheckin(!checkin)}>{t(checkin ? 'helping.checkinHide' : 'helping.checkinOpen', { name: guest.name })}</Button></div>}
      {checkin && guest.booking && canCheckin && <GuestCheckin guest={guest} booking={guest.booking} />}
      {guest.booking && canTrip && <div><Button variant="secondary" aria-expanded={trip} onClick={() => setTrip(!trip)}>{t(trip ? 'helping.tripHide' : 'helping.tripOpen', { name: guest.name })}</Button></div>}
      {trip && guest.booking && canTrip && <GuestTrip guest={guest} booking={guest.booking} />}
      {!guest.booking && <p className="muted">{t('helping.noAccess', { name: guest.name })}</p>}
    </>
  )
}

/** Which sailing the guest is on. Read only; no prices, documents or check-in. */
function GuestTrip({ guest, booking }: { guest: HelpedGuest; booking: string }) {
  const view = useMine(() => api.helping.trip(guest.guestId, booking), [guest.guestId, booking])
  if (!view.data) return view.status === 'error' ? <LoadError retry={view.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>
  const v = view.data
  return <p>{t('helping.trip.summary', { name: guest.name, date: formatDate(v.departure), days: v.daysToDeparture, category: v.categoryName, guests: v.guests, number: v.number })}</p>
}

/** How far the guest's check-in has got. Read only; no documents or answers. */
function GuestCheckin({ guest, booking }: { guest: HelpedGuest; booking: string }) {
  const view = useMine(() => api.helping.checkin(guest.guestId, booking), [guest.guestId, booking])
  if (!view.data) return view.status === 'error' ? <LoadError retry={view.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>
  const c = view.data
  const day = (ms: number) => formatDate(dateIn(ms, 'UTC'))
  return <p>{t(`helping.checkin.${c.state}` as StringKey, { name: guest.name, date: day(c.state === 'notOpen' ? c.opensAt : c.closesAt) })}</p>
}

/** The guest's onboard account, read only: the balance and the latest lines. */
function GuestFolio({ guest, booking }: { guest: HelpedGuest; booking: string }) {
  const view = useMine(() => api.helping.folio(guest.guestId, booking), [guest.guestId, booking])
  if (!view.data) return view.status === 'error' ? <LoadError retry={view.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>
  const f = view.data
  if (f.lines.length === 0) return <p>{t('helping.folioNotYet', { name: guest.name })}</p>
  return (
    <div>
      <p>{t('helping.folioTotal', { name: guest.name, amount: formatMoney(folioTotals(f.lines).balance), day: f.throughDay })}</p>
      <ul className="plain-list">{f.lines.slice(-10).reverse().map((l) => <li key={l.id}>{l.description} <span className="muted">{formatMoney(l.cents)}</span></li>)}</ul>
    </div>
  )
}

function GuestPayments({ guest, booking }: { guest: HelpedGuest; booking: string }) {
  const view = useMine(() => api.helping.payments(guest.guestId, booking), [guest.guestId, booking])
  const now = useNow()
  const today = dateIn(now, 'America/New_York')
  const [cardId, setCardId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [paid, setPaid] = useState(false)
  const pay = useAction((id: string) => api.helping.payBalance(guest.guestId, booking, id))

  if (!view.data) return view.status === 'error' ? <LoadError retry={view.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>
  const { trip, cards } = view.data
  const usable = cards.filter((c) => !validateCard(c.last4, c.expiry, today))
  const chosen = usable.find((c) => c.id === cardId) ?? usable[0]
  const owing = trip.payment !== 'paid'
  const go = async () => { if (chosen && (await pay.run(chosen.id))) { setConfirming(false); setPaid(true); view.retry() } }
  return (
    <div>
      <p role="status">{paid ? t('helping.paid', { name: guest.name }) : ''}</p>
      {owing ? (
        <>
          <p>{t('helping.owes', { name: guest.name, amount: formatMoney(trip.plan.balance), date: formatDate(trip.plan.finalDue) })}</p>
          {chosen ? (
            <>
              <fieldset>
                <legend>{t('helping.chooseCard', { name: guest.name })}</legend>
                {usable.map((c) => <label key={c.id} className="choice"><input type="radio" name={`card-${guest.guestId}`} checked={chosen.id === c.id} onChange={() => setCardId(c.id)} /><span>{BRAND_NAMES[c.brand]} {t('pay.ending', { last4: c.last4 })}</span></label>)}
              </fieldset>
              <Button onClick={() => setConfirming(true)}>{t('pay.payButton', { amount: formatMoney(trip.plan.balance) })}</Button>
            </>
          ) : <Banner kind="warning" title={t('helping.noCard', { name: guest.name })} />}
        </>
      ) : <p>{t('helping.settled', { name: guest.name })}</p>}
      {confirming && chosen && (
        <Dialog title={t('helping.confirmTitle')} onClose={() => setConfirming(false)}>
          <p>{t('helping.confirmBody', { amount: formatMoney(trip.plan.balance), name: guest.name, card: `${BRAND_NAMES[chosen.brand]} ${t('pay.ending', { last4: chosen.last4 })}` })}</p>
          <ActionError error={pay.error} />
          <div className="button-row">
            <Button disabled={pay.busy} onClick={() => void go()}>{pay.busy ? t('pay.paying') : t('pay.confirm')}</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>{t('data.cancel')}</Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
