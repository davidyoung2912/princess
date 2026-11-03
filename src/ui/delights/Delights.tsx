import { useState } from 'react'
import {
  chargeReminderTime, groupBookingNumber, LAST_LOOK_ITEMS, lastLookLeft, nameWarnings, OOO_TONES, outOfOffice, pricePer, PRICE_UNITS, shipInFamiliarTerms,
  ticketName, tippingNorm, watchGap, type OooTone, type PriceUnit,
} from '../../domain/delights'
import { formatDate } from '../../domain/cruise'
import { sailingNights, shipZoneAt } from '../../domain/sailings'
import { SHIP } from '../../domain/ship'
import { TERMINALS } from '../../domain/boarding'
import { addDays, timeIn } from '../../domain/timezones'
import { useNow, useSailing } from '../../hooks/useDemo'
import { formatMoney } from '../../domain/money'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { CopyText } from '../CopyText'
import { Field } from '../Field'

/** D2-1, D2-2: how the name will print, and gentle hints that it may not match a passport. Never blocks. */
export function NameCheck({ first, last }: { first: string; last: string }) {
  const printed = ticketName(first, last)
  const warns = nameWarnings(first, last)
  if (!printed) return null
  return (
    <div className="field__hint" role="status">
      <p>{t('dl.name.printed', { name: printed })}</p>
      {warns.length > 0 && (
        <>
          <ul>{warns.map((w) => <li key={w}>{t(`dl.name.warn.${w}` as StringKey)}</li>)}</ul>
          <p>{t('dl.name.hint')}</p>
        </>
      )}
    </div>
  )
}

/** D2-3: the booking number in groups, readable aloud, with a copy button. */
export function BookingNumber({ number }: { number: string }) {
  const g = groupBookingNumber(number)
  const [note, setNote] = useState('')
  return (
    <>
      <p className="booking-number" aria-label={t('dl.booking.spoken', { spoken: g.spoken })}>{g.display}</p>
      <Button variant="tertiary" onClick={() => { navigator.clipboard.writeText(g.raw).then(() => setNote(t('dl.copied')), () => setNote(t('dl.copyFailed'))) }}>{t('dl.booking.copy')}</Button>
      <p className="muted" role="status">{note}</p>
    </>
  )
}

/** D1-1: the ship in familiar terms. */
export function ShipTerms() {
  const f = shipInFamiliarTerms(SHIP.length, SHIP.guests, SHIP.crew)
  if (f.pitches === 0) return null
  return (
    <Card info labelledBy="dl-ship-h">
      <h2 id="dl-ship-h" className="card__title">{th('dl.ship.title')}</h2>
      <p>{t('dl.ship.length', { count: f.pitches, town: new Intl.NumberFormat('en-US').format(f.town) })}</p>
    </Card>
  )
}

/** D1-3: the quoted total as a whole, per person, or per person per night. */
export function PriceUnitLine({ total, guests, nights }: { total: number; guests: number; nights: number }) {
  const [unit, setUnit] = useState<PriceUnit>('total')
  if (!(total > 0)) return null
  return (
    <fieldset>
      <legend>{t('dl.unit.legend')}</legend>
      {PRICE_UNITS.map((u) => <label key={u} className="choice"><input type="radio" name="dl-unit" checked={unit === u} onChange={() => setUnit(u)} /><span>{t(`dl.unit.${u}` as StringKey)}</span></label>)}
      <p role="status">{t('dl.unit.line', { amount: formatMoney(pricePer(total, guests, nights, unit)), unit: t(`dl.unit.each.${unit}` as StringKey) })}</p>
    </fieldset>
  )
}

/** D6A-5: what is customary for tipping where the port is. */
export function TippingCard({ port }: { port: string }) {
  const n = tippingNorm(port)
  if (!n) return null
  return (
    <Card labelledBy="dl-tip-h">
      <h2 id="dl-tip-h" className="card__title">{th('dl.tip.title', { country: n.country })}</h2>
      <ul>
        <li>{t(`dl.tip.included.${n.serviceIncluded}` as StringKey)}</li>
        <li>{t('dl.tip.restaurant', { percent: n.restaurantPercent })}</li>
        <li>{t(`dl.tip.taxi.${n.taxi}` as StringKey)}</li>
        {n.dollarsAccepted && <li>{t('dl.tip.dollars')}</li>}
      </ul>
      <p className="muted">{t('dl.tip.verify')}</p>
    </Card>
  )
}

