import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { formatDate } from '../../domain/cruise'
import { DIRECTORY, type DayType, type DirectoryVenue } from '../../domain/menus'
import { placeById } from '../../domain/deck'
import { itinerary, portAt, shipZoneAt } from '../../domain/sailings'
import { dateIn } from '../../domain/timezones'
import { SHIP } from '../../domain/ship'
import {
  addDiaryEntry, addThanks, CELEBRATION_MAX, wishesFor, dressTonight, favouritesTonight, isFavourite, occasionOn, orderAgain, parkSpot, spotDue, spotMinutesLeft, spotPlaces,
  SPOT_DEFAULT_MINUTES, SPOT_MINUTES, THANKS_TARGETS, thanksText, toggleFavourite, VERDICTS, type Verdict,
} from '../../domain/seaDelights'
import { useNow, useSailing } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { allowLocalReminders, remindIn } from '../../push/browser'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { CopyText } from '../CopyText'
import { Field } from '../Field'

/** The day of the cruise (1 to 8) the demo clock is on, or 0 before and after. */
function useCruiseDay(): number {
  const sailing = useSailing()
  const now = useNow()
  const days = itinerary(sailing)
  const today = dateIn(now, shipZoneAt(sailing, now))
  return days.find((d) => d.date === today)?.day ?? 0
}

/** D6-2: tonight's dress code as a small badge with a word and a mark, never colour alone. */
export function DressBadge({ day }: { day: number }) {
  const sailing = useSailing()
  const nights = itinerary(sailing).length - 1
  const code = dressTonight(day, nights)
  return (
    <p className={`dress-badge dress-badge--${code}`} role="status">
      <span aria-hidden="true">{code === 'elegant' ? '◆' : code === 'smart' ? '●' : '○'}</span> {t('dl7.dress.tonight', { dress: t(`dl7.dress.${code}` as StringKey) })}
    </p>
  )
}

/** D6-4: a heart on a dish. A real button with a pressed state and a word, so it works with a screen reader. */
export function FavouriteButton({ venueId, dish }: { venueId: string; dish: string }) {
  const { state, update } = useMemory()
  const on = isFavourite(state.sea.favourites, venueId, dish)
  return (
    <Button variant="tertiary" aria-pressed={on} onClick={() => update((s) => ({ ...s, sea: { ...s.sea, favourites: toggleFavourite(s.sea.favourites, venueId, dish) } }))}>
      <span aria-hidden="true">{on ? '♥' : '♡'}</span> {on ? t('dl7.fav.on') : t('dl7.fav.off')}<span className="visually-hidden"> {dish}</span>
    </Button>
  )
}

/** D6-4: hearted dishes whose room serves dinner today; nothing shows when there are none. */
export function FavouritesTonight({ venues = DIRECTORY }: { venues?: readonly DirectoryVenue[] }) {
  const { state } = useMemory()
  const sailing = useSailing()
  const now = useNow()
  const day: DayType = portAt(sailing, now).port === 'sea' ? 'sea' : 'port'
  const cruiseDay = useCruiseDay()
  const hits = favouritesTonight(state.sea.favourites, venues, day, cruiseDay)
  if (hits.length === 0) return null
  return (
    <Card labelledBy="dl7-fav-h">
      <h2 id="dl7-fav-h" className="card__title">{t('dl7.fav.tonight')}</h2>
      <ul className="plain-bullets">{hits.map((h) => <li key={`${h.venue.id}:${h.dish}`}><strong>{h.dish}</strong> · <Link to={`/ship/venues/${h.venue.id}`}>{h.venue.name}</Link></li>)}</ul>
      <p className="muted">{t('dl7.fav.note')}</p>
    </Card>
  )
}

