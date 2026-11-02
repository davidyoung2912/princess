import { useId, useState } from 'react'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/money'
import type { PlanDay, PlanEntry } from '../../domain/plan'
import { NOTE_MAX, dayWalks, occasionNote, occasionsAtSea, OCCASIONS_MAX, REST_PARTS, reslice, setNote, setRest, TRAVELLER_COLOURS, watchSpot, type RestPart } from '../../domain/planPolish'
import { itinerary } from '../../domain/sailings'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { sameCelebrations } from '../../domain/planPolish'
import { SHIP } from '../../domain/ship'
import { skyNightFeed } from '../../feeds/skyNight'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { useSailing } from '../../hooks/useDemo'
import { useFeed } from '../../hooks/useServedFeeds'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { CopyText } from '../CopyText'
import { Field } from '../Field'
import { firstName } from '../plan/people'
import { useTravellerColours } from './travellerColours'
import { useMyCabin } from './useMyCabin'

/** D4-6: who is doing what, as a coloured dot and the name. */
export function Guests({ guests, colour }: { guests: readonly string[]; colour: (id: string) => { name: string; hex: string } }) {
  if (guests.length === 0) return null
  return (
    <span className="muted"><br />
      {guests.map((g, i) => {
        const c = colour(g)
        return <span key={g} className="guest-dot"><span className="guest-dot__swatch" aria-hidden="true" style={{ background: c.hex }} />{firstName(g)}<span className="visually-hidden"> ({c.name})</span>{i < guests.length - 1 ? ', ' : ''}</span>
      })}
    </span>
  )
}

/** D4-5: a private note on a booking. */
export function EntryNote({ entry }: { entry: PlanEntry }) {
  const { state, update } = useMemory()
  const id = useId()
  const key = entry.id ?? ''
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(state.polish.notes[key] ?? '')
  if (!key) return null
  const saved = state.polish.notes[key]
  const save = () => { update((s) => ({ ...s, polish: { ...s.polish, notes: setNote(s.polish.notes, key, text) } })); setOpen(false) }
  return (
    <div className="entry-note">
      {saved && !open && <p className="entry-note__text"><span className="visually-hidden">{t('dl4.note.label')}: </span>{saved}</p>}
      {open ? (
        <form onSubmit={(e) => { e.preventDefault(); save() }}>
          <Field label={t('dl4.note.label')} hint={t('dl4.note.hint')} value={text} maxLength={NOTE_MAX} onChange={(e) => setText(e.target.value)} />
          <div className="button-row">
            <Button type="submit" variant="secondary">{t('dl4.note.save')}</Button>
            <Button variant="tertiary" onClick={() => { setText(saved ?? ''); setOpen(false) }}>{t('dl4.note.cancel')}</Button>
          </div>
        </form>
      ) : (
        <Button variant="tertiary" aria-describedby={id} onClick={() => setOpen(true)}>{saved ? t('dl4.note.edit') : t('dl4.note.add')}<span id={id} className="visually-hidden"> {entry.name || t('plan.entry.sail')}</span></Button>
      )}
    </div>
  )
}

