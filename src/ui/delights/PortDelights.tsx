import { useState } from 'react'
import type { PortDayView } from '../../api/types'
import { asFolioView } from '../../api/guards'
import type { DisembarkView } from '../../api/finishTypes'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { folioTotals } from '../../domain/folio'
import { formatMoney } from '../../domain/money'
import { PORTS } from '../../domain/sailings'
import {
  addPin, allowanceLeft, creditLeft, dayCardText, finalDayStrip, LAST_LOOK_NOTE_MAX, pinsAt, portStamps, removePin, stopwatch, sunPrompts, TAKE_ME_BACK, tripNumbers, tripNumbersText,
} from '../../domain/portDelights'
import { ALLOWANCE_USD } from '../../domain/disembark'
import { dateIn } from '../../domain/timezones'
import { shipZoneAt } from '../../domain/sailings'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { useNow, usePersona, useSailing } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { useSky } from '../../hooks/useSky'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { CopyText } from '../CopyText'
import { Field } from '../Field'
import { Saved } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { clearCabinPhoto, keepCabinPhoto, loadCabinPhoto, type CabinPhoto } from '../../memory/devicePhoto'

type Day = PortDayView['day']

/** D6A-1: the time left to all-aboard as one big number in ship time, with a word for how urgent it is. */
export function PocketStopwatch({ day }: { day: Day }) {
  const now = useNow()
  const s = stopwatch(day.allAboardAt, now)
  return (
    <Card labelledBy="dl8-watch-h">
      <h2 id="dl8-watch-h" className="card__title">{t('dl8.watch.title')}</h2>
      <p className={`dl8-watch dl8-watch--${s.level}`} role="timer" aria-label={t('dl8.watch.label', { hours: s.hours, minutes: s.minutes })}>{s.text}</p>
      <p className="muted">{t('dl8.watch.note', { time: day.allAboardShip })}</p>
    </Card>
  )
}

/** D6A-2: where the ship is and what to say, in the local language, large enough to show a driver. */
export function TakeMeBack({ port }: { port: Day['port'] }) {
  const back = TAKE_ME_BACK[port]
  return (
    <Card labelledBy="dl8-back-h">
      <h2 id="dl8-back-h" className="card__title">{t('dl8.back.title')}</h2>
      <p>{t('dl8.back.body')}</p>
      <p className="dl8-show" lang={back.lang}><strong>{back.place}</strong></p>
      <p className="dl8-show" lang={back.lang}>{back.say}</p>
      {back.lang !== 'en' && <p className="muted">{t('dl8.back.english', { text: back.english })}</p>}
      <p className="muted">{t('dl8.back.note')}</p>
    </Card>
  )
}

/** D6A-3: one gentle prompt from today's sky; nothing when it is mild or the sky has not loaded. */
export function SunNudge({ day }: { day: Day }) {
  const sky = useSky(day.date, day.port)
  const prompts = sky ? sunPrompts(sky) : []
  if (prompts.length === 0) return null
  return (
    <Card labelledBy="dl8-sun-h">
      <h2 id="dl8-sun-h" className="card__title">{t('dl8.sun.title')}</h2>
      <p>{t('dl8.sun.today', { uv: Math.round(sky!.uv), temp: Math.round(sky!.tempF) })}</p>
      <ul className="plain-bullets">{prompts.map((p) => <li key={p}>{t(`dl8.sun.${p}` as StringKey)}</li>)}</ul>
    </Card>
  )
}

/** D6A-7: a stamp for each port the ship has reached. Worked out from the route, so nothing is stored. */
export function PortStamps() {
  const sailing = useSailing()
  const now = useNow()
  const today = dateIn(now, shipZoneAt(sailing, now))
  const stamps = portStamps(sailing, today)
  if (stamps.length === 0) return null
  return (
    <Card labelledBy="dl8-stamps-h">
      <h2 id="dl8-stamps-h" className="card__title">{t('dl8.stamps.title')}</h2>
      <ul className="dl8-stamps">
        {stamps.map((s) => <li key={s.port} className="dl8-stamp"><strong>{PORTS[s.port].name}</strong><span>{t('dl8.stamps.day', { day: s.day })}</span></li>)}
      </ul>
    </Card>
  )
}