/** D6-10: an opt-in, private diary of what the guest drank and thought of it. */
export function DrinkDiary() {
  const { state, update } = useMemory()
  const day = useCruiseDay()
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [verdict, setVerdict] = useState<Verdict>('liked')
  const again = orderAgain(state.sea.diary)
  const add = () => {
    if (!name.trim()) return
    update((s) => ({ ...s, sea: { ...s.sea, diary: addDiaryEntry(s.sea.diary, { id: newMemoryId(), name, verdict, note, day }) } }))
    setName(''); setNote('')
  }
  return (
    <Card labelledBy="dl7-diary-h">
      <h2 id="dl7-diary-h" className="card__title">{t('dl7.diary.title')}</h2>
      <p>{t('dl7.diary.body')}</p>
      {again.length > 0 && (
        <div>
          <h3>{t('dl7.diary.again')}</h3>
          <ul className="plain-bullets">{again.map((e) => <li key={e.id}>{e.name}{e.note ? ` · ${e.note}` : ''}</li>)}</ul>
        </div>
      )}
      {state.sea.diary.length > 0 && (
        <ul className="plain-list">
          {state.sea.diary.map((e) => (
            <li key={e.id}>{e.name} · {t(`dl7.diary.${e.verdict}` as StringKey)}{e.note ? ` · ${e.note}` : ''}{' '}
              <Button variant="tertiary" onClick={() => update((s) => ({ ...s, sea: { ...s.sea, diary: s.sea.diary.filter((x) => x.id !== e.id) } }))}>{t('dl7.diary.remove')}<span className="visually-hidden"> {e.name}</span></Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); add() }}>
        <Field label={t('dl7.diary.name')} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
        <fieldset>
          <legend>{t('dl7.diary.verdict')}</legend>
          {VERDICTS.map((v) => <label key={v} className="choice"><input type="radio" name="dl7-verdict" checked={verdict === v} onChange={() => setVerdict(v)} /><span>{t(`dl7.diary.${v}` as StringKey)}</span></label>)}
        </fieldset>
        <Field label={t('dl7.diary.note')} value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={!name.trim()}>{t('dl7.diary.add')}</Button>
      </form>
      <p className="muted">{t('dl7.diary.private')}</p>
    </Card>
  )
}

/** D6-5: a pin for "my lounger / my table", with a note and a timer. The reminder shows here; nobody else is told. */
export function ParkMySpot() {
  const { state, update } = useMemory()
  const now = useNow()
  const places = spotPlaces()
  const [placeId, setPlaceId] = useState(places[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [minutes, setMinutes] = useState<number>(SPOT_DEFAULT_MINUTES)
  const spot = state.sea.spot
  const place = spot ? placeById(spot.placeId) : undefined
  const [allowed, setAllowed] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted')
  const nowRef = useRef(now)
  useEffect(() => { nowRef.current = now })
  const dueAt = spot ? spot.at + spot.minutes * 60_000 : null
  const placeName = place?.name ?? ''
  useEffect(() => {
    if (dueAt === null || !allowed) return undefined
    return remindIn(dueAt - nowRef.current, t('dl7.spot.notifyTitle'), t('dl7.spot.notifyBody', { place: placeName }))
  }, [dueAt, allowed, placeName])
  const set = (next: typeof spot) => update((s) => ({ ...s, sea: { ...s.sea, spot: next } }))
  return (
    <Card labelledBy="dl7-spot-h">
      <h2 id="dl7-spot-h" className="card__title">{t('dl7.spot.title')}</h2>
      {spot && place ? (
        <>
          <p role="status"><strong>{t('dl7.spot.where', { place: place.name, deck: place.deck })}</strong>{spot.note ? ` · ${spot.note}` : ''}</p>
          <p role="status">{spotDue(spot, now) ? t('dl7.spot.due') : t('dl7.spot.left', { count: spotMinutesLeft(spot, now) })}</p>
          <div className="button-row">
            <Button variant="secondary" onClick={() => set(parkSpot(spot.placeId, spot.note, now, spot.minutes))}>{t('dl7.spot.again')}</Button>
            <Button variant="tertiary" onClick={() => set(null)}>{t('dl7.spot.clear')}</Button>
          </div>
          {!allowed && typeof Notification !== 'undefined' && <Button variant="secondary" onClick={() => void allowLocalReminders().then(setAllowed)}>{t('dl7.spot.allow')}</Button>}
          {allowed && <p className="muted">{t('dl7.spot.allowedNote')}</p>}
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); set(parkSpot(placeId, note, now, minutes)) }}>
          <p>{t('dl7.spot.body')}</p>
          <div className="field">
            <label htmlFor="dl7-spot-place">{t('dl7.spot.place')}</label>
            <select id="dl7-spot-place" className="field__input" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name} ({t('map.deckShort', { deck: p.deck })})</option>)}
            </select>
          </div>
          <Field label={t('dl7.spot.note')} value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} />
          <div className="field">
            <label htmlFor="dl7-spot-min">{t('dl7.spot.minutes')}</label>
            <select id="dl7-spot-min" className="field__input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {SPOT_MINUTES.map((m) => <option key={m} value={m}>{t('dl7.spot.min', { count: m })}</option>)}
            </select>
          </div>
          <Button type="submit" variant="secondary">{t('dl7.spot.park')}</Button>
        </form>
      )}
      <p className="muted">{t('dl7.spot.note2')}</p>
    </Card>
  )
}

