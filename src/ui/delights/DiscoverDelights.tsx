import { useState } from 'react'
import { Link } from 'react-router'
import { formatDate, formatTime } from '../../domain/cruise'
import type { Cabin } from '../../domain/cabins'
import { cabinNeighbours, cabinWalks, canFlip, costPerDay, dayOn, dayStrip, flipHint, flipPick, LAND_HOLIDAY_PER_DAY, leftOff, stripSummary, sunByDay } from '../../domain/discoverDelights'
import { formatMoney } from '../../domain/money'
import { PORT_COORDS } from '../../domain/ports'
import { itinerary, portById, SAILINGS, sailingNights, type Sailing } from '../../domain/sailings'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { useMemory } from '../../hooks/useMemory'
import { lastHolidayPerDay, normalizeLastHoliday } from '../../domain/rememberDelights'

/** D1-2: one block per day (sea, home, dock, tender) with hours in port, so the shape of the trip is clear at a glance. Words carry the meaning, not colour. */
export function DayStrip({ sailing }: { sailing: Sailing }) {
  const days = itinerary(sailing)
  const tenders = new Set(days.filter((d) => portById(d.port)?.tender).map((d) => d.port))
  const strip = dayStrip(days, tenders)
  const sum = stripSummary(strip)
  return (
    <section aria-labelledby="dl3-strip-h">
      <h2 id="dl3-strip-h">{th('dl3.strip.title')}</h2>
      <p>{t('dl3.strip.summary', { count: sum.sea, ports: sum.ports, tender: sum.tender })}</p>
      <ol className="day-strip">
        {strip.map((s) => (
          <li key={s.day} className={`day-strip__day day-strip__day--${s.kind}`}>
            <span className="day-strip__num">{s.day}</span>
            <span>{t(`dl3.strip.${s.kind}` as StringKey)}</span>
            {s.hours !== null && <span className="muted">{t('dl3.strip.hours', { hours: s.hours })}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** D0-3: pick a day of the sailing and see where the ship would be. */
export function OnThatDate({ sailing }: { sailing: Sailing }) {
  const days = itinerary(sailing)
  const [date, setDate] = useState(days[0]?.date ?? '')
  const d = dayOn(days, date)
  const port = d && d.port !== 'sea' ? portById(d.port) ?? null : null
  const times = d ? [d.arrive && t('discover.arrive', { time: formatTime(d.arrive) }), d.allAboard && t('discover.allAboard', { time: formatTime(d.allAboard) }), d.depart && t('discover.depart', { time: formatTime(d.depart) })].filter(Boolean).join(' · ') : ''
  return (
    <section aria-labelledby="dl3-date-h">
      <h2 id="dl3-date-h">{th('dl3.date.title')}</h2>
      <div className="field">
        <label htmlFor="dl3-date">{t('dl3.date.label')}</label>
        <select id="dl3-date" value={date} onChange={(e) => setDate(e.target.value)}>
          {days.map((x) => <option key={x.date} value={x.date}>{formatDate(x.date)}</option>)}
        </select>
      </div>
      <p role="status">
        {!d ? '' : !port ? t('dl3.date.sea') : d.day === 1 || d.day === days.length ? t('dl3.date.home', { port: port.name, what: d.day === 1 ? t('dl3.date.leaves') : t('dl3.date.arrives') }) : t('dl3.date.port', { port: port.name, times })}
      </p>
      {port && d && d.day !== 1 && d.day !== days.length && <p><Link to={`/home/ports/${d.port}`}>{t('dl3.date.guide')}</Link></p>}
    </section>
  )
}

/** D0-6: the cruise per person per day beside an authored land-holiday range, with the method shown. */
export function LandHolidayCompare({ sailing, total, guests }: { sailing: Sailing; total: number; guests: number }) {
  const nights = sailingNights(sailing)
  const c = costPerDay(total, guests, nights)
  if (!c) return null
  return (
    <Card info labelledBy="dl3-land-h">
      <h3 id="dl3-land-h" className="card__title">{th('dl3.land.title')}</h3>
      <p>{t('dl3.land.cruise', { amount: formatMoney(c.perDay), days: nights + 1 })}</p>
      <p>{t('dl3.land.range', { low: formatMoney(LAND_HOLIDAY_PER_DAY.low), high: formatMoney(LAND_HOLIDAY_PER_DAY.high) })} {t(`dl3.land.${c.position}` as StringKey)}</p>
      <LastHolidayForm perDay={c.perDay} />
      <details><summary>{t('dl3.land.how')}</summary><p>{t('dl3.land.method')}</p></details>
    </Card>
  )
}

/** D1-4, D1-5, D1-6: sun by day, walking times and what is above and below, for one cabin. */
export function CabinExtras({ cabin, sailing }: { cabin: Cabin; sailing: Sailing }) {
  const sun = sunByDay(itinerary(sailing), PORT_COORDS, cabin.side)
  const walks = cabinWalks(cabin)
  const near = cabinNeighbours(cabin)
  const names = (list: { name: string }[]) => (list.length ? list.map((p) => p.name).join(', ') : t('dl3.near.none'))
  return (
    <details>
      <summary>{t('dl3.walk.title')}</summary>
      <ul className="plain-bullets">
        {walks.walks.map((w) => <li key={w.id}>{t('dl3.walk.to', { count: w.minutes, place: w.name })} ({t(w.by === 'deck' ? 'dl3.walk.byDeck' : 'dl3.walk.byLift')})</li>)}
        <li>{t('dl3.walk.lift', { minutes: walks.lift.minutes, bank: walks.lift.bank })}</li>
      </ul>
      <p className="muted">{t('dl3.walk.note')} {t('dl3.walk.closures')}</p>
      <h4>{t('dl3.near.title')}</h4>
      <ul className="plain-bullets">
        <li>{t('dl3.near.above', { deck: cabin.deck + 1, places: names(near.above) })}</li>
        <li>{t('dl3.near.below', { deck: cabin.deck - 1, places: names(near.below) })}</li>
      </ul>
      <p>{t(`dl3.near.${near.noise}` as StringKey)}</p>
      <h4>{t('dl3.sun.title')}</h4>
      <ul className="plain-bullets">
        {sun.map((s) => (
          <li key={s.day}>{t('dl3.sun.day', { day: s.day })}: {s.heading === null ? t('dl3.sun.berth') : s.morning && s.afternoon ? `${t('dl3.sun.morning')}, ${t('dl3.sun.afternoon')}` : s.morning ? t('dl3.sun.morning') : s.afternoon ? t('dl3.sun.afternoon') : t('dl3.sun.little')}</li>
        ))}
      </ul>
      <p className="muted">{t('dl3.sun.note')}</p>
    </details>
  )
}

/** D1-7: the cabins this device was comparing last time, with a button to reopen them. */
export function LeftOffCard({ picks, onOpen, onForget }: { picks: readonly { number: string }[]; onOpen: () => void; onForget: () => void }) {
  const l = leftOff(picks)
  if (!l) return null
  const decks = l.decks.length ? t('dl3.left.deck', { count: l.decks.length, decks: l.decks.join(', ') }) : t('dl3.left.noDeck')
  return (
    <Card info labelledBy="dl3-left-h">
      <h2 id="dl3-left-h" className="card__title">{th('dl3.left.title')}</h2>
      <p>{t('dl3.left.body', { count: l.count, decks })}</p>
      <div className="button-row">
        <Button onClick={onOpen}>{t('dl3.left.open')}</Button>
        <Button variant="tertiary" onClick={onForget}>{t('dl3.left.forget')}</Button>
      </div>
    </Card>
  )
}

/** D0-1: flip a coin between two sailings, then ask whether the guest hoped for the result. A hint only. */
export function GutCheckFlip({ initial }: { initial: string }) {
  const [a, setA] = useState(initial)
  const [b, setB] = useState(SAILINGS.find((s) => s.id !== initial)?.id ?? '')
  const [result, setResult] = useState<0 | 1 | null>(null)
  const [hoped, setHoped] = useState<boolean | null>(null)
  const label = (id: string) => formatDate(SAILINGS.find((s) => s.id === id)?.departure ?? '1970-01-01')
  const ids = [a, b]
  const reset = () => { setResult(null); setHoped(null) }
  return (
    <Card labelledBy="dl3-flip-h">
      <h2 id="dl3-flip-h" className="card__title">{th('dl3.flip.title')}</h2>
      <p>{t('dl3.flip.intro')}</p>
      {([['a', a, setA], ['b', b, setB]] as const).map(([k, v, set]) => (
        <div className="field" key={k}>
          <label htmlFor={`dl3-flip-${k}`}>{t(`dl3.flip.${k}` as StringKey)}</label>
          <select id={`dl3-flip-${k}`} value={v} onChange={(e) => { set(e.target.value); reset() }}>
            {SAILINGS.map((s) => <option key={s.id} value={s.id}>{formatDate(s.departure)}</option>)}
          </select>
        </div>
      ))}
      {!canFlip(a, b) ? <p className="muted">{t('dl3.flip.same')}</p> : <Button variant="secondary" onClick={() => { setResult(flipPick(Math.random())); setHoped(null) }}>{t('dl3.flip.go')}</Button>}
      <div role="status">
        {result !== null && canFlip(a, b) && (
          <>
            <p><strong>{t('dl3.flip.result', { sailing: label(ids[result]) })}</strong></p>
            <p>{t('dl3.flip.ask')}</p>
            <div className="button-row">
              <Button variant={hoped === true ? 'primary' : 'secondary'} aria-pressed={hoped === true} onClick={() => setHoped(true)}>{t('dl3.flip.yes')}</Button>
              <Button variant={hoped === false ? 'primary' : 'secondary'} aria-pressed={hoped === false} onClick={() => setHoped(false)}>{t('dl3.flip.no')}</Button>
            </div>
            {hoped !== null && <p>{t('dl3.flip.hint', { sailing: label(ids[flipHint(result, hoped)]) })}</p>}
          </>
        )}
      </div>
    </Card>
  )
}

/** D0-7: read a text aloud with the browser's own speech, and stop again. Hidden with a note when the device cannot speak. */
export function ReadAloud({ text }: { text: string }) {
  const [reading, setReading] = useState(false)
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return <p className="muted">{t('brief.noVoice')}</p>
  const toggle = () => {
    const synth = window.speechSynthesis
    if (reading) { synth.cancel(); setReading(false); return }
    const u = new SpeechSynthesisUtterance(text)
    u.onend = () => setReading(false)
    u.onerror = () => setReading(false)
    setReading(true)
    synth.speak(u)
  }
  return <Button variant="secondary" onClick={toggle}>{reading ? t('brief.stop') : t('brief.readAloud')}</Button>
}

/** X4e: the guest's own last holiday (people, nights, total), kept in the memory document, set beside this sailing's figure. */
function LastHolidayForm({ perDay }: { perDay: number }) {
  const { state, update } = useMemory()
  const saved = state.remember.lastHoliday
  const [editing, setEditing] = useState(false)
  const [people, setPeople] = useState('')
  const [nights, setNights] = useState('')
  const [total, setTotal] = useState('')
  const parsed = normalizeLastHoliday({ people: Number(people), nights: Number(nights), cents: Math.round(Number(total) * 100) })
  const set = (lastHoliday: typeof saved) => update((m) => ({ ...m, remember: { ...m.remember, lastHoliday } }))
  const last = lastHolidayPerDay(saved)
  if (saved && last !== null && !editing) {
    const diff = perDay - last
    return (
      <div>
        <p>{t('dl3.last.yours', { amount: formatMoney(last), people: saved.people, nights: saved.nights })}</p>
        <p role="status">{diff === 0 ? t('dl3.last.same') : t(diff < 0 ? 'dl3.last.less' : 'dl3.last.more', { amount: formatMoney(Math.abs(diff)) })}</p>
        <div className="button-row">
          <Button variant="tertiary" onClick={() => { setPeople(String(saved.people)); setNights(String(saved.nights)); setTotal(String(saved.cents / 100)); setEditing(true) }}>{t('dl3.last.change')}</Button>
          <Button variant="tertiary" onClick={() => set(null)}>{t('dl3.last.clear')}</Button>
        </div>
      </div>
    )
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (parsed) { set(parsed); setEditing(false) } }}>
      <h4>{t('dl3.last.title')}</h4>
      <Field label={t('dl3.last.people')} type="number" inputMode="numeric" min={1} max={20} value={people} onChange={(e) => setPeople(e.target.value)} />
      <Field label={t('dl3.last.nights')} type="number" inputMode="numeric" min={1} max={365} value={nights} onChange={(e) => setNights(e.target.value)} />
      <Field label={t('dl3.last.total')} hint={t('dl3.last.hint')} type="number" inputMode="decimal" min={1} value={total} onChange={(e) => setTotal(e.target.value)} />
      <div className="button-row">
        <Button type="submit" disabled={!parsed}>{t('dl3.last.compare')}</Button>
        {editing && <Button variant="tertiary" onClick={() => setEditing(false)}>{t('dl3.last.cancel')}</Button>}
      </div>
    </form>
  )
}