/** D6A-8 and D6A-9: pin a favourite spot with a note, and keep one plain card for the day ashore on the phone. */
export function PinAndDayCard({ day }: { day: Day }) {
  const { state, update } = useMemory()
  const [note, setNote] = useState('')
  const pins = pinsAt(state.ports.pins, day.port)
  const name = PORTS[day.port].name
  const text = dayCardText({ port: day.port, portName: name, allAboardShip: day.allAboardShip, allAboardLocal: day.allAboardLocal, phone: GUEST_SERVICES_NUMBER, pins: state.ports.pins })
  const kept = state.ports.card?.port === day.port ? state.ports.card : null
  return (
    <Card labelledBy="dl8-pin-h">
      <h2 id="dl8-pin-h" className="card__title">{t('dl8.pin.title', { port: name })}</h2>
      <p>{t('dl8.pin.body')}</p>
      <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) { update((s) => ({ ...s, ports: { ...s.ports, pins: addPin(s.ports.pins, { id: newMemoryId(), port: day.port, note, at: Date.now() }) } })); setNote('') } }}>
        <Field label={t('dl8.pin.note')} value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={!note.trim()}>{t('dl8.pin.add')}</Button>
      </form>
      {pins.length > 0 && (
        <ul className="plain-list">
          {pins.map((p) => (
            <li key={p.id}>{p.note} <Button variant="tertiary" onClick={() => update((s) => ({ ...s, ports: { ...s.ports, pins: removePin(s.ports.pins, p.id) } }))}>{t('dl8.pin.remove')}<span className="visually-hidden"> {p.note}</span></Button></li>
          ))}
        </ul>
      )}
      <h3>{t('dl8.card.title')}</h3>
      <p className="muted">{t('dl8.card.body')}</p>
      <CopyText text={kept?.text ?? text} label={t('dl8.card.copy')} />
      <div className="button-row">
        <Button variant="secondary" onClick={() => update((s) => ({ ...s, ports: { ...s.ports, card: { port: day.port, text, at: Date.now() } } }))}>{kept ? t('dl8.card.refresh') : t('dl8.card.keep')}</Button>
        {kept && <Button variant="tertiary" onClick={() => update((s) => ({ ...s, ports: { ...s.ports, card: null } }))}>{t('dl8.card.drop')}</Button>}
      </div>
    </Card>
  )
}

/** D7-2: the last morning in one list, in time order, in ship time. */
export function FinalDayStrip({ v }: { v: DisembarkView }) {
  const shipTime = useShipTime()
  const items = finalDayStrip(v.times, v.offAt[v.option ?? 'tagged'])
  return (
    <Card labelledBy="dl8-strip-h">
      <h2 id="dl8-strip-h" className="card__title">{t('dl8.strip.title')}</h2>
      <ol className="plain-list">
        {items.map((i) => <li key={i.id}><strong>{shipTime(i.at)}</strong> · {i.id === 'group' ? (v.option === 'tagged' || v.option === null ? t('dl8.strip.group', { color: t(`dis.color.${v.group.color}` as StringKey), number: v.group.number }) : t('dl8.strip.walk')) : t(`dl8.strip.${i.id}` as StringKey)}</li>)}
      </ol>
      <p className="muted">{t('dl8.strip.note')}</p>
    </Card>
  )
}