/** D6-7: a thank-you for a team. No rating, no tip. It is sent to the ship with the booking, and can also be copied or kept as a memory. */
export function SayThanks({ team }: { team?: string }) {
  const { state, update } = useMemory()
  const sent = useMine(() => api.plan.thanks.get())
  const [to, setTo] = useState<string>(THANKS_TARGETS[0])
  const [name, setName] = useState('')
  const [line, setLine] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(false)
  const teamName = team ?? t(`dl7.thanks.t.${to}` as StringKey)
  const text = thanksText(teamName, name, line)
  const keep = () => {
    update((s) => ({ ...s, sea: { ...s.sea, thanks: addThanks(s.sea.thanks, { id: newMemoryId(), to: teamName, text, at: Date.now() }) } }))
  }
  const send = async () => {
    setBusy(true); setProblem(false)
    try { await api.plan.thanks.add(teamName, text); keep(); sent.retry(); setName(''); setLine('') } catch { setProblem(true) } finally { setBusy(false) }
  }
  const view = sent.data
  const mine = view ? view.items.filter((x) => x.mine && (!team || x.team === team)) : []
  return (
    <Card labelledBy="dl7-thanks-h">
      <h2 id="dl7-thanks-h" className="card__title">{t('dl7.thanks.title')}</h2>
      <p>{t('dl7.thanks.body')}</p>
      {!team && (
        <div className="field">
          <label htmlFor="dl7-thanks-to">{t('dl7.thanks.to')}</label>
          <select id="dl7-thanks-to" className="field__input" value={to} onChange={(e) => setTo(e.target.value)}>
            {THANKS_TARGETS.map((x) => <option key={x} value={x}>{t(`dl7.thanks.t.${x}` as StringKey)}</option>)}
          </select>
        </div>
      )}
      <Field label={t('dl7.thanks.name')} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <Field label={t('dl7.thanks.line')} value={line} maxLength={140} onChange={(e) => setLine(e.target.value)} />
      <CopyText text={text} label={t('dl7.thanks.copy')} />
      <div className="button-row">
        {view?.canAdd && <Button disabled={busy} onClick={() => void send()}>{t('dl7.thanks.send')}</Button>}
        <Button variant="secondary" onClick={keep}>{t('dl7.thanks.keep')}</Button>
      </div>
      {problem && <p className="field__error" role="alert">{t('dl7.thanks.failed')}</p>}
      {mine.length > 0 && <p className="muted" role="status">{t('dl7.thanks.sent', { count: mine.length })}</p>}
      {state.sea.thanks.length > 0 && <p className="muted">{t('dl7.thanks.kept', { count: state.sea.thanks.length })}</p>}
      <p className="muted">{t('dl7.thanks.note')}</p>
    </Card>
  )
}

/** D6-8: on a birthday or anniversary that falls today, a card with messages from everyone on the booking. */
export function CelebrationDay({ date }: { date: string }) {
  const { state } = useMemory()
  const wishes = useMine(() => api.plan.wishes.get())
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(false)
  const occasion = occasionOn(state.polish.occasions, date)
  if (!occasion) return null
  const view = wishes.data
  const list = view ? wishesFor(view.items, occasion.id) : []
  const add = async () => {
    setBusy(true); setProblem(false)
    try { await api.plan.wishes.add(occasion.id, text); wishes.retry(); setText('') } catch { setProblem(true) } finally { setBusy(false) }
  }
  return (
    <Card hero labelledBy="dl7-cel-h">
      <h2 id="dl7-cel-h" className="card__title">{t('dl7.cel.title', { label: occasion.label })}</h2>
      <p>{t('dl7.cel.body', { date: formatDate(date), ship: SHIP.name })}</p>
      {list.length > 0 && <ul className="plain-bullets">{list.map((w) => <li key={w.id}><strong>{w.mine ? t('dl7.cel.you') : w.author}:</strong> {w.text}</li>)}</ul>}
      {view?.canAdd && (
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) void add() }}>
          <Field label={t('dl7.cel.add')} value={text} maxLength={CELEBRATION_MAX} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={busy || !text.trim()}>{t('dl7.cel.save')}</Button>
        </form>
      )}
      {problem && <p className="field__error" role="alert">{t('dl7.cel.failed')}</p>}
      <p className="muted">{t('dl7.cel.note')}</p>
    </Card>
  )
}