/** D4-1, D4-2, D4-4: the rest block, the walks and the sun, at the foot of a day card. */
export function DayPolish({ day }: { day: PlanDay }) {
  const sailing = useSailing()
  const { state, update } = useMemory()
  const cabin = useMyCabin()
  const sky = useFeed(skyNightFeed, sailing.departure, day.day)
  const block = state.polish.rest.find((r) => r.day === day.day)
  const walks = dayWalks(day.entries, cabin)
  const set = (part: RestPart | null) => update((s) => ({ ...s, polish: { ...s.polish, rest: setRest(s.polish.rest, day.day, part) } }))
  const side = (x: ReturnType<typeof watchSpot>) => (x.side ? t('dl4.sun.on', { place: x.place.name, side: t(`dl4.sun.side.${x.side}` as StringKey) }) : x.place.name)
  const rise = sky ? watchSpot('sunrise', sky.sunsetSide) : null
  const sets = sky ? watchSpot('sunset', sky.sunsetSide) : null
  const id = `rest-${day.day}`
  return (
    <div className="day-polish">
      {walks.length > 0 && (
        <ul className="plain-list day-polish__walks" aria-label={t('dl4.walk.title')}>
          {walks.map((w) => <li key={`${w.fromName}>${w.toName}`} className="muted">{t('dl4.walk.line', { from: w.fromName, to: w.toName, minutes: w.minutes })}{' '}{w.decks === 0 ? t('dl4.walk.sameDeck') : t(w.lift ? 'dl4.walk.decksLift' : 'dl4.walk.decks', { decks: w.decks })}</li>)}
        </ul>
      )}
      {sky && rise && sets && <p className="muted">{t('dl4.sun.line', { sunrise: sky.sunrise, sunset: sky.sunset, riseSpot: side(rise), riseDeck: rise.place.deck, spot: side(sets), deck: sets.place.deck })}</p>}
      {block && <p><strong>{t('dl4.rest.on')}</strong> {t(`dl4.rest.body.${block.part}` as StringKey)}</p>}
      <div className="field">
        <label htmlFor={id}>{t('dl4.rest.label')}<span className="visually-hidden"> {t('plan.day', { n: day.day })}</span></label>
        <select id={id} className="field__input" value={block?.part ?? ''} onChange={(e) => set(e.target.value ? (e.target.value as RestPart) : null)}>
          <option value="">{t('dl4.rest.none')}</option>
          {REST_PARTS.map((p) => <option key={p} value={p}>{t(`dl4.rest.part.${p}` as StringKey)}</option>)}
        </select>
      </div>
    </div>
  )
}

/** D4-6: pick a colour for each person in the plan. */
export function TravellerColours({ days }: { days: readonly PlanDay[] }) {
  const { update } = useMemory()
  const colour = useTravellerColours(days)
  const ids = [...new Set(days.flatMap((d) => d.entries.flatMap((e) => e.guests)))].sort()
  if (ids.length < 2) return null
  return (
    <Card labelledBy="plan-col-h">
      <h2 id="plan-col-h" className="card__title">{t('dl4.colour.title')}</h2>
      <p>{t('dl4.colour.body')}</p>
      {ids.map((id) => {
        const c = colour(id)
        return (
          <div className="field" key={id}>
            <label htmlFor={`col-${id}`}>{firstName(id)}</label>
            <select id={`col-${id}`} className="field__input" value={TRAVELLER_COLOURS.indexOf(c)} onChange={(e) => update((s) => ({ ...s, polish: { ...s.polish, colours: { ...s.polish.colours, [id]: Number(e.target.value) } } }))}>
              {TRAVELLER_COLOURS.map((x, i) => <option key={x.name} value={i}>{x.name}</option>)}
            </select>
          </div>
        )
      })}
    </Card>
  )
}