/** D3-7: an out-of-office text for the guest's own email. */
export function OutOfOfficeCard() {
  const sailing = useSailing()
  const [name, setName] = useState('')
  const [tone, setTone] = useState<OooTone>('friendly')
  const back = formatDate(addDays(sailing.departure, sailingNights(sailing)))
  const templates = { friendly: t('dl.ooo.text.friendly'), formal: t('dl.ooo.text.formal'), brief: t('dl.ooo.text.brief') }
  return (
    <Card labelledBy="dl-ooo-h">
      <h2 id="dl-ooo-h" className="card__title">{th('dl.ooo.title')}</h2>
      <p>{t('dl.ooo.intro')}</p>
      <Field label={t('dl.ooo.name')} value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      <fieldset>
        <legend>{t('dl.ooo.tone')}</legend>
        {OOO_TONES.map((o) => <label key={o} className="choice"><input type="radio" name="dl-ooo-tone" checked={tone === o} onChange={() => setTone(o)} /><span>{t(`dl.ooo.tone.${o}` as StringKey)}</span></label>)}
      </fieldset>
      <CopyText text={outOfOffice(templates, tone, name, back)} />
    </Card>
  )
}

/** D4A-3: six things to glance at before leaving home. Not saved. */
export function LastLookCard() {
  const [ticked, setTicked] = useState<string[]>([])
  const { left, ready } = lastLookLeft(ticked)
  return (
    <Card labelledBy="dl-look-h">
      <h2 id="dl-look-h" className="card__title">{th('dl.look.title')}</h2>
      <p>{t('dl.look.intro')}</p>
      {LAST_LOOK_ITEMS.map((i) => (
        <label key={i} className="choice"><input type="checkbox" checked={ticked.includes(i)} onChange={(e) => setTicked((s) => (e.target.checked ? [...s, i] : s.filter((x) => x !== i)))} /><span>{t(`dl.look.item.${i}` as StringKey)}</span></label>
      ))}
      <p role="status">{ready ? t('dl.look.ready') : t('dl.look.left', { count: left })}</p>
    </Card>
  )
}

/** D4A-4: a ready-to-send "I have arrived" message. */
export function ArrivedCard() {
  return (
    <Card labelledBy="dl-arr-h">
      <h2 id="dl-arr-h" className="card__title">{th('dl.arrived.title')}</h2>
      <CopyText text={t('dl.arrived.text', { terminal: TERMINALS.usual })} />
    </Card>
  )
}

/** D7-7: a ready-to-send message for whoever is picking the guest up. */
export function RideCard() {
  const [place, setPlace] = useState(t('dl.ride.defaultPlace'))
  const [time, setTime] = useState('09:30')
  return (
    <Card labelledBy="dl-ride-h">
      <h2 id="dl-ride-h" className="card__title">{th('dl.ride.title')}</h2>
      <Field label={t('dl.ride.place')} value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} />
      <Field label={t('dl.ride.time')} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      <CopyText text={t('dl.ride.text', { place: place.trim() || t('dl.ride.defaultPlace'), terminal: TERMINALS.usual, time })} />
    </Card>
  )
}

/** D4A-7: whether the device clock and the ship's differ, so a watch can be set at sailing. */
export function WatchCard() {
  const sailing = useSailing()
  const now = useNow()
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone
  const gap = watchGap(now, device, shipZoneAt(sailing, now))
  const hours = Math.abs(gap.minutes) / 60
  const words = Number.isInteger(hours) ? t('dl.watch.hours', { count: hours }) : t('dl.watch.half', { hours: Math.floor(hours) })
  return (
    <Card info labelledBy="dl-watch-h">
      <h2 id="dl-watch-h" className="card__title">{th('dl.watch.title')}</h2>
      <p>{gap.same ? t('dl.watch.same') : t(gap.minutes > 0 ? 'dl.watch.ahead' : 'dl.watch.behind', { hours: words })}</p>
    </Card>
  )
}

/** D7-3: a reminder to charge devices before the last morning. */
export function ChargeCard({ firstDeadline }: { firstDeadline?: number }) {
  const sailing = useSailing()
  const deadline = firstDeadline === undefined ? undefined : timeIn(firstDeadline, shipZoneAt(sailing, firstDeadline))
  return (
    <Card info labelledBy="dl-chg-h">
      <h2 id="dl-chg-h" className="card__title">{th('dl.charge.title')}</h2>
      <p>{t('dl.charge.body', { time: chargeReminderTime(deadline) })}</p>
    </Card>
  )
}