/** D7-1: an optional photo of the cleared cabin, kept in this browser only. */
export function EmptyCabinPhoto() {
  const [photo, setPhoto] = useState<CabinPhoto | null>(() => loadCabinPhoto())
  const [problem, setProblem] = useState(false)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setProblem(false)
    const kept = await keepCabinPhoto(file, Date.now())
    if (kept) setPhoto(kept); else setProblem(true)
  }
  return (
    <Card labelledBy="dl8-cabin-h">
      <h2 id="dl8-cabin-h" className="card__title">{t('dl8.cabin.title')}</h2>
      <p>{t('dl8.cabin.body')}</p>
      {photo && <img className="dl8-photo" src={photo.dataUrl} alt={t('dl8.cabin.alt')} />}
      <div className="field">
        <label htmlFor="dl8-cabin-file">{photo ? t('dl8.cabin.replace') : t('dl8.cabin.take')}</label>
        <input id="dl8-cabin-file" className="field__input" type="file" accept="image/*" capture="environment" onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
      {photo && <Button variant="tertiary" onClick={() => { clearCabinPhoto(); setPhoto(null) }}>{t('dl8.cabin.remove')}</Button>}
      {problem && <p className="field__error" role="alert">{t('dl8.cabin.failed')}</p>}
      <p className="muted">{t('dl8.cabin.note')}</p>
    </Card>
  )
}

/** D7-4: a quiet note when the account is in credit. Informational: nothing here spends it. */
export function CreditNote() {
  const me = usePersona()
  const copy = useSavedCopy('folio', me?.booker ?? 'none', () => api.onboard.folio(), asFolioView, [me?.id])
  return <Saved copy={copy}>{(f) => {
    const left = creditLeft(folioTotals(f.lines))
    return left > 0 ? (
      <Card labelledBy="dl8-credit-h">
        <h2 id="dl8-credit-h" className="card__title">{t('dl8.credit.title')}</h2>
        <p>{t('dl8.credit.body', { amount: formatMoney(left) })}</p>
        <p className="muted">{t('dl8.credit.note')}</p>
      </Card>
    ) : null
  }}</Saved>
}

/** D7-6: a gentle prompt to take one last look at dawn, with a line kept for the memory book. */
export function LastLook() {
  const { state, update } = useMemory()
  const look = state.ports.lastLook
  return (
    <Card labelledBy="dl8-look-h">
      <h2 id="dl8-look-h" className="card__title">{t('dl8.look.title')}</h2>
      <p>{t('dl8.look.body')}</p>
      <label className="choice"><input type="checkbox" checked={look.done} onChange={(e) => update((s) => ({ ...s, ports: { ...s.ports, lastLook: { ...s.ports.lastLook, done: e.target.checked } } }))} /><span>{t('dl8.look.done')}</span></label>
      {look.done && <Field label={t('dl8.look.note')} value={look.note} maxLength={LAST_LOOK_NOTE_MAX} onChange={(e) => update((s) => ({ ...s, ports: { ...s.ports, lastLook: { ...s.ports.lastLook, note: e.target.value } } }))} />}
    </Card>
  )
}

/** D7-9: nights, ports, sea days and nautical miles in one small card, with the words to share. */
export function TripNumbersCard() {
  const n = tripNumbers(useSailing())
  return (
    <Card labelledBy="dl8-nums-h">
      <h2 id="dl8-nums-h" className="card__title">{t('dl8.nums.title')}</h2>
      <dl className="recap-stats">
        <div><dt>{t('dl8.nums.nights')}</dt><dd>{n.nights}</dd></div>
        <div><dt>{t('dl8.nums.ports')}</dt><dd>{n.ports}</dd></div>
        <div><dt>{t('dl8.nums.sea')}</dt><dd>{n.seaDays}</dd></div>
        <div><dt>{t('dl8.nums.miles')}</dt><dd>{n.nauticalMiles.toLocaleString('en-US')}</dd></div>
      </dl>
      <CopyText text={tripNumbersText(n)} label={t('dl8.nums.copy')} />
    </Card>
  )
}

/** D7-8: what is left of the customs allowance for the party, from the goods total typed on the form. An estimate; the official form stays official. */
export function AllowanceLeft({ people, goodsUsd }: { people: number; goodsUsd: number }) {
  const { left, over } = allowanceLeft(people, goodsUsd)
  return (
    <p className="muted" role="status">
      {over > 0 ? t('dl8.allow.over', { over }) : t('dl8.allow.left', { left, each: ALLOWANCE_USD })} {t('dl8.allow.note')}
    </p>
  )
}