/** D2-5: birthdays and anniversaries; the ones that fall during the trip get a note for the ship. */
export function OccasionsCard() {
  const sailing = useSailing()
  const { state, update } = useMemory()
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const [surprise, setSurprise] = useState(false)
  const days = itinerary(sailing)
  const hits = occasionsAtSea(state.polish.occasions, days.map((d) => d.date))
  const told = useMine(() => api.plan.celebrations.get())
  const [telling, setTelling] = useState(false)
  const [tellProblem, setTellProblem] = useState(false)
  const toTell = hits.map((h) => h.occasion)
  const view = told.data
  const inSync = view ? sameCelebrations(toTell, view.items) : false
  const tell = async () => {
    setTelling(true); setTellProblem(false)
    try { await api.plan.celebrations.save(toTell); told.retry() } catch { setTellProblem(true) } finally { setTelling(false) }
  }
  const set = (occasions: typeof state.polish.occasions) => update((s) => ({ ...s, polish: { ...s.polish, occasions } }))
  const add = () => {
    if (!label.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date) || state.polish.occasions.length >= OCCASIONS_MAX) return
    set([...state.polish.occasions, { id: newMemoryId(), label: label.replace(/\s+/g, ' ').trim().slice(0, 40), date, surprise }])
    setLabel(''); setDate(''); setSurprise(false)
  }
  return (
    <Card labelledBy="plan-occ-h">
      <h2 id="plan-occ-h" className="card__title">{t('dl4.occ.title')}</h2>
      <p>{t('dl4.occ.body')}</p>
      {hits.map(({ occasion, day }) => (
        <div key={occasion.id}>
          <p role="status"><strong>{t('dl4.occ.atSea', { label: occasion.label, day, date: formatDate(days[day - 1].date) })}</strong></p>
          <CopyText text={occasionNote(occasion, SHIP.name)} label={t('dl4.occ.copy')} />
        </div>
      ))}
      {view?.canEdit && (toTell.length > 0 || view.items.length > 0) && (
        <div>
          <p role="status">{inSync ? t('dl4.occ.told') : t('dl4.occ.notTold')}</p>
          {!inSync && <Button variant="secondary" disabled={telling} onClick={() => void tell()}>{view.items.length > 0 ? t('dl4.occ.update') : t('dl4.occ.tell')}</Button>}
          {tellProblem && <p className="field__error" role="alert">{t('dl4.occ.tellFailed')}</p>}
          <p className="muted">{t('dl4.occ.tellNote')}</p>
        </div>
      )}
      {state.polish.occasions.length > 0 && (
        <ul className="plain-list">
          {state.polish.occasions.map((o) => (
            <li key={o.id}>{o.label} · {o.date.slice(5)}{o.surprise ? ` · ${t('dl4.occ.surprise')}` : ''}{' '}
              <Button variant="tertiary" onClick={() => set(state.polish.occasions.filter((x) => x.id !== o.id))}>{t('dl4.occ.remove')}<span className="visually-hidden"> {o.label}</span></Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); add() }}>
        <Field label={t('dl4.occ.label')} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
        <Field label={t('dl4.occ.date')} hint={t('dl4.occ.dateHint')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="choice"><input type="checkbox" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} /><span>{t('dl4.occ.surpriseLabel')}</span></label>
        <Button type="submit" variant="secondary" disabled={!label.trim() || !date}>{t('dl4.occ.add')}</Button>
      </form>
      <p className="muted">{t('dl4.occ.note')}</p>
    </Card>
  )
}

/** D2-7: drag a person's share and the others move to keep the total. The amounts stay whole cents. */
export function ShareSliders({ total }: { total: number }) {
  const { state, update } = useMemory()
  const shares = state.shares
  if (shares.length < 2 || total <= 0) return null
  const move = (index: number, cents: number) => {
    const next = reslice(shares.map((s) => s.amount), index, cents)
    update((m) => ({ ...m, shares: m.shares.map((s, i) => ({ ...s, amount: next[i] ?? s.amount })) }))
  }
  const sum = shares.reduce((a, s) => a + s.amount, 0)
  return (
    <fieldset>
      <legend>{t('dl4.sliders.title')}</legend>
      <p className="muted">{t('dl4.sliders.body')}</p>
      {shares.map((s, i) => (
        <div className="field" key={s.id}>
          <label htmlFor={`sl-${s.id}`}>{t('dl4.sliders.label', { name: s.name, amount: formatMoney(s.amount), percent: Math.round((s.amount / (sum || 1)) * 100) })}</label>
          <input id={`sl-${s.id}`} type="range" min={0} max={sum} step={100} value={s.amount} aria-valuetext={`${formatMoney(s.amount)}`} disabled={s.paid} onChange={(e) => move(i, Number(e.target.value))} />
        </div>
      ))}
      <p className="muted">{t('dl4.sliders.paid')}</p>
    </fieldset>
  )
}
